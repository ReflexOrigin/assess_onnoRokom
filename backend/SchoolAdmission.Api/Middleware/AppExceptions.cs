using System.Net;

namespace SchoolAdmission.Api.Middleware;

public abstract class AppException : Exception
{
    public HttpStatusCode StatusCode { get; }
    public string ErrorCode { get; }

    protected AppException(HttpStatusCode statusCode, string errorCode, string message)
        : base(message)
    {
        StatusCode = statusCode;
        ErrorCode = errorCode;
    }
}

public class ValidationException : AppException
{
    public ValidationException(string message, string errorCode = "VALIDATION_ERROR")
        : base(HttpStatusCode.BadRequest, errorCode, message)
    {
    }
}

public class NotFoundException : AppException
{
    public NotFoundException(string message, string errorCode = "NOT_FOUND")
        : base(HttpStatusCode.NotFound, errorCode, message)
    {
    }
}

public class ConflictException : AppException
{
    public ConflictException(string message, string errorCode = "CONFLICT")
        : base(HttpStatusCode.Conflict, errorCode, message)
    {
    }
}

public class ForbiddenException : AppException
{
    public ForbiddenException(string message, string errorCode = "UNAUTHORIZED_ACCESS")
        : base(HttpStatusCode.Forbidden, errorCode, message)
    {
    }
}

