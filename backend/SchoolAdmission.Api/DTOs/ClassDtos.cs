using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace SchoolAdmission.Api.DTOs;

public class CreateClassRequest
{
    [Required(ErrorMessage = "Class name is required.")]
    [MinLength(1, ErrorMessage = "Class name cannot be empty.")]
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [Range(1, int.MaxValue, ErrorMessage = "Total seats must be a positive integer.")]
    [JsonPropertyName("totalSeats")]
    public int TotalSeats { get; set; }
}

public class CreateClassResponse
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("totalSeats")]
    public int TotalSeats { get; set; }
}

public class ClassResponse
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("totalSeats")]
    public int TotalSeats { get; set; }

    [JsonPropertyName("heldSeats")]
    public int HeldSeats { get; set; }

    [JsonPropertyName("confirmedSeats")]
    public int ConfirmedSeats { get; set; }

    [JsonPropertyName("availableSeats")]
    public int AvailableSeats { get; set; }
}

