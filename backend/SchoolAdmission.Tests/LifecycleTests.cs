using System.Net;
using System.Net.Http.Json;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Models;
using Xunit;

namespace SchoolAdmission.Tests;

public class LifecycleTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient _client;

    public LifecycleTests(TestWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Confirmation_ValidHold_SucceedsAndIsIdempotent()
    {
        // 1. Create class
        var classRes = await _client.PostAsJsonAsync("/classes", new CreateClassRequest
        {
            Name = "Class 6 - Confirm Test",
            TotalSeats = 2
        });
        var cls = await classRes.Content.ReadFromJsonAsync<CreateClassResponse>();
        Assert.NotNull(cls);

        var studentId = "20261109123456789";

        // 2. Reserve seat
        using var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{cls.Id}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdRes = await _client.SendAsync(holdReq);
        Assert.Equal(HttpStatusCode.Created, holdRes.StatusCode);
        var hold = await holdRes.Content.ReadFromJsonAsync<CreateHoldResponse>();
        Assert.NotNull(hold);

        // 3. Confirm admission
        using var confirmReq1 = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold.HoldId}/confirm");
        confirmReq1.Headers.Add("X-Student-Id", studentId);
        var confirmRes1 = await _client.SendAsync(confirmReq1);
        Assert.Equal(HttpStatusCode.OK, confirmRes1.StatusCode);
        var confirmData1 = await confirmRes1.Content.ReadFromJsonAsync<ConfirmHoldResponse>();
        Assert.NotNull(confirmData1);
        Assert.Equal(HoldStatus.Confirmed, confirmData1.Status);

        // Verify seat counts: confirmed = 1, held = 0, available = 1
        var classInfo = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{cls.Id}");
        Assert.NotNull(classInfo);
        Assert.Equal(1, classInfo.ConfirmedSeats);
        Assert.Equal(0, classInfo.HeldSeats);
        Assert.Equal(1, classInfo.AvailableSeats);

        // 4. Repeated confirmation: must be idempotent and NEVER double count seats!
        using var confirmReq2 = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold.HoldId}/confirm");
        confirmReq2.Headers.Add("X-Student-Id", studentId);
        var confirmRes2 = await _client.SendAsync(confirmReq2);
        Assert.Equal(HttpStatusCode.OK, confirmRes2.StatusCode);

        var classInfoAfterRepeated = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{cls.Id}");
        Assert.NotNull(classInfoAfterRepeated);
        Assert.Equal(1, classInfoAfterRepeated.ConfirmedSeats); // Still 1!
        Assert.Equal(0, classInfoAfterRepeated.HeldSeats);
        Assert.Equal(1, classInfoAfterRepeated.AvailableSeats);
    }

    [Fact]
    public async Task Cancellation_ActiveHold_ReleasesSeatImmediately()
    {
        // 1. Create class with 1 seat
        var classRes = await _client.PostAsJsonAsync("/classes", new CreateClassRequest
        {
            Name = "Class 5 - Cancel Test",
            TotalSeats = 1
        });
        var cls = await classRes.Content.ReadFromJsonAsync<CreateClassResponse>();
        Assert.NotNull(cls);

        var studentA = "20261109987654321";
        var studentB = "20261109987654322";

        // 2. Student A reserves seat
        using var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{cls.Id}/holds");
        holdReq.Headers.Add("X-Student-Id", studentA);
        var holdRes = await _client.SendAsync(holdReq);
        Assert.Equal(HttpStatusCode.Created, holdRes.StatusCode);
        var hold = await holdRes.Content.ReadFromJsonAsync<CreateHoldResponse>();
        Assert.NotNull(hold);

        // Available seats should now be 0
        var classBefore = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{cls.Id}");
        Assert.NotNull(classBefore);
        Assert.Equal(0, classBefore.AvailableSeats);

        // 3. Student A cancels reservation
        using var cancelReq = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold.HoldId}");
        cancelReq.Headers.Add("X-Student-Id", studentA);
        var cancelRes = await _client.SendAsync(cancelReq);
        Assert.Equal(HttpStatusCode.NoContent, cancelRes.StatusCode);

        // 4. Verify seat is released immediately
        var classAfter = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{cls.Id}");
        Assert.NotNull(classAfter);
        Assert.Equal(1, classAfter.AvailableSeats);
        Assert.Equal(0, classAfter.HeldSeats);

        // 5. Student B can now reserve the released seat
        using var holdReqB = new HttpRequestMessage(HttpMethod.Post, $"/classes/{cls.Id}/holds");
        holdReqB.Headers.Add("X-Student-Id", studentB);
        var holdResB = await _client.SendAsync(holdReqB);
        Assert.Equal(HttpStatusCode.Created, holdResB.StatusCode);
    }

    [Fact]
    public async Task UnauthorizedStudent_CannotConfirmOrCancelHold()
    {
        var classRes = await _client.PostAsJsonAsync("/classes", new CreateClassRequest
        {
            Name = "Class 8 - Security Test",
            TotalSeats = 2
        });
        var cls = await classRes.Content.ReadFromJsonAsync<CreateClassResponse>();
        Assert.NotNull(cls);

        var ownerStudent = "20261109111111111";
        var attackerStudent = "20261109222222222";

        // Owner creates hold
        using var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{cls.Id}/holds");
        holdReq.Headers.Add("X-Student-Id", ownerStudent);
        var holdRes = await _client.SendAsync(holdReq);
        var hold = await holdRes.Content.ReadFromJsonAsync<CreateHoldResponse>();
        Assert.NotNull(hold);

        // Attacker attempts to confirm owner's hold -> 403 Forbidden
        using var attackConfirm = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold.HoldId}/confirm");
        attackConfirm.Headers.Add("X-Student-Id", attackerStudent);
        var confirmRes = await _client.SendAsync(attackConfirm);
        Assert.Equal(HttpStatusCode.Forbidden, confirmRes.StatusCode);

        // Attacker attempts to cancel owner's hold -> 403 Forbidden
        using var attackCancel = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold.HoldId}");
        attackCancel.Headers.Add("X-Student-Id", attackerStudent);
        var cancelRes = await _client.SendAsync(attackCancel);
        Assert.Equal(HttpStatusCode.Forbidden, cancelRes.StatusCode);
    }

    [Fact]
    public async Task MultipleShifts_MaintainIndependentSeatCapacities()
    {
        // Class 6 Morning Shift: 120 seats
        var morningRes = await _client.PostAsJsonAsync("/classes", new CreateClassRequest
        {
            Name = "Class 6 - Morning Shift",
            TotalSeats = 120
        });
        var morningClass = await morningRes.Content.ReadFromJsonAsync<CreateClassResponse>();
        Assert.NotNull(morningClass);

        // Class 6 Day Shift: 100 seats
        var dayRes = await _client.PostAsJsonAsync("/classes", new CreateClassRequest
        {
            Name = "Class 6 - Day Shift",
            TotalSeats = 100
        });
        var dayClass = await dayRes.Content.ReadFromJsonAsync<CreateClassResponse>();
        Assert.NotNull(dayClass);

        var studentId = "20261109333333333";

        // Student applies to Morning Shift
        using var holdMorning = new HttpRequestMessage(HttpMethod.Post, $"/classes/{morningClass.Id}/holds");
        holdMorning.Headers.Add("X-Student-Id", studentId);
        var morningHoldRes = await _client.SendAsync(holdMorning);
        Assert.Equal(HttpStatusCode.Created, morningHoldRes.StatusCode);

        // Morning seats should be 119 available, Day seats should remain 100 available
        var morningStats = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{morningClass.Id}");
        var dayStats = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{dayClass.Id}");

        Assert.NotNull(morningStats);
        Assert.NotNull(dayStats);

        Assert.Equal(119, morningStats.AvailableSeats);
        Assert.Equal(1, morningStats.HeldSeats);

        Assert.Equal(100, dayStats.AvailableSeats);
        Assert.Equal(0, dayStats.HeldSeats);
    }

    [Fact]
    public async Task GetMyHolds_ReturnsCompleteStudentHistory()
    {
        var classRes = await _client.PostAsJsonAsync("/classes", new CreateClassRequest
        {
            Name = "Class 4 - History Test",
            TotalSeats = 5
        });
        var cls = await classRes.Content.ReadFromJsonAsync<CreateClassResponse>();
        Assert.NotNull(cls);

        var studentId = "20261109444444444";

        // Create hold
        using var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{cls.Id}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        await _client.SendAsync(holdReq);

        // Fetch /me/holds
        using var myHoldsReq = new HttpRequestMessage(HttpMethod.Get, "/me/holds");
        myHoldsReq.Headers.Add("X-Student-Id", studentId);
        var myHoldsRes = await _client.SendAsync(myHoldsReq);
        Assert.Equal(HttpStatusCode.OK, myHoldsRes.StatusCode);

        var holds = await myHoldsRes.Content.ReadFromJsonAsync<List<StudentHoldSummaryResponse>>();
        Assert.NotNull(holds);
        Assert.Single(holds);
        Assert.Equal(cls.Id, holds[0].ClassId);
        Assert.Equal("Class 4 - History Test", holds[0].ClassName);
        Assert.Equal(HoldStatus.Held, holds[0].Status);
    }
}

