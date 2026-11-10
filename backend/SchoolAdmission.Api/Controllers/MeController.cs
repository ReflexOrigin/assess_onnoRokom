using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Middleware;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Route("me")]
[Produces("application/json")]
public class MeController : ControllerBase
{
    private readonly IHoldService _holdService;

    public MeController(IHoldService holdService)
    {
        _holdService = holdService;
    }

    /// <summary>
    /// API 8 — GET /me/holds
    /// Retrieve every application associated with the currently selected student.
    /// </summary>
    [HttpGet("holds")]
    [ProducesResponseType(typeof(IReadOnlyList<StudentHoldSummaryResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetMyHolds(
        [FromHeader(Name = StudentIdValidator.HeaderName)] string? studentIdHeader,
        CancellationToken ct)
    {
        var studentId = StudentIdValidator.Validate(studentIdHeader);
        var result = await _holdService.GetStudentHoldsAsync(studentId, ct);
        return Ok(result);
    }
}

