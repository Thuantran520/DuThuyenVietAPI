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
            // Lấy thông tin mã giảm giá (AsNoTracking để truy vấn trực tiếp từ DB)
            var promotion = await _context.Promotions
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Code.ToUpper() == code.ToUpper() && p.IsActive);

            if (promotion == null)
            {
                return NotFound(new { message = "Mã giảm giá không tồn tại hoặc đã bị khóa." });
            }

            var now = DateTime.Now;

            // 1. Kiểm tra ngày đặt hàng (thời điểm người dùng bấm áp mã)
            if (now.Date < promotion.StartDate.Date)
            {
                return BadRequest(new { message = $"Mã giảm giá chỉ bắt đầu có hiệu lực từ ngày {promotion.StartDate:dd/MM/yyyy}." });
            }

            if (promotion.EndDate.HasValue && now.Date > promotion.EndDate.Value.Date)
            {
                return BadRequest(new { message = "Mã giảm giá này đã hết hạn sử dụng." });
            }

            // 1b. Kiểm tra giới hạn số lượt sử dụng
            if (promotion.UsageLimit.HasValue && promotion.UsageLimit.Value > 0 && promotion.UsedCount >= promotion.UsageLimit.Value)
            {
                return BadRequest(new { message = $"Mã giảm giá này đã hết lượt sử dụng ({promotion.UsedCount}/{promotion.UsageLimit.Value} lượt)." });
            }

            // 1c. Kiểm tra nếu khách hàng đã sử dụng mã này 1 lần rồi
            if (User.Identity?.IsAuthenticated == true)
            {
                var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!string.IsNullOrEmpty(userId))
                {
                    var hasUsed = await _context.Bookings.AnyAsync(b => b.UserId == userId && b.PromotionId == promotion.PromotionId && b.Status != "Cancelled");
                    if (hasUsed)
                    {
                        return BadRequest(new { message = "Mã ưu đãi này chỉ áp dụng 1 lần cho mỗi khách hàng. Bạn đã sử dụng mã này trong một đơn đặt trước đó." });
                    }
                }
            }

            // 2. Xác định ngày khởi hành để kiểm tra
            DateTime? targetDepartureDate = departureDate;

            if (scheduleId.HasValue)
            {
                var schedule = await _context.Schedules
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.ScheduleId == scheduleId.Value);

                if (schedule == null)
                {
                    return NotFound(new { message = "Lịch trình chuyến đi không tồn tại trên hệ thống." });
                }

                targetDepartureDate = schedule.DepartureDate;
            }

            // 3. Kiểm tra Ngày khởi hành với điều kiện mã
            if (targetDepartureDate.HasValue)
            {
                // Chặn nếu chuyến đi đã khởi hành trong quá khứ
                if (targetDepartureDate.Value.Date < now.Date)
                {
                    return BadRequest(new
                    {
                        message = $"Chuyến đi này đã khởi hành từ ngày {targetDepartureDate.Value:dd/MM/yyyy}. Không thể áp dụng mã hoặc đặt vé."
                    });
                }

                // Đã loại bỏ ràng buộc ngày khởi hành phải nằm trong thời gian khuyến mãi theo yêu cầu người dùng.
                // Mã giảm giá chỉ phụ thuộc vào thời điểm đặt vé (real-time).
            }

            return Ok(new
            {
                promotion.PromotionId,
                promotion.Code,
                promotion.Description,
                promotion.DiscountPercent,
                promotion.StartDate,
                promotion.EndDate,
                isPermanent = !promotion.EndDate.HasValue,
                usageLimit = promotion.UsageLimit,
                usedCount = promotion.UsedCount,
                remainingUses = promotion.UsageLimit.HasValue ? Math.Max(0, promotion.UsageLimit.Value - promotion.UsedCount) : (int?)null,
                isValid = true
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
                .AsNoTracking()
                .Where(p => p.IsActive && p.StartDate.Date <= now.Date && (!p.EndDate.HasValue || p.EndDate.Value.Date >= now.Date) && (!p.UsageLimit.HasValue || p.UsedCount < p.UsageLimit.Value))
                .Select(p => new
                {
                    p.PromotionId,
                    p.Code,
                    p.Description,
                    p.DiscountPercent,
                    p.StartDate,
                    p.EndDate,
                    p.UsageLimit,
                    p.UsedCount,
                    isPermanent = !p.EndDate.HasValue,
                    remainingUses = p.UsageLimit.HasValue ? Math.Max(0, p.UsageLimit.Value - p.UsedCount) : (int?)null
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
        public DateTime? EndDate { get; set; }
        public bool IsPermanent { get; set; } = false;
        public int? UsageLimit { get; set; } // Giới hạn lượt dùng (null hoặc <= 0 là không giới hạn)
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

            DateTime? finalEndDate = dto.IsPermanent ? null : dto.EndDate;

            if (finalEndDate.HasValue && finalEndDate.Value <= dto.StartDate)
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
                EndDate = finalEndDate,
                UsageLimit = (dto.UsageLimit.HasValue && dto.UsageLimit.Value > 0) ? dto.UsageLimit.Value : null,
                UsedCount = 0,
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
                .AsNoTracking()
                .Where(p => p.Description == null || !p.Description.StartsWith("[DELETED]"))
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

            DateTime? finalEndDate = dto.IsPermanent ? null : dto.EndDate;

            if (finalEndDate.HasValue && finalEndDate.Value <= dto.StartDate)
                return BadRequest(new { message = "Ngày kết thúc phải lớn hơn ngày bắt đầu." });

            bool codeExists = await _context.Promotions.AnyAsync(p => p.Code.ToUpper() == dto.Code.ToUpper() && p.PromotionId != id);
            if (codeExists)
            {
                return BadRequest(new { message = "Mã khuyến mãi này đã trùng với một mã khác trên hệ thống." });
            }

            promotion.Code = dto.Code.ToUpper();
            promotion.Description = dto.Description;
            promotion.DiscountPercent = dto.DiscountPercent;
            promotion.StartDate = dto.StartDate;
            promotion.EndDate = finalEndDate;
            promotion.UsageLimit = (dto.UsageLimit.HasValue && dto.UsageLimit.Value > 0) ? dto.UsageLimit.Value : null;
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
            var promotion = await _context.Promotions.Include(p => p.Bookings).FirstOrDefaultAsync(p => p.PromotionId == id);
            if (promotion == null) return NotFound(new { message = "Không tìm thấy mã khuyến mãi." });

            if (promotion.Bookings.Any())
            {
                promotion.IsActive = false;
                promotion.Description = "[DELETED] " + promotion.Description;
                await _context.SaveChangesAsync();
                return Ok(new { message = "Mã khuyến mãi đã có người dùng, đã được đưa vào lưu trữ lịch sử thay vì xóa hoàn toàn." });
            }

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