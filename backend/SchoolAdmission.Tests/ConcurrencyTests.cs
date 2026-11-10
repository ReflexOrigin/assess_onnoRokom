using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using SchoolAdmission.Api.DTOs;
using Xunit;

namespace SchoolAdmission.Tests;

public class ConcurrencyTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ConcurrencyTests(TestWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task MandatoryTest3_ConcurrentHoldRequests_NeverOversellsSeats()
    {
        const int totalSeats = 5;
        const int concurrentRequests = 50;

        // 1. Create a class with 5 seats
        var classResponse = await _client.PostAsJsonAsync("/classes", new CreateClassRequest
        {
            Name = "Class 10 - High Competition",
            TotalSeats = totalSeats
        });
        var createdClass = await classResponse.Content.ReadFromJsonAsync<CreateClassResponse>();
        Assert.NotNull(createdClass);

        // 2. Prepare 50 concurrent requests with unique 17-digit student IDs
        var results = new ConcurrentBag<HttpResponseMessage>();

        var tasks = Enumerable.Range(1, concurrentRequests).Select(async i =>
        {
            // Format 17 digits: e.g. "20260000000000001", "20260000000000002", ...
            var studentId = $"2026{i.ToString().PadLeft(13, '0')}";

            using var request = new HttpRequestMessage(HttpMethod.Post, $"/classes/{createdClass.Id}/holds");
            request.Headers.Add("X-Student-Id", studentId);

            var response = await _client.SendAsync(request);
            results.Add(response);
        });

        // Execute all requests concurrently
        await Task.WhenAll(tasks);

        // 3. Evaluate results
        var successfulResponses = results.Where(r => r.StatusCode == HttpStatusCode.Created).ToList();
        var rejectedResponses = results.Where(r => r.StatusCode == HttpStatusCode.Conflict).ToList();

        // Exactly totalSeats must have succeeded
        Assert.Equal(totalSeats, successfulResponses.Count);

        // All remaining requests must have been rejected with 409 Conflict
        Assert.Equal(concurrentRequests - totalSeats, rejectedResponses.Count);

        // 4. Verify class seat counters in database
        var finalClassInfo = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{createdClass.Id}");
        Assert.NotNull(finalClassInfo);
        Assert.Equal(totalSeats, finalClassInfo.TotalSeats);
        Assert.Equal(totalSeats, finalClassInfo.HeldSeats);
        Assert.Equal(0, finalClassInfo.ConfirmedSeats);
        Assert.Equal(0, finalClassInfo.AvailableSeats);
        Assert.True(finalClassInfo.AvailableSeats >= 0, "Available seats must never be negative!");
    }
}

