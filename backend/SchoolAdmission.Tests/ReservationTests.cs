using System.Net;
using System.Net.Http.Json;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Models;
using Xunit;

namespace SchoolAdmission.Tests;

public class ReservationTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ReservationTests(TestWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task MandatoryTest1_SuccessfulReservation_DecreasesAvailableSeats()
    {
        // 1. Admin creates a class with 10 seats
        var classRequest = new CreateClassRequest
        {
            Name = "Class 7 - Morning Shift",
            TotalSeats = 10
        };

        var classCreateResponse = await _client.PostAsJsonAsync("/classes", classRequest);
        Assert.Equal(HttpStatusCode.Created, classCreateResponse.StatusCode);
        var createdClass = await classCreateResponse.Content.ReadFromJsonAsync<CreateClassResponse>();
        Assert.NotNull(createdClass);
        Assert.StartsWith("c_", createdClass.Id);

        // Verify initial seat availability
        var initialClassInfo = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{createdClass.Id}");
        Assert.NotNull(initialClassInfo);
        Assert.Equal(10, initialClassInfo.TotalSeats);
        Assert.Equal(0, initialClassInfo.HeldSeats);
        Assert.Equal(0, initialClassInfo.ConfirmedSeats);
        Assert.Equal(10, initialClassInfo.AvailableSeats);

        // 2. Student applies for admission
        var studentId = "20152691234567890";
        using var holdMessage = new HttpRequestMessage(HttpMethod.Post, $"/classes/{createdClass.Id}/holds");
        holdMessage.Headers.Add("X-Student-Id", studentId);

        var holdResponse = await _client.SendAsync(holdMessage);
        Assert.Equal(HttpStatusCode.Created, holdResponse.StatusCode);

        var holdData = await holdResponse.Content.ReadFromJsonAsync<CreateHoldResponse>();
        Assert.NotNull(holdData);
        Assert.StartsWith("h_", holdData.HoldId);
        Assert.Equal(createdClass.Id, holdData.ClassId);
        Assert.Equal(studentId, holdData.StudentId);
        Assert.Equal(HoldStatus.Held, holdData.Status);
        Assert.True(holdData.ExpiresAt > DateTime.UtcNow);

        // 3. Verify seat counts: heldSeats = 1, availableSeats = 9
        var updatedClassInfo = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{createdClass.Id}");
        Assert.NotNull(updatedClassInfo);
        Assert.Equal(10, updatedClassInfo.TotalSeats);
        Assert.Equal(1, updatedClassInfo.HeldSeats);
        Assert.Equal(0, updatedClassInfo.ConfirmedSeats);
        Assert.Equal(9, updatedClassInfo.AvailableSeats);
    }

    [Fact]
    public async Task CreateHold_DuplicateApplication_Returns409Conflict()
    {
        // Create class
        var classResponse = await _client.PostAsJsonAsync("/classes", new CreateClassRequest
        {
            Name = "Class 8 - Day Shift",
            TotalSeats = 5
        });
        var createdClass = await classResponse.Content.ReadFromJsonAsync<CreateClassResponse>();
        Assert.NotNull(createdClass);

        var studentId = "20162691234567891";

        // First application succeeds
        using var firstHoldReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{createdClass.Id}/holds");
        firstHoldReq.Headers.Add("X-Student-Id", studentId);
        var firstResponse = await _client.SendAsync(firstHoldReq);
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        // Second application by same student for same class should fail with 409 Conflict
        using var secondHoldReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{createdClass.Id}/holds");
        secondHoldReq.Headers.Add("X-Student-Id", studentId);
        var secondResponse = await _client.SendAsync(secondHoldReq);
        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);

        var error = await secondResponse.Content.ReadFromJsonAsync<ErrorResponseDto>();
        Assert.NotNull(error);
        Assert.Equal("DUPLICATE_APPLICATION", error.Code);
    }

    [Fact]
    public async Task CreateHold_NonexistentClass_Returns404NotFound()
    {
        using var holdReq = new HttpRequestMessage(HttpMethod.Post, "/classes/c_nonexistent999/holds");
        holdReq.Headers.Add("X-Student-Id", "20152691234567890");

        var response = await _client.SendAsync(holdReq);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var error = await response.Content.ReadFromJsonAsync<ErrorResponseDto>();
        Assert.NotNull(error);
        Assert.Equal("CLASS_NOT_FOUND", error.Code);
    }
}

