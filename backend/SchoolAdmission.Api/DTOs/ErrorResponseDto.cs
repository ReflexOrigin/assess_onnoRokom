using System.Text.Json.Serialization;

namespace SchoolAdmission.Api.DTOs;

public class ErrorResponseDto
{
    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    public ErrorResponseDto() { }

    public ErrorResponseDto(string code, string message)
    {
        Code = code;
        Message = message;
    }
}

