using System.Collections.Concurrent;
using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using SchoolAdmission.Api.Common;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Middleware;
using SchoolAdmission.Api.Models;

namespace SchoolAdmission.Api.Services;

public class HoldService : IHoldService
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _classLocks = new();

    private readonly SchoolAdmissionDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<HoldService> _logger;

    public HoldService(
        SchoolAdmissionDbContext context,
        IConfiguration configuration,
        ILogger<HoldService> logger)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
    }

    private int GetHoldDurationSeconds()
    {
        var envValue = Environment.GetEnvironmentVariable("HOLD_DURATION_SECONDS")
                       ?? _configuration["HOLD_DURATION_SECONDS"];

        if (int.TryParse(envValue, out var duration) && duration > 0)
        {
            return duration;
        }

        return 600; // Default 10 minutes (600 seconds)
    }

    public async Task<CreateHoldResponse> CreateHoldAsync(string classId, string studentId, CancellationToken ct = default)
    {
        StudentIdValidator.Validate(studentId);

        if (string.IsNullOrWhiteSpace(classId))
        {
            throw new ValidationException("Class ID cannot be empty.", "INVALID_CLASS_ID");
        }

        var classLock = _classLocks.GetOrAdd(classId, _ => new SemaphoreSlim(1, 1));
        await classLock.WaitAsync(ct);

        try
        {
            var executionStrategy = _context.Database.CreateExecutionStrategy();

            return await executionStrategy.ExecuteAsync(async () =>
            {
                IDbContextTransaction? transaction = null;
                if (_context.Database.IsRelational())
                {
                    transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
                }

                try
                {
                    AdmissionClass? admissionClass;

                    // Concurrency control: Lock the Class row using SELECT ... FOR UPDATE on PostgreSQL
                    if (IsPostgreSql())
                    {
                        admissionClass = await _context.AdmissionClasses
                            .FromSqlInterpolated($"SELECT * FROM \"AdmissionClasses\" WHERE \"Id\" = {classId} FOR UPDATE")
                            .SingleOrDefaultAsync(ct);
                    }
                    else
                    {
                        admissionClass = await _context.AdmissionClasses
                            .SingleOrDefaultAsync(c => c.Id == classId, ct);
                    }

                    if (admissionClass == null)
                    {
                        throw new NotFoundException($"Class with ID '{classId}' does not exist.", "CLASS_NOT_FOUND");
                    }

                    var now = DateTime.UtcNow;

                    // Eagerly transition any expired holds for this class to EXPIRED status so their slots and database index rows are cleared
                    var expiredHoldsForClass = await _context.AdmissionHolds
                        .Where(h => h.ClassId == classId &&
                                    h.Status == HoldStatus.Held &&
                                    h.ExpiresAt <= now)
                        .ToListAsync(ct);

                    if (expiredHoldsForClass.Count > 0)
                    {
                        foreach (var expiredHold in expiredHoldsForClass)
                        {
                            expiredHold.Status = HoldStatus.Expired;
                        }
                        await _context.SaveChangesAsync(ct);
                    }

                    // Check duplicate active or confirmed application by this student for this class
                    var hasActiveOrConfirmed = await _context.AdmissionHolds
                        .AnyAsync(h => h.ClassId == classId &&
                                       h.StudentId == studentId &&
                                       (h.Status == HoldStatus.Confirmed ||
                                       (h.Status == HoldStatus.Held && h.ExpiresAt > now)), ct);

                    if (hasActiveOrConfirmed)
                    {
                        throw new ConflictException(
                            "Student already has an active or confirmed admission application for this class.",
                            "DUPLICATE_APPLICATION"
                        );
                    }

                    // Calculate current active held and confirmed seat counts under the lock
                    var activeHeldSeats = await _context.AdmissionHolds
                        .CountAsync(h => h.ClassId == classId &&
                                         h.Status == HoldStatus.Held &&
                                         h.ExpiresAt > now, ct);

                    var confirmedSeats = await _context.AdmissionHolds
                        .CountAsync(h => h.ClassId == classId &&
                                         h.Status == HoldStatus.Confirmed, ct);

                    var availableSeats = admissionClass.TotalSeats - activeHeldSeats - confirmedSeats;

                    if (availableSeats <= 0)
                    {
                        _logger.LogWarning("Admission rejected: class {ClassId} has no available seats. Total: {Total}, Held: {Held}, Confirmed: {Confirmed}",
                            classId, admissionClass.TotalSeats, activeHeldSeats, confirmedSeats);

                        throw new ConflictException(
                            "No seats are currently available for this class.",
                            "NO_SEATS_AVAILABLE"
                        );
                    }

                    var durationSeconds = GetHoldDurationSeconds();
                    var hold = new AdmissionHold
                    {
                        Id = IdGenerator.GenerateHoldId(),
                        ClassId = classId,
                        StudentId = studentId,
                        Status = HoldStatus.Held,
                        CreatedAt = now,
                        ExpiresAt = now.AddSeconds(durationSeconds)
                    };

                    _context.AdmissionHolds.Add(hold);
                    await _context.SaveChangesAsync(ct);

                    if (transaction != null)
                    {
                        await transaction.CommitAsync(ct);
                    }

                    _logger.LogInformation("Seat reserved: Hold {HoldId} created for student {StudentId} in class {ClassId}. Available left: {Available}",
                        hold.Id, studentId, classId, availableSeats - 1);

                    return new CreateHoldResponse
                    {
                        HoldId = hold.Id,
                        ClassId = hold.ClassId,
                        StudentId = hold.StudentId,
                        Status = hold.Status,
                        ExpiresAt = hold.ExpiresAt
                    };
                }
                catch
                {
                    if (transaction != null)
                    {
                        await transaction.RollbackAsync(ct);
                    }
                    throw;
                }
                finally
                {
                    if (transaction != null)
                    {
                        await transaction.DisposeAsync();
                    }
                }
            });
        }
        finally
        {
            classLock.Release();
        }
    }

    public async Task<HoldDetailsResponse> GetHoldByIdAsync(string holdId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(holdId))
        {
            throw new ValidationException("Hold ID cannot be empty.", "INVALID_HOLD_ID");
        }

        var hold = await _context.AdmissionHolds
            .AsNoTracking()
            .SingleOrDefaultAsync(h => h.Id == holdId, ct);

        if (hold == null)
        {
            throw new NotFoundException($"Application hold with ID '{holdId}' was not found.", "HOLD_NOT_FOUND");
        }

        // Authoritative on-read expiration check
        var effectiveStatus = hold.Status;
        if (effectiveStatus == HoldStatus.Held && hold.ExpiresAt <= DateTime.UtcNow)
        {
            effectiveStatus = HoldStatus.Expired;
        }

        return new HoldDetailsResponse
        {
            HoldId = hold.Id,
            ClassId = hold.ClassId,
            Status = effectiveStatus,
            ExpiresAt = hold.ExpiresAt
        };
    }

    public async Task<ConfirmHoldResponse> ConfirmHoldAsync(string holdId, string studentId, CancellationToken ct = default)
    {
        StudentIdValidator.Validate(studentId);

        if (string.IsNullOrWhiteSpace(holdId))
        {
            throw new ValidationException("Hold ID cannot be empty.", "INVALID_HOLD_ID");
        }

        var executionStrategy = _context.Database.CreateExecutionStrategy();

        return await executionStrategy.ExecuteAsync(async () =>
        {
            IDbContextTransaction? transaction = null;
            if (_context.Database.IsRelational())
            {
                transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
            }

            try
            {
                var hold = await _context.AdmissionHolds
                    .SingleOrDefaultAsync(h => h.Id == holdId, ct);

                if (hold == null)
                {
                    throw new NotFoundException($"Application hold with ID '{holdId}' was not found.", "HOLD_NOT_FOUND");
                }

                // Verify student ownership
                if (hold.StudentId != studentId)
                {
                    throw new ForbiddenException(
                        "You do not have permission to confirm this admission reservation. Student identity does not match.",
                        "UNAUTHORIZED_ACCESS"
                    );
                }

                // Acquire row lock on the class row to serialize seat modifications and avoid deadlocks
                if (IsPostgreSql())
                {
                    await _context.AdmissionClasses
                        .FromSqlInterpolated($"SELECT * FROM \"AdmissionClasses\" WHERE \"Id\" = {hold.ClassId} FOR UPDATE")
                        .SingleOrDefaultAsync(ct);
                }

                // Idempotency check: If already confirmed by the same student, return current confirmed status
                if (hold.Status == HoldStatus.Confirmed)
                {
                    if (transaction != null)
                    {
                        await transaction.CommitAsync(ct);
                    }

                    return new ConfirmHoldResponse
                    {
                        HoldId = hold.Id,
                        Status = HoldStatus.Confirmed
                    };
                }

                if (hold.Status == HoldStatus.Cancelled)
                {
                    throw new ConflictException(
                        "Cannot confirm a cancelled admission hold. The seat has already been released.",
                        "HOLD_CANCELLED"
                    );
                }

                var now = DateTime.UtcNow;

                // Check authoritative expiration
                if (hold.Status == HoldStatus.Expired || (hold.Status == HoldStatus.Held && hold.ExpiresAt <= now))
                {
                    if (hold.Status == HoldStatus.Held)
                    {
                        hold.Status = HoldStatus.Expired;
                        await _context.SaveChangesAsync(ct);
                    }

                    if (transaction != null)
                    {
                        await transaction.CommitAsync(ct);
                    }

                    throw new ConflictException(
                        "Cannot confirm admission. The reservation hold has expired and the seat was released.",
                        "HOLD_EXPIRED"
                    );
                }

                // Transition status from HELD to CONFIRMED
                hold.Status = HoldStatus.Confirmed;
                hold.ConfirmedAt = now;

                await _context.SaveChangesAsync(ct);

                if (transaction != null)
                {
                    await transaction.CommitAsync(ct);
                }

                _logger.LogInformation("Admission confirmed: Hold {HoldId} for student {StudentId} in class {ClassId}.",
                    hold.Id, hold.StudentId, hold.ClassId);

                return new ConfirmHoldResponse
                {
                    HoldId = hold.Id,
                    Status = HoldStatus.Confirmed
                };
            }
            catch
            {
                if (transaction != null)
                {
                    await transaction.RollbackAsync(ct);
                }
                throw;
            }
            finally
            {
                if (transaction != null)
                {
                    await transaction.DisposeAsync();
                }
            }
        });
    }

    public async Task CancelHoldAsync(string holdId, string studentId, CancellationToken ct = default)
    {
        StudentIdValidator.Validate(studentId);

        if (string.IsNullOrWhiteSpace(holdId))
        {
            throw new ValidationException("Hold ID cannot be empty.", "INVALID_HOLD_ID");
        }

        var executionStrategy = _context.Database.CreateExecutionStrategy();

        await executionStrategy.ExecuteAsync(async () =>
        {
            IDbContextTransaction? transaction = null;
            if (_context.Database.IsRelational())
            {
                transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
            }

            try
            {
                var hold = await _context.AdmissionHolds
                    .SingleOrDefaultAsync(h => h.Id == holdId, ct);

                if (hold == null)
                {
                    throw new NotFoundException($"Application hold with ID '{holdId}' was not found.", "HOLD_NOT_FOUND");
                }

                // Verify student ownership
                if (hold.StudentId != studentId)
                {
                    throw new ForbiddenException(
                        "You do not have permission to cancel this admission reservation. Student identity does not match.",
                        "UNAUTHORIZED_ACCESS"
                    );
                }

                // Acquire row lock on the class row to synchronize seat release
                if (IsPostgreSql())
                {
                    await _context.AdmissionClasses
                        .FromSqlInterpolated($"SELECT * FROM \"AdmissionClasses\" WHERE \"Id\" = {hold.ClassId} FOR UPDATE")
                        .SingleOrDefaultAsync(ct);
                }

                // Idempotent cancellation
                if (hold.Status == HoldStatus.Cancelled)
                {
                    if (transaction != null)
                    {
                        await transaction.CommitAsync(ct);
                    }
                    return;
                }

                if (hold.Status == HoldStatus.Confirmed)
                {
                    throw new ConflictException(
                        "Cannot cancel an already confirmed admission.",
                        "HOLD_ALREADY_CONFIRMED"
                    );
                }

                var now = DateTime.UtcNow;

                // If hold was HELD, transition to CANCELLED and immediately free the seat
                hold.Status = HoldStatus.Cancelled;
                hold.CancelledAt = now;

                await _context.SaveChangesAsync(ct);

                if (transaction != null)
                {
                    await transaction.CommitAsync(ct);
                }

                _logger.LogInformation("Admission hold cancelled: Hold {HoldId} by student {StudentId} in class {ClassId}. Seat released immediately.",
                    hold.Id, hold.StudentId, hold.ClassId);
            }
            catch
            {
                if (transaction != null)
                {
                    await transaction.RollbackAsync(ct);
                }
                throw;
            }
            finally
            {
                if (transaction != null)
                {
                    await transaction.DisposeAsync();
                }
            }
        });
    }

    public async Task<IReadOnlyList<StudentHoldSummaryResponse>> GetStudentHoldsAsync(string studentId, CancellationToken ct = default)
    {
        StudentIdValidator.Validate(studentId);

        var now = DateTime.UtcNow;

        var holds = await _context.AdmissionHolds
            .AsNoTracking()
            .Include(h => h.Class)
            .Where(h => h.StudentId == studentId)
            .OrderByDescending(h => h.CreatedAt)
            .ToListAsync(ct);

        return holds.Select(h =>
        {
            var effectiveStatus = h.Status;
            if (effectiveStatus == HoldStatus.Held && h.ExpiresAt <= now)
            {
                effectiveStatus = HoldStatus.Expired;
            }

            return new StudentHoldSummaryResponse
            {
                HoldId = h.Id,
                ClassId = h.ClassId,
                ClassName = h.Class?.Name ?? string.Empty,
                Status = effectiveStatus,
                ExpiresAt = h.ExpiresAt
            };
        }).ToList();
    }

    private bool IsPostgreSql()
    {
        return _context.Database.IsRelational() &&
               _context.Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true;
    }
}
