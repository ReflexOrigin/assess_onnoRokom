using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Middleware;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Route("classes")]
[Produces("application/json")]
public class ClassesController : ControllerBase
{
    private readonly IClassService _classService;
    private readonly IHoldService _holdService;

    public ClassesController(IClassService classService, IHoldService holdService)
    {
        _classService = classService;
        _holdService = holdService;
    }

    /// <summary>
    /// API 1 — POST /classes
    /// School admin creates a class with seat capacity.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CreateClassResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateClass([FromBody] CreateClassRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            var errorMessage = string.Join("; ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage));
            throw new ValidationException(errorMessage);
        }

        var result = await _classService.CreateClassAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>
    /// API 2 — GET /classes
    /// Retrieve all classes and their current seat availability.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ClassResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllClasses(CancellationToken ct)
    {
        var result = await _classService.GetAllClassesAsync(ct);
        return Ok(result);
    }

    /// <summary>
    /// API 3 — GET /classes/{classId}
    /// Retrieve one class and its latest seat statistics.
    /// </summary>
    [HttpGet("{classId}")]
    [ProducesResponseType(typeof(ClassResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetClassById([FromRoute] string classId, CancellationToken ct)
    {
        var result = await _classService.GetClassByIdAsync(classId, ct);
        return Ok(result);
    }

    /// <summary>
    /// API 4 — POST /classes/{classId}/holds
    /// Apply for admission and reserve one seat atomically.
    /// </summary>
    [HttpPost("{classId}/holds")]
    [ProducesResponseType(typeof(CreateHoldResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateHold(
        [FromRoute] string classId,
        [FromHeader(Name = StudentIdValidator.HeaderName)] string? studentIdHeader,
        CancellationToken ct)
    {
        var studentId = StudentIdValidator.Validate(studentIdHeader);
        var result = await _holdService.CreateHoldAsync(classId, studentId, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }
}

