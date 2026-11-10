using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Models;
using Xunit;

namespace SchoolAdmission.Tests;

public class ExpirationTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly TestWebApplicationFactory _factory;

    public ExpirationTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task MandatoryTest2_ExpiredHold_ReleasesSeatAndRejectsConfirmation()
    {
        // 1. Create a class with only 1 seat
        var classResponse = await _client.PostAsJsonAsync("/classes", new CreateClassRequest
        {
            Name = "Class 9 - Exclusive Seat",
            TotalSeats = 1
        });
        var createdClass = await classResponse.Content.ReadFromJsonAsync<CreateClassResponse>();
        Assert.NotNull(createdClass);

        var studentA = "20152691234567891";
        var studentB = "20152691234567892";

        // 2. Student A holds the only seat
        using var holdA = new HttpRequestMessage(HttpMethod.Post, $"/classes/{createdClass.Id}/holds");
        holdA.Headers.Add("X-Student-Id", studentA);
        var holdAResponse = await _client.SendAsync(holdA);
        Assert.Equal(HttpStatusCode.Created, holdAResponse.StatusCode);
        var holdAData = await holdAResponse.Content.ReadFromJsonAsync<CreateHoldResponse>();
        Assert.NotNull(holdAData);

        // Class should now have 0 available seats
        var classInfoDuringHold = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{createdClass.Id}");
        Assert.NotNull(classInfoDuringHold);
        Assert.Equal(0, classInfoDuringHold.AvailableSeats);
        Assert.Equal(1, classInfoDuringHold.HeldSeats);

        // 3. Simulate hold expiration by setting ExpiresAt in the past directly in DB
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SchoolAdmissionDbContext>();
            var record = await db.AdmissionHolds.FindAsync(holdAData.HoldId);
            Assert.NotNull(record);
            record.ExpiresAt = DateTime.UtcNow.AddMinutes(-5); // Expired 5 minutes ago
            await db.SaveChangesAsync();
        }

        // 4. Verify GET /holds/{holdId} dynamically reports EXPIRED without needing manual cleanup
        var holdStatusResponse = await _client.GetFromJsonAsync<HoldDetailsResponse>($"/holds/{holdAData.HoldId}");
        Assert.NotNull(holdStatusResponse);
        Assert.Equal(HoldStatus.Expired, holdStatusResponse.Status);

        // 5. Attempting to confirm the expired hold must be rejected
        using var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdAData.HoldId}/confirm");
        confirmReq.Headers.Add("X-Student-Id", studentA);
        var confirmResponse = await _client.SendAsync(confirmReq);
        Assert.Equal(HttpStatusCode.Conflict, confirmResponse.StatusCode);
        var confirmError = await confirmResponse.Content.ReadFromJsonAsync<ErrorResponseDto>();
        Assert.NotNull(confirmError);
        Assert.Equal("HOLD_EXPIRED", confirmError.Code);

        // 6. Seat count must reflect expiration: available seats should be 1 again
        var classInfoAfterExpiry = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{createdClass.Id}");
        Assert.NotNull(classInfoAfterExpiry);
        Assert.Equal(1, classInfoAfterExpiry.AvailableSeats);
        Assert.Equal(0, classInfoAfterExpiry.HeldSeats);

        // 7. Student B should now be able to successfully reserve that released seat
        using var holdB = new HttpRequestMessage(HttpMethod.Post, $"/classes/{createdClass.Id}/holds");
        holdB.Headers.Add("X-Student-Id", studentB);
        var holdBResponse = await _client.SendAsync(holdB);
        Assert.Equal(HttpStatusCode.Created, holdBResponse.StatusCode);
        var holdBData = await holdBResponse.Content.ReadFromJsonAsync<CreateHoldResponse>();
        Assert.NotNull(holdBData);
        Assert.Equal(studentB, holdBData.StudentId);
    }
}

