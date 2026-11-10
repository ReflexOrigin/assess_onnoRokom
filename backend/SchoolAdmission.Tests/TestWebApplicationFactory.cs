using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using SchoolAdmission.Api.Data;

namespace SchoolAdmission.Tests;

public class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = $"SchoolAdmissionTest_{Guid.NewGuid()}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<SchoolAdmissionDbContext>));
            if (descriptor != null)
            {
                services.Remove(descriptor);
            }

            var postgresConnection = Environment.GetEnvironmentVariable("POSTGRES_TEST_CONNECTION");

            if (!string.IsNullOrWhiteSpace(postgresConnection))
            {
                services.AddDbContext<SchoolAdmissionDbContext>(options =>
                {
                    options.UseNpgsql(postgresConnection);
                });
            }
            else
            {
                services.AddDbContext<SchoolAdmissionDbContext>(options =>
                {
                    options.UseInMemoryDatabase(_databaseName);
                    options.ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning));
                });
            }
        });
    }
}
