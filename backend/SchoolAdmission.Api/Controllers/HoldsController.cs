using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Middleware;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Route("holds")]
[Produces("application/json")]
public class HoldsController : ControllerBase
{
    private readonly IHoldService _holdService;

    public HoldsController(IHoldService holdService)
    {
        _holdService = holdService;
    }

    /// <summary>
    /// API 5 — GET /holds/{holdId}
    /// Retrieve latest status of an application hold.
    /// </summary>
    [HttpGet("{holdId}")]
    [ProducesResponseType(typeof(HoldDetailsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetHoldById([FromRoute] string holdId, CancellationToken ct)
    {
        var result = await _holdService.GetHoldByIdAsync(holdId, ct);
        return Ok(result);
    }

    /// <summary>
    /// API 6 — POST /holds/{holdId}/confirm
    /// Simulate payment completion and confirm admission.
    /// </summary>
    [HttpPost("{holdId}/confirm")]
    [ProducesResponseType(typeof(ConfirmHoldResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ConfirmHold(
        [FromRoute] string holdId,
        [FromHeader(Name = StudentIdValidator.HeaderName)] string? studentIdHeader,
        CancellationToken ct)
    {
        var studentId = StudentIdValidator.Validate(studentIdHeader);
        var result = await _holdService.ConfirmHoldAsync(holdId, studentId, ct);
        return Ok(result);
    }

    /// <summary>
    /// API 7 — DELETE /holds/{holdId}
    /// Cancel an active application hold, immediately freeing the seat.
    /// </summary>
    [HttpDelete("{holdId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CancelHold(
        [FromRoute] string holdId,
        [FromHeader(Name = StudentIdValidator.HeaderName)] string? studentIdHeader,
        CancellationToken ct)
    {
        var studentId = StudentIdValidator.Validate(studentIdHeader);
        await _holdService.CancelHoldAsync(holdId, studentId, ct);
        return NoContent();
    }
}

