using System.ComponentModel.DataAnnotations;

namespace DuThuyenVietAPI.DTOs;

public class CreateBookingDTO
{
    public string? BookingCode { get; set; }

    [Required]
    public int ScheduleId { get; set; }

    [Required]
    public int CabinTypeId { get; set; }

    [Required]
    [Range(1, 10)]
    public int NumberOfRooms { get; set; }

    [Required]
    [Range(1, 50)]
    public int NumberOfGuests { get; set; }

    [Required]
    public string ContactName { get; set; } = null!;

    [Required]
    public string ContactPhone { get; set; } = null!;

    [Required]
    [EmailAddress]
    public string ContactEmail { get; set; } = null!;

    public string? Note { get; set; }

    public string? PromotionCode { get; set; }
    public int? PromotionId { get; set; }
}
