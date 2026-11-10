using System;
using System.Linq;
using System.Threading.Tasks;
using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class PopupAdsController : ControllerBase
{
    private readonly DuThuyenVietDBContext _context;

    public PopupAdsController(DuThuyenVietDBContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Lấy danh sách popup quảng cáo đang kích hoạt cho khách xem (Public)
    /// </summary>
    [HttpGet("Active")]
    public async Task<IActionResult> GetActiveAds()
    {
        try
        {
            var ads = await _context.PopupAds
                .AsNoTracking()
                .Where(a => a.IsActive)
                .OrderByDescending(a => a.Id)
                .ToListAsync();

            return Ok(ads);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    /// <summary>
    /// Lấy toàn bộ quảng cáo cho trang quản trị (Admin/Staff)
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "Admin,Manager,Staff")]
    public async Task<IActionResult> GetAllAds()
    {
        try
        {
            var ads = await _context.PopupAds
                .AsNoTracking()
                .OrderByDescending(a => a.Id)
                .ToListAsync();

            return Ok(ads);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    /// <summary>
    /// Lấy chi tiết 1 quảng cáo
    /// </summary>
    [HttpGet("{id}")]
    [Authorize(Roles = "Admin,Manager,Staff")]
    public async Task<IActionResult> GetAdById(int id)
    {
        var ad = await _context.PopupAds.FindAsync(id);
        if (ad == null) return NotFound(new { message = "Không tìm thấy quảng cáo." });
        return Ok(ad);
    }

    public class PopupAdDTO
    {
        public string Title { get; set; } = null!;
        public string? Description { get; set; }
        public string? ImageUrl { get; set; }
        public string? LinkUrl { get; set; }
        public string? LinkText { get; set; }
        public string? PromoCode { get; set; }
        public string Position { get; set; } = "center"; // center, bottom-right, top-banner
        public string FontFamily { get; set; } = "Inter";
        public string TitleColor { get; set; } = "#0f172a";
        public string BodyColor { get; set; } = "#475569";
        public string BackgroundColor { get; set; } = "#ffffff";
        public bool IsActive { get; set; } = true;
    }

    /// <summary>
    /// Tạo mới Popup Quảng Cáo
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin,Manager,Staff")]
    public async Task<IActionResult> CreateAd([FromBody] PopupAdDTO dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.Title))
            {
                return BadRequest(new { message = "Tiêu đề quảng cáo không được để trống." });
            }

            var ad = new PopupAd
            {
                Title = dto.Title.Trim(),
                Description = dto.Description?.Trim(),
                ImageUrl = dto.ImageUrl?.Trim(),
                LinkUrl = dto.LinkUrl?.Trim(),
                LinkText = string.IsNullOrWhiteSpace(dto.LinkText) ? "Khám phá ngay" : dto.LinkText.Trim(),
                PromoCode = dto.PromoCode?.Trim().ToUpper(),
                Position = string.IsNullOrWhiteSpace(dto.Position) ? "center" : dto.Position.Trim().ToLower(),
                FontFamily = string.IsNullOrWhiteSpace(dto.FontFamily) ? "Inter" : dto.FontFamily.Trim(),
                TitleColor = string.IsNullOrWhiteSpace(dto.TitleColor) ? "#0f172a" : dto.TitleColor.Trim(),
                BodyColor = string.IsNullOrWhiteSpace(dto.BodyColor) ? "#475569" : dto.BodyColor.Trim(),
                BackgroundColor = string.IsNullOrWhiteSpace(dto.BackgroundColor) ? "#ffffff" : dto.BackgroundColor.Trim(),
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow
            };

            _context.PopupAds.Add(ad);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Tạo popup quảng cáo thành công.", id = ad.Id });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    /// <summary>
    /// Cập nhật Popup Quảng Cáo
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Manager,Staff")]
    public async Task<IActionResult> UpdateAd(int id, [FromBody] PopupAdDTO dto)
    {
        try
        {
            var ad = await _context.PopupAds.FindAsync(id);
            if (ad == null) return NotFound(new { message = "Không tìm thấy quảng cáo." });

            if (string.IsNullOrWhiteSpace(dto.Title))
            {
                return BadRequest(new { message = "Tiêu đề quảng cáo không được để trống." });
            }

            ad.Title = dto.Title.Trim();
            ad.Description = dto.Description?.Trim();
            ad.ImageUrl = dto.ImageUrl?.Trim();
            ad.LinkUrl = dto.LinkUrl?.Trim();
            ad.LinkText = string.IsNullOrWhiteSpace(dto.LinkText) ? "Khám phá ngay" : dto.LinkText.Trim();
            ad.PromoCode = dto.PromoCode?.Trim().ToUpper();
            ad.Position = string.IsNullOrWhiteSpace(dto.Position) ? "center" : dto.Position.Trim().ToLower();
            ad.FontFamily = string.IsNullOrWhiteSpace(dto.FontFamily) ? "Inter" : dto.FontFamily.Trim();
            ad.TitleColor = string.IsNullOrWhiteSpace(dto.TitleColor) ? "#0f172a" : dto.TitleColor.Trim();
            ad.BodyColor = string.IsNullOrWhiteSpace(dto.BodyColor) ? "#475569" : dto.BodyColor.Trim();
            ad.BackgroundColor = string.IsNullOrWhiteSpace(dto.BackgroundColor) ? "#ffffff" : dto.BackgroundColor.Trim();
            ad.IsActive = dto.IsActive;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Cập nhật popup quảng cáo thành công." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    /// <summary>
    /// Bật / Tắt trạng thái hiển thị của Popup
    /// </summary>
    [HttpPatch("{id}/toggle")]
    [Authorize(Roles = "Admin,Manager,Staff")]
    public async Task<IActionResult> ToggleAdStatus(int id)
    {
        try
        {
            var ad = await _context.PopupAds.FindAsync(id);
            if (ad == null) return NotFound(new { message = "Không tìm thấy quảng cáo." });

            ad.IsActive = !ad.IsActive;
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Đã {(ad.IsActive ? "bật" : "tắt")} hiển thị quảng cáo.", isActive = ad.IsActive });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    /// <summary>
    /// Xóa Popup Quảng Cáo
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager,Staff")]
    public async Task<IActionResult> DeleteAd(int id)
    {
        try
        {
            var ad = await _context.PopupAds.FindAsync(id);
            if (ad == null) return NotFound(new { message = "Không tìm thấy quảng cáo." });

            _context.PopupAds.Remove(ad);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã xóa quảng cáo thành công." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }
}

