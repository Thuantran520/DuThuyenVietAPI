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
    /// Hỗ trợ kiểm tra theo Ngày khởi hành chuyến đi (truyền scheduleId hoặc departureDate)
    /// </summary>
    [HttpGet("Validate/{code}")]
    public async Task<IActionResult> ValidatePromotion(
        string code,
        [FromQuery] int? scheduleId = null,
        [FromQuery] DateTime? departureDate = null)
    {
        try
        {
            var promotion = await _context.Promotions
                .FirstOrDefaultAsync(p => p.Code.ToUpper() == code.ToUpper() && p.IsActive);

            if (promotion == null)
            {
                return NotFound(new { message = "Mã giảm giá không tồn tại hoặc đã bị khóa." });
            }

            var now = DateTime.Now;

            // 1. Kiểm tra ngày đặt hàng (thời điểm bấm áp mã)
            if (now.Date < promotion.StartDate.Date)
            {
                return BadRequest(new { message = $"Mã giảm giá chỉ bắt đầu có hiệu lực từ ngày {promotion.StartDate:dd/MM/yyyy}." });
            }

            if (now.Date > promotion.EndDate.Date)
            {
                return BadRequest(new { message = "Mã giảm giá này đã hết hạn sử dụng." });
            }

            // 2. Xác định ngày khởi hành để kiểm tra (nếu có truyền scheduleId hoặc departureDate)
            DateTime? targetDepartureDate = departureDate;

            if (!targetDepartureDate.HasValue && scheduleId.HasValue)
            {
                var schedule = await _context.Schedules.FindAsync(scheduleId.Value);
                if (schedule != null)
                {
                    targetDepartureDate = schedule.DepartureDate;
                }
            }

            // 3. Kiểm tra Ngày khởi hành với thời hạn của mã
            if (targetDepartureDate.HasValue)
            {
                if (targetDepartureDate.Value.Date < promotion.StartDate.Date ||
                    targetDepartureDate.Value.Date > promotion.EndDate.Date)
                {
                    return BadRequest(new
                    {
                        message = $"Mã giảm giá này chỉ áp dụng cho chuyến đi khởi hành từ {promotion.StartDate:dd/MM/yyyy} đến {promotion.EndDate:dd/MM/yyyy}."
                    });
                }
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
    /// Thêm mới mã khuyến mãi (Chỉ duy nhất Admin)
    /// </summary>
    [Authorize(Roles = "Admin")]
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
    /// Lấy toàn bộ danh sách mã khuyến mãi (Chỉ duy nhất Admin)
    /// </summary>
    [Authorize(Roles = "Admin")]
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

    /// <summary>
    /// Cập nhật mã khuyến mãi
    /// </summary>
    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePromotion(int id, [FromBody] CreatePromotionDTO dto)
    {
        try
        {
            var promotion = await _context.Promotions.FindAsync(id);
            if (promotion == null) return NotFound(new { message = "Không tìm thấy mã khuyến mãi." });

            if (dto.DiscountPercent < 0 || dto.DiscountPercent > 100)
                return BadRequest(new { message = "Phần trăm giảm giá phải từ 0% đến 100%." });

            if (dto.EndDate <= dto.StartDate)
                return BadRequest(new { message = "Ngày kết thúc phải lớn hơn ngày bắt đầu." });

            promotion.Code = dto.Code.ToUpper();
            promotion.Description = dto.Description;
            promotion.DiscountPercent = dto.DiscountPercent;
            promotion.StartDate = dto.StartDate;
            promotion.EndDate = dto.EndDate;
            promotion.IsActive = dto.IsActive;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã cập nhật mã khuyến mãi." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    /// <summary>
    /// Xóa mã khuyến mãi
    /// </summary>
    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePromotion(int id)
    {
        try
        {
            var promotion = await _context.Promotions.FindAsync(id);
            if (promotion == null) return NotFound(new { message = "Không tìm thấy mã khuyến mãi." });

            _context.Promotions.Remove(promotion);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã xóa mã khuyến mãi." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }
}