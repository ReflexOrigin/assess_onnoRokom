using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Common;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Middleware;
using SchoolAdmission.Api.Models;

namespace SchoolAdmission.Api.Services;

public class ClassService : IClassService
{
    private readonly SchoolAdmissionDbContext _context;
    private readonly ILogger<ClassService> _logger;

    public ClassService(SchoolAdmissionDbContext context, ILogger<ClassService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<CreateClassResponse> CreateClassAsync(CreateClassRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new ValidationException("Class name cannot be empty.", "INVALID_CLASS_NAME");
        }

        if (request.TotalSeats <= 0)
        {
            throw new ValidationException("Total seats must be a positive integer greater than zero.", "INVALID_TOTAL_SEATS");
        }

        var admissionClass = new AdmissionClass
        {
            Id = IdGenerator.GenerateClassId(),
            Name = request.Name.Trim(),
            TotalSeats = request.TotalSeats,
            CreatedAt = DateTime.UtcNow
        };

        _context.AdmissionClasses.Add(admissionClass);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Created new class {ClassId} with {TotalSeats} seats: '{ClassName}'",
            admissionClass.Id, admissionClass.TotalSeats, admissionClass.Name);

        return new CreateClassResponse
        {
            Id = admissionClass.Id,
            Name = admissionClass.Name,
            TotalSeats = admissionClass.TotalSeats
        };
    }

    public async Task<IReadOnlyList<ClassResponse>> GetAllClassesAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        var classes = await _context.AdmissionClasses
            .AsNoTracking()
            .OrderBy(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.TotalSeats,
                HeldSeats = c.Holds.Count(h => h.Status == HoldStatus.Held && h.ExpiresAt > now),
                ConfirmedSeats = c.Holds.Count(h => h.Status == HoldStatus.Confirmed)
            })
            .ToListAsync(ct);

        return classes.Select(c =>
        {
            var available = Math.Max(0, c.TotalSeats - c.HeldSeats - c.ConfirmedSeats);
            return new ClassResponse
            {
                Id = c.Id,
                Name = c.Name,
                TotalSeats = c.TotalSeats,
                HeldSeats = c.HeldSeats,
                ConfirmedSeats = c.ConfirmedSeats,
                AvailableSeats = available
            };
        }).ToList();
    }

    public async Task<ClassResponse> GetClassByIdAsync(string classId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(classId))
        {
            throw new ValidationException("Class ID cannot be empty.", "INVALID_CLASS_ID");
        }

        var now = DateTime.UtcNow;

        var classInfo = await _context.AdmissionClasses
            .AsNoTracking()
            .Where(c => c.Id == classId)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.TotalSeats,
                HeldSeats = c.Holds.Count(h => h.Status == HoldStatus.Held && h.ExpiresAt > now),
                ConfirmedSeats = c.Holds.Count(h => h.Status == HoldStatus.Confirmed)
            })
            .SingleOrDefaultAsync(ct);

        if (classInfo == null)
        {
            throw new NotFoundException($"Class with ID '{classId}' does not exist.", "CLASS_NOT_FOUND");
        }

        var available = Math.Max(0, classInfo.TotalSeats - classInfo.HeldSeats - classInfo.ConfirmedSeats);

        return new ClassResponse
        {
            Id = classInfo.Id,
            Name = classInfo.Name,
            TotalSeats = classInfo.TotalSeats,
            HeldSeats = classInfo.HeldSeats,
            ConfirmedSeats = classInfo.ConfirmedSeats,
            AvailableSeats = available
        };
    }
}

