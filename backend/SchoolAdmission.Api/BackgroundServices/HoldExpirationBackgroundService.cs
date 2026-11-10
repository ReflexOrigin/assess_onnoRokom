using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Models;

namespace SchoolAdmission.Api.BackgroundServices;

public class HoldExpirationBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<HoldExpirationBackgroundService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromSeconds(5);

    public HoldExpirationBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<HoldExpirationBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("HoldExpirationBackgroundService is starting with check interval {Interval}s.",
            _checkInterval.TotalSeconds);

        using var timer = new PeriodicTimer(_checkInterval);

        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await CleanupExpiredHoldsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while executing background hold expiration cleanup.");
            }
        }

        _logger.LogInformation("HoldExpirationBackgroundService is stopping.");
    }

    private async Task CleanupExpiredHoldsAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<SchoolAdmissionDbContext>();

        var now = DateTime.UtcNow;

        if (context.Database.IsRelational())
        {
            // Execute atomic update for high performance and concurrency safety across multiple backend instances
            var rowsUpdated = await context.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE \"AdmissionHolds\" SET \"Status\" = {HoldStatus.Expired} WHERE \"Status\" = {HoldStatus.Held} AND \"ExpiresAt\" <= {now}",
                ct);

            if (rowsUpdated > 0)
            {
                _logger.LogInformation("Background worker transitioned {Count} expired admission hold(s) to EXPIRED status.", rowsUpdated);
            }
        }
        else
        {
            // In-memory fallback for non-relational test fixtures
            var expiredHolds = await context.AdmissionHolds
                .Where(h => h.Status == HoldStatus.Held && h.ExpiresAt <= now)
                .ToListAsync(ct);

            if (expiredHolds.Count > 0)
            {
                foreach (var hold in expiredHolds)
                {
                    hold.Status = HoldStatus.Expired;
                }

                await context.SaveChangesAsync(ct);
                _logger.LogInformation("Background worker transitioned {Count} expired admission hold(s) to EXPIRED status.", expiredHolds.Count);
            }
        }
    }
}

