using System;

namespace DuThuyenVietAPI.Models;

public partial class PopupAd
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? LinkUrl { get; set; }
    public string? LinkText { get; set; }
    public string? PromoCode { get; set; }
    public string Position { get; set; } = "center"; // "center", "bottom-right", "top-banner"
    public string FontFamily { get; set; } = "Inter";
    public string TitleColor { get; set; } = "#0f172a";
    public string BodyColor { get; set; } = "#475569";
    public string BackgroundColor { get; set; } = "#ffffff";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
