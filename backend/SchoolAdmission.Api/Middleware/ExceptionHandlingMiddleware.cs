using System.Net;
using System.Text.Json;
using SchoolAdmission.Api.DTOs;

namespace SchoolAdmission.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (AppException ex)
        {
            _logger.LogWarning(ex, "Domain exception handled: {ErrorCode} - {Message}", ex.ErrorCode, ex.Message);
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)ex.StatusCode;

            var errorResponse = new ErrorResponseDto(ex.ErrorCode, ex.Message);
            await context.Response.WriteAsync(JsonSerializer.Serialize(errorResponse));
        }
        catch (BadHttpRequestException ex)
        {
            _logger.LogWarning(ex, "Bad request handled: {Message}", ex.Message);
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.BadRequest;

            var errorResponse = new ErrorResponseDto("BAD_REQUEST", ex.Message);
            await context.Response.WriteAsync(JsonSerializer.Serialize(errorResponse));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled server exception occurred.");
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

            var errorResponse = new ErrorResponseDto(
                "INTERNAL_SERVER_ERROR",
                "An unexpected server error occurred. Please contact system administrator."
            );
            await context.Response.WriteAsync(JsonSerializer.Serialize(errorResponse));
        }
    }
}

