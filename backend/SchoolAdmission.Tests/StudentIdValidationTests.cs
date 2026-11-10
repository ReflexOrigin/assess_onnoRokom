using System.Net;
using System.Net.Http.Json;
using SchoolAdmission.Api.DTOs;
using Xunit;

namespace SchoolAdmission.Tests;

public class StudentIdValidationTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient _client;

    public StudentIdValidationTests(TestWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Theory]
    [InlineData("")]
    [InlineData("1234567890123456")] // 16 digits (too short)
    [InlineData("123456789012345678")] // 18 digits (too long)
    [InlineData("2015269123456789a")] // Contains letter
    [InlineData("20152691-34567890")] // Contains hyphen
    [InlineData("abcdefghijklmnopq")] // Non-numeric
    public async Task InvalidStudentId_Returns400BadRequest(string invalidId)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/classes/c_123/holds");
        if (!string.IsNullOrEmpty(invalidId))
        {
            request.Headers.Add("X-Student-Id", invalidId);
        }

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var error = await response.Content.ReadFromJsonAsync<ErrorResponseDto>();
        Assert.NotNull(error);
        Assert.Contains(error.Code, new[] { "INVALID_STUDENT_ID", "MISSING_STUDENT_ID" });
    }

    [Fact]
    public async Task MissingStudentIdHeader_Returns400BadRequest()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/me/holds");
        // No X-Student-Id header added

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var error = await response.Content.ReadFromJsonAsync<ErrorResponseDto>();
        Assert.NotNull(error);
        Assert.Equal("MISSING_STUDENT_ID", error.Code);
    }
}

