using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ReviewsController : ControllerBase
{
    private readonly DuThuyenVietDBContext _context;

    public ReviewsController(DuThuyenVietDBContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Lấy tất cả reviews của một du thuyền (public)
    /// </summary>
    [HttpGet("Cruise/{cruiseId}")]
    public async Task<IActionResult> GetReviewsByCruise(int cruiseId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        try
        {
            var query = _context.Reviews
                .Where(r => r.CruiseId == cruiseId)
                .OrderByDescending(r => r.CreatedAt);

            int total = await query.CountAsync();
            double avgRating = total > 0 ? await query.AverageAsync(r => r.Rating) : 0;

            var reviews = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Join(_context.Users, r => r.UserId, u => u.Id, (r, u) => new
                {
                    r.ReviewId,
                    r.Rating,
                    r.Comment,
                    r.StaffReply,
                    r.CreatedAt,
                    UserName = u.FullName ?? u.UserName ?? "Khách hàng"
                })
                .ToListAsync();

            return Ok(new
            {
                Reviews = reviews,
                Total = total,
                TotalPages = (int)Math.Ceiling((double)total / pageSize),
                CurrentPage = page,
                AverageRating = Math.Round(avgRating, 1)
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }

    public class CreateReviewDTO
    {
        public int CruiseId { get; set; }
        public int? BookingId { get; set; }
        public int Rating { get; set; }
        public string Comment { get; set; } = null!;
    }

    /// <summary>
    /// Gửi đánh giá mới (yêu cầu đăng nhập)
    /// </summary>
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CreateReview([FromBody] CreateReviewDTO dto)
    {
        try
        {
            if (dto.Rating < 1 || dto.Rating > 5)
                return BadRequest("Điểm đánh giá phải từ 1 đến 5.");
            if (string.IsNullOrWhiteSpace(dto.Comment))
                return BadRequest("Vui lòng nhập nội dung đánh giá.");

            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            // Kiểm tra du thuyền tồn tại
            var cruise = await _context.Cruises.FindAsync(dto.CruiseId);
            if (cruise == null) return NotFound("Du thuyền không tồn tại.");

            // Kiểm tra đã review chưa (1 người chỉ review 1 lần / du thuyền)
            var existing = await _context.Reviews
                .FirstOrDefaultAsync(r => r.CruiseId == dto.CruiseId && r.UserId == userId);
            if (existing != null)
                return BadRequest("Bạn đã đánh giá du thuyền này rồi.");

            // Nếu có BookingId, kiểm tra booking hợp lệ và thuộc user này
            if (dto.BookingId.HasValue)
            {
                var booking = await _context.Bookings.FindAsync(dto.BookingId.Value);
                if (booking == null || booking.UserId != userId)
                    return BadRequest("Mã đặt chỗ không hợp lệ.");
            }

            var review = new Review
            {
                CruiseId = dto.CruiseId,
                UserId = userId,
                BookingId = dto.BookingId,
                Rating = dto.Rating,
                Comment = dto.Comment.Trim(),
                CreatedAt = DateTime.Now
            };

            _context.Reviews.Add(review);

            // Cập nhật AverageRating và ReviewCount trong Cruise
            int currentCount = cruise.ReviewCount;
            double currentAvg = (double)cruise.AverageRating;
            cruise.ReviewCount = currentCount + 1;
            cruise.AverageRating = (decimal)Math.Round((currentAvg * currentCount + dto.Rating) / (currentCount + 1), 1);

            await _context.SaveChangesAsync();

            return Ok(new { Message = "Cảm ơn bạn đã đánh giá!", ReviewId = review.ReviewId });
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }

    /// <summary>
    /// Kiểm tra user hiện tại đã review du thuyền chưa
    /// </summary>
    [Authorize]
    [HttpGet("CanReview/{cruiseId}")]
    public async Task<IActionResult> CanReview(int cruiseId)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            // Đã review chưa?
            bool alreadyReviewed = await _context.Reviews
                .AnyAsync(r => r.CruiseId == cruiseId && r.UserId == userId);

            if (alreadyReviewed)
                return Ok(new { CanReview = false, Reason = "Bạn đã đánh giá du thuyền này rồi." });

            var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
            bool isStaff = roles.Contains("Admin") || roles.Contains("Manager") || roles.Contains("Staff");

            // Có đặt phòng Confirmed cho du thuyền này chưa?
            bool hasConfirmedBooking = await _context.Bookings
                .Include(b => b.Schedule)
                .AnyAsync(b => b.UserId == userId
                    && b.Schedule.CruiseId == cruiseId
                    && (b.Status == "Confirmed" || b.Status == "AwaitingConfirmation"));

            bool canReview = isStaff || hasConfirmedBooking;

            return Ok(new
            {
                CanReview = canReview,
                Reason = canReview ? null : "Bạn cần có đặt chỗ thành công để đánh giá."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }

    /// <summary>
    /// Chỉnh sửa đánh giá (chính chủ)
    /// </summary>
    [Authorize]
    [HttpPut("{id}")]
    public async Task<IActionResult> EditReview(int id, [FromBody] CreateReviewDTO dto)
    {
        try
        {
            if (dto.Rating < 1 || dto.Rating > 5) return BadRequest("Điểm đánh giá phải từ 1 đến 5.");
            if (string.IsNullOrWhiteSpace(dto.Comment)) return BadRequest("Vui lòng nhập nội dung đánh giá.");

            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var review = await _context.Reviews.Include(r => r.Cruise).FirstOrDefaultAsync(r => r.ReviewId == id);
            
            if (review == null) return NotFound("Không tìm thấy đánh giá.");
            if (review.UserId != userId) return Forbid("Bạn không có quyền sửa đánh giá này.");

            int oldRating = review.Rating;
            review.Rating = dto.Rating;
            review.Comment = dto.Comment;
            
            // Cập nhật điểm trung bình nếu thay đổi rating
            if (oldRating != dto.Rating && review.Cruise != null)
            {
                double currentTotal = (double)review.Cruise.AverageRating * review.Cruise.ReviewCount;
                double newTotal = currentTotal - oldRating + dto.Rating;
                review.Cruise.AverageRating = (decimal)Math.Round(newTotal / review.Cruise.ReviewCount, 1);
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Đã cập nhật đánh giá." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }

    public class ReplyDTO
    {
        public string ReplyText { get; set; } = null!;
    }

    /// <summary>
    /// Nhân viên trả lời đánh giá
    /// </summary>
    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPut("{id}/reply")]
    public async Task<IActionResult> ReplyReview(int id, [FromBody] ReplyDTO dto)
    {
        try
        {
            var review = await _context.Reviews.FindAsync(id);
            if (review == null) return NotFound("Không tìm thấy đánh giá.");

            review.StaffReply = dto.ReplyText;
            await _context.SaveChangesAsync();
            return Ok(new { Message = "Đã phản hồi đánh giá." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }

    /// <summary>
    /// Xóa review (admin/manager hoặc chính chủ)
    /// </summary>
    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteReview(int id)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var review = await _context.Reviews
                .Include(r => r.Cruise)
                .FirstOrDefaultAsync(r => r.ReviewId == id);

            if (review == null) return NotFound("Không tìm thấy đánh giá.");

            bool isStaff = User.IsInRole("Admin") || User.IsInRole("Manager");
            if (review.UserId != userId && !isStaff)
                return Forbid("Bạn không có quyền xóa đánh giá này.");

            _context.Reviews.Remove(review);

            // Cập nhật lại AverageRating và ReviewCount
            var cruise = review.Cruise;
            if (cruise != null && cruise.ReviewCount > 0)
            {
                if (cruise.ReviewCount == 1)
                {
                    cruise.ReviewCount = 0;
                    cruise.AverageRating = 0;
                }
                else
                {
                    double currentAvg = (double)cruise.AverageRating;
                    int newCount = cruise.ReviewCount - 1;
                    double newAvg = (currentAvg * cruise.ReviewCount - review.Rating) / newCount;
                    cruise.ReviewCount = newCount;
                    cruise.AverageRating = (decimal)Math.Round(newAvg, 1);
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { Message = "Đã xóa đánh giá." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }
}
