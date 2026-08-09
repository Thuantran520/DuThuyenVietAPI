using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class PromotionsController : ControllerBase
{
    private readonly DuThuyenVietDBContext _context;

    public PromotionsController(DuThuyenVietDBContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Kiểm tra tính hợp lệ của mã giảm giá (Khách hàng)
    /// </summary>
    [HttpGet("Validate/{code}")]
    public async Task<IActionResult> ValidatePromotion(string code)
    {
        try
        {
            var promotion = await _context.Promotions
                .FirstOrDefaultAsync(p => p.Code.ToUpper() == code.ToUpper() && p.IsActive);

            if (promotion == null)
            {
                return NotFound(new { message = "Mã giảm giá không tồn tại hoặc đã bị vĩnh viễn khóa." });
            }

            var now = DateTime.Now;
            if (now < promotion.StartDate)
            {
                return BadRequest(new { message = $"Mã giảm giá chỉ bắt đầu có hiệu lực từ ngày {promotion.StartDate:dd/MM/yyyy}." });
            }

            if (now > promotion.EndDate)
            {
                return BadRequest(new { message = "Mã giảm giá này đã hết hạn sử dụng." });
            }

            return Ok(new
            {
                promotion.PromotionId,
                promotion.Code,
                promotion.Description,
                promotion.DiscountPercent,
                promotion.EndDate
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    /// <summary>
    /// Lấy danh sách tất cả khuyến mãi đang active (Public)
    /// </summary>
    [HttpGet("Active")]
    public async Task<IActionResult> GetActivePromotions()
    {
        try
        {
            var now = DateTime.Now;
            var promotions = await _context.Promotions
                .Where(p => p.IsActive && p.StartDate <= now && p.EndDate >= now)
                .Select(p => new
                {
                    p.PromotionId,
                    p.Code,
                    p.Description,
                    p.DiscountPercent,
                    p.StartDate,
                    p.EndDate
                })
                .ToListAsync();

            return Ok(promotions);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    public class CreatePromotionDTO
    {
        public string Code { get; set; } = null!;
        public string? Description { get; set; }
        public int DiscountPercent { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public bool IsActive { get; set; } = true;
    }

    /// <summary>
    /// Thêm mới mã khuyến mãi (Admin/Staff)
    /// </summary>
    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPost]
    public async Task<IActionResult> CreatePromotion([FromBody] CreatePromotionDTO dto)
    {
        try
        {
            if (dto.DiscountPercent < 0 || dto.DiscountPercent > 100)
            {
                return BadRequest(new { message = "Phần trăm giảm giá phải nằm trong khoảng từ 0% đến 100%." });
            }

            if (dto.EndDate <= dto.StartDate)
            {
                return BadRequest(new { message = "Ngày kết thúc phải lớn hơn ngày bắt đầu." });
            }

            bool exists = await _context.Promotions.AnyAsync(p => p.Code.ToUpper() == dto.Code.ToUpper());
            if (exists)
            {
                return BadRequest(new { message = "Mã khuyến mãi này đã tồn tại trên hệ thống." });
            }

            var promotion = new Promotion
            {
                Code = dto.Code.ToUpper(),
                Description = dto.Description,
                DiscountPercent = dto.DiscountPercent,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                IsActive = dto.IsActive
            };

            _context.Promotions.Add(promotion);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Tạo mã khuyến mãi thành công.", PromotionId = promotion.PromotionId });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    /// <summary>
    /// Lấy toàn bộ danh sách mã khuyến mãi (Admin/Staff)
    /// </summary>
    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpGet("All")]
    public async Task<IActionResult> GetAllPromotions()
    {
        try
        {
            var promotions = await _context.Promotions
                .OrderByDescending(p => p.PromotionId)
                .ToListAsync();

            return Ok(promotions);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }
}
