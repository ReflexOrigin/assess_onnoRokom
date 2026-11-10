using Microsoft.EntityFrameworkCore;

namespace SchoolAdmission.Api.Data;

public static class DbInitializer
{
    public static async Task ApplyMigrationsAsync(IServiceProvider serviceProvider, ILogger logger)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<SchoolAdmissionDbContext>();

        if (context.Database.IsRelational())
        {
            const int maxRetries = 15;
            var delay = TimeSpan.FromSeconds(2);

            for (var attempt = 1; attempt <= maxRetries; attempt++)
            {
                try
                {
                    logger.LogInformation("Applying database migrations (attempt {Attempt}/{MaxRetries})...", attempt, maxRetries);
                    await context.Database.MigrateAsync();
                    logger.LogInformation("Database migrations applied successfully.");
                    return;
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to apply database migrations on attempt {Attempt}/{MaxRetries}. Waiting {Seconds}s before retry...",
                        attempt, maxRetries, delay.TotalSeconds);

                    if (attempt == maxRetries)
                    {
                        logger.LogCritical(ex, "Exhausted all migration retry attempts. Aborting startup.");
                        throw;
                    }

                    await Task.Delay(delay);
                }
            }
        }
        else
        {
            await context.Database.EnsureCreatedAsync();
        }
    }
}

