namespace SchoolAdmission.Api.Models;

public class AdmissionHold
{
    public string Id { get; set; } = string.Empty;
    public string ClassId { get; set; } = string.Empty;
    public string StudentId { get; set; } = string.Empty;
    public string Status { get; set; } = HoldStatus.Held;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public DateTime? CancelledAt { get; set; }

    public AdmissionClass? Class { get; set; }
}

