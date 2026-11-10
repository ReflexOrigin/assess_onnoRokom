namespace SchoolAdmission.Api.Models;

public static class HoldStatus
{
    public const string Held = "HELD";
    public const string Confirmed = "CONFIRMED";
    public const string Expired = "EXPIRED";
    public const string Cancelled = "CANCELLED";

    public static readonly IReadOnlySet<string> All = new HashSet<string>
    {
        Held,
        Confirmed,
        Expired,
        Cancelled
    };
}

