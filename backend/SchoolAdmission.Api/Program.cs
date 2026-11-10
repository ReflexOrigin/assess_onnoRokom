using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.OpenApi.Models;
using SchoolAdmission.Api.BackgroundServices;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Middleware;
using SchoolAdmission.Api.Services;

var builder = WebApplication.CreateBuilder(args);

var explicitInMemory = builder.Configuration.GetValue<bool>("USE_IN_MEMORY_DB") ||
                      string.Equals(Environment.GetEnvironmentVariable("USE_IN_MEMORY_DB"), "true", StringComparison.OrdinalIgnoreCase);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Host=postgres;Port=5432;Database=school_admission;Username=postgres;Password=postgres_secure_password_123";

var useInMemory = explicitInMemory || (!builder.Environment.IsEnvironment("Testing") && !CanConnectToPostgres(connectionString));

// Add Database Context
if (!builder.Environment.IsEnvironment("Testing") && !useInMemory)
{
    builder.Services.AddDbContext<SchoolAdmissionDbContext>(options =>
    {
        options.UseNpgsql(connectionString, npgsqlOptions =>
        {
            npgsqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(5),
                errorCodesToAdd: null);
        });
    });
}
else
{
    builder.Services.AddDbContext<SchoolAdmissionDbContext>(options =>
    {
        options.UseInMemoryDatabase("SchoolAdmissionLocalDb");
        options.ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning));
    });
}

// Register Application Services
builder.Services.AddScoped<IClassService, ClassService>();
builder.Services.AddScoped<IHoldService, HoldService>();

// Register Background Expiration Worker
builder.Services.AddHostedService<HoldExpirationBackgroundService>();

// Configure Controllers & JSON serialization
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// Configure CORS
var rawOrigins = builder.Configuration["CorsOrigins"] ?? "*";
var allowedOrigins = rawOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        if (allowedOrigins.Contains("*") || allowedOrigins.Length == 0)
        {
            policy.SetIsOriginAllowed(_ => true)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .WithExposedHeaders("X-Student-Id");
        }
        else
        {
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .WithExposedHeaders("X-Student-Id");
        }
    });
});

// Configure Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "School Admission System API",
        Version = "v1",
        Description = "First-come, first-served concurrency-safe school admission API for Onnorokom Projukti Limited assessment."
    });

    c.AddSecurityDefinition("StudentIdHeader", new OpenApiSecurityScheme
    {
        Name = "X-Student-Id",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Description = "17-digit birth registration number of the applicant student"
    });
});

var app = builder.Build();

// Migrate Database on Startup in non-testing PostgreSQL environments
if (!app.Environment.IsEnvironment("Testing") && !useInMemory)
{
    try
    {
        await DbInitializer.ApplyMigrationsAsync(app.Services, app.Logger);
    }
    catch (Exception ex)
    {
        app.Logger.LogCritical(ex, "Critical failure during database migration on startup.");
        throw;
    }
}
else
{
    if (!app.Environment.IsEnvironment("Testing"))
    {
        app.Logger.LogWarning("PostgreSQL is not running on localhost:5432. Automatically running with In-Memory database for local development.");
    }

    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<SchoolAdmissionDbContext>();
    await db.Database.EnsureCreatedAsync();
}

// Global Exception Handler Middleware
app.UseMiddleware<ExceptionHandlingMiddleware>();

// Enable Swagger UI
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "School Admission API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors("AllowFrontend");

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow }));

app.MapControllers();

app.Run();

// Make Program class public for WebApplicationFactory in integration tests
public partial class Program
{
    private static bool CanConnectToPostgres(string connectionString)
    {
        try
        {
            var connBuilder = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);
            var host = connBuilder.Host ?? "localhost";
            var port = connBuilder.Port > 0 ? connBuilder.Port : 5432;

            // In Docker where host is 'postgres' or remote host, let standard retry mechanism handle it
            if (!host.Equals("localhost", StringComparison.OrdinalIgnoreCase) &&
                !host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            using var tcpClient = new System.Net.Sockets.TcpClient();
            var connectTask = tcpClient.ConnectAsync(host, port);
            return connectTask.Wait(TimeSpan.FromMilliseconds(500)) && tcpClient.Connected;
        }
        catch
        {
            return false;
        }
    }
}
