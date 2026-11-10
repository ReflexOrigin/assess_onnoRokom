using System.Text.RegularExpressions;
using SchoolAdmission.Api.Middleware;

namespace SchoolAdmission.Api.Middleware;

public static class StudentIdValidator
{
    private static readonly Regex SeventeenDigitsRegex = new(@"^\d{17}$", RegexOptions.Compiled);

    public const string HeaderName = "X-Student-Id";

    public static string ExtractAndValidate(IHeaderDictionary headers)
    {
        if (!headers.TryGetValue(HeaderName, out var values) || string.IsNullOrWhiteSpace(values))
        {
            throw new ValidationException(
                $"Missing required header '{HeaderName}'. A 17-digit student birth registration number is required.",
                "MISSING_STUDENT_ID"
            );
        }

        var studentId = values.ToString().Trim();
        return Validate(studentId);
    }

    public static string Validate(string? studentId)
    {
        if (string.IsNullOrWhiteSpace(studentId))
        {
            throw new ValidationException(
                $"Missing required header '{HeaderName}'. A 17-digit student birth registration number is required.",
                "MISSING_STUDENT_ID"
            );
        }

        if (!SeventeenDigitsRegex.IsMatch(studentId))
        {
            throw new ValidationException(
                "Invalid student ID. The student identity must consist of exactly 17 numeric digits.",
                "INVALID_STUDENT_ID"
            );
        }

        return studentId;
    }
}

