using DuThuyenVietAPI.DTOs;
using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize] // Chỉ người dùng đăng nhập mới được đặt vé
public class BookingsController : ControllerBase
{
    private readonly DuThuyenVietDBContext _context;

    public BookingsController(DuThuyenVietDBContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingDTO dto)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Không tìm thấy thông tin người dùng." });

            // Kiểm tra Schedule và CabinType
            var schedule = await _context.Schedules.FindAsync(dto.ScheduleId);
            var cabin = await _context.CabinTypes.FindAsync(dto.CabinTypeId);

            bool isStatusValid = schedule != null && schedule.Status != null &&
                                 (schedule.Status.Equals("Open", StringComparison.OrdinalIgnoreCase) ||
                                  schedule.Status.Equals("Available", StringComparison.OrdinalIgnoreCase));

            if (schedule == null || !isStatusValid || cabin == null || cabin.CruiseId != schedule.CruiseId)
            {
                string reason = "";
                if (schedule == null) reason += " Không tìm thấy lịch trình.";
                else if (!isStatusValid) reason += $" Trạng thái lịch trình là '{schedule.Status}' (yêu cầu 'Open' hoặc 'Available').";
                if (cabin == null) reason += " Không tìm thấy loại phòng.";
                else if (schedule != null && cabin.CruiseId != schedule.CruiseId) reason += $" Phòng thuộc CruiseId={cabin.CruiseId} nhưng lịch trình thuộc CruiseId={schedule.CruiseId}.";

                return BadRequest(new { message = "Lịch trình hoặc loại phòng không hợp lệ." + reason });
            }

            // Kiểm tra tồn kho phòng (ScheduleCabinInventory) — chống bán vượt số phòng
            var inventory = await _context.ScheduleCabinInventories
                .FirstOrDefaultAsync(i => i.ScheduleId == dto.ScheduleId && i.CabinTypeId == dto.CabinTypeId);

            if (inventory != null)
            {
                if (inventory.AvailableRooms < dto.NumberOfRooms)
                    return BadRequest(new { message = $"Chỉ còn {inventory.AvailableRooms} phòng trống. Vui lòng điều chỉnh số lượng." });

                // Trừ số phòng còn lại
                inventory.AvailableRooms -= dto.NumberOfRooms;
            }

            // Tính tiền (ưu tiên PriceOverride từ tồn kho nếu có, nếu không dùng giá gốc)
            decimal unitPrice = inventory?.PriceOverride ?? cabin.BasePrice;
            decimal rawTotalPrice = unitPrice * dto.NumberOfRooms;
            decimal finalTotalPrice = rawTotalPrice;
            int? appliedPromotionId = dto.PromotionId;

            // Xử lý mã giảm giá (Promotion)
            if (!string.IsNullOrWhiteSpace(dto.PromotionCode))
            {
                var promotion = await _context.Promotions
                    .FirstOrDefaultAsync(p => p.Code.ToUpper() == dto.PromotionCode.ToUpper() && p.IsActive);

                if (promotion == null)
                {
                    return BadRequest(new { message = "Mã giảm giá không tồn tại hoặc đã bị khóa." });
                }

                var now = DateTime.Now;

                // 1. Kiểm tra thời điểm bấm đặt phòng
                if (now < promotion.StartDate)
                {
                    return BadRequest(new { message = $"Mã giảm giá chỉ bắt đầu có hiệu lực từ ngày {promotion.StartDate:MM/dd/yyyy}." });
                }

                if (now > promotion.EndDate)
                {
                    return BadRequest(new { message = "Mã giảm giá này đã hết hạn sử dụng." });
                }

                // 2. Đã loại bỏ ràng buộc ngày khởi hành phải nằm trong khoảng thời gian khuyến mãi.

                appliedPromotionId = promotion.PromotionId;
                decimal discountAmount = rawTotalPrice * promotion.DiscountPercent / 100m;
                finalTotalPrice = rawTotalPrice - discountAmount;
            }

            // Sử dụng mã booking từ frontend nếu có, nếu không thì tạo mới
            string bookingCode = !string.IsNullOrEmpty(dto.BookingCode)
                ? dto.BookingCode
                : "BKG" + DateTime.Now.ToString("yyyyMMddHHmmss") + new Random().Next(100, 999);

            var booking = new Booking
            {
                BookingCode = bookingCode,
                UserId = userId,
                ScheduleId = dto.ScheduleId,
                CabinTypeId = dto.CabinTypeId,
                NumberOfRooms = dto.NumberOfRooms,
                NumberOfGuests = dto.NumberOfGuests,
                ContactName = dto.ContactName,
                ContactPhone = dto.ContactPhone,
                ContactEmail = dto.ContactEmail,
                Note = dto.Note ?? "",
                TotalPrice = finalTotalPrice,
                PromotionId = appliedPromotionId,
                Status = "Pending", // Đợi thanh toán
                CreatedAt = DateTime.Now
            };

            _context.Bookings.Add(booking);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Đặt vé thành công", BookingId = booking.BookingId, BookingCode = bookingCode });
        }
        catch (Exception ex)
        {
            var innerMsg = ex.InnerException != null ? ex.InnerException.Message : "";
            return StatusCode(500, new { message = $"Lỗi server: {ex.Message}. Chi tiết: {innerMsg}" });
        }
    }

    [HttpGet("MyBookings")]
    public async Task<IActionResult> GetMyBookings()
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Không tìm thấy thông tin người dùng." });

            var bookings = await _context.Bookings
                .Include(b => b.Schedule)
                .ThenInclude(s => s.Cruise)
                .Include(b => b.CabinType)
                .Include(b => b.Payments)
                .Where(b => b.UserId == userId)
                .OrderByDescending(b => b.CreatedAt)
                .Select(b => new
                {
                    b.BookingId,
                    b.BookingCode,
                    b.ContactName,
                    b.ContactPhone,
                    b.Note,
                    CruiseId = b.Schedule != null ? b.Schedule.CruiseId : 0,
                    CruiseName = b.Schedule != null && b.Schedule.Cruise != null ? b.Schedule.Cruise.Name : "Không xác định",
                    CabinName = b.CabinType != null ? b.CabinType.Name : "Không xác định",
                    DepartureDate = b.Schedule != null ? b.Schedule.DepartureDate : (DateTime?)null,
                    ReturnDate = b.Schedule != null ? b.Schedule.ReturnDate : (DateTime?)null,
                    b.NumberOfRooms,
                    b.TotalPrice,
                    b.Status,
                    b.CreatedAt,
                    Payments = b.Payments.Select(p => new { p.PaymentMethod, p.PaidAt, p.Status, p.TransactionCode })
                })
                .ToListAsync();

            return Ok(bookings);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetBookingDetail(int id)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "Không tìm thấy thông tin người dùng." });

            var booking = await _context.Bookings
                .Include(b => b.Schedule)
                .ThenInclude(s => s.Cruise)
                .Include(b => b.CabinType)
                .Include(b => b.Payments)
                .FirstOrDefaultAsync(b => b.BookingId == id);

            if (booking == null) return NotFound(new { message = "Không tìm thấy đơn đặt vé." });

            // Check if user is staff/admin
            bool isStaff = User.IsInRole("Admin") || User.IsInRole("Manager") || User.IsInRole("Staff");

            // Chỉ người đặt vé hoặc Staff/Admin mới được xem
            if (booking.UserId != userId && !isStaff)
            {
                return Forbid("Bạn không có quyền xem đơn này.");
            }

            return Ok(new
            {
                booking.BookingId,
                booking.BookingCode,
                booking.ContactName,
                booking.ContactPhone,
                booking.ContactEmail,
                booking.NumberOfRooms,
                booking.NumberOfGuests,
                booking.Note,
                booking.TotalPrice,
                booking.Status,
                booking.CreatedAt,
                CruiseName = booking.Schedule.Cruise.Name,
                CabinName = booking.CabinType.Name,
                booking.Schedule.DepartureDate,
                Payments = booking.Payments.Select(p => new
                {
                    p.PaymentMethod,
                    p.Amount,
                    p.Status,
                    p.PaidAt
                })
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpGet("All")]
    public async Task<IActionResult> GetAllBookings()
    {
        try
        {
            var bookings = await _context.Bookings
                .Include(b => b.Schedule)
                .ThenInclude(s => s.Cruise)
                .Include(b => b.CabinType)
                .Include(b => b.Payments)
                .OrderByDescending(b => b.CreatedAt)
                .Select(b => new
                {
                    b.BookingId,
                    b.BookingCode,
                    b.ContactName,
                    b.ContactPhone,
                    b.ContactEmail,
                    b.Note,
                    b.NumberOfGuests,
                    CruiseId = b.Schedule != null ? b.Schedule.CruiseId : 0,
                    CruiseName = b.Schedule != null && b.Schedule.Cruise != null ? b.Schedule.Cruise.Name : "Không xác định",
                    CabinName = b.CabinType != null ? b.CabinType.Name : "Không xác định",
                    DepartureDate = b.Schedule != null ? b.Schedule.DepartureDate : (DateTime?)null,
                    b.NumberOfRooms,
                    b.TotalPrice,
                    b.Status,
                    b.CreatedAt,
                    Payments = b.Payments.Select(p => new
                    {
                        p.PaymentMethod,
                        p.TransactionCode,
                        p.Status,
                        p.PaidAt
                    })
                })
                .ToListAsync();

            return Ok(bookings);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    public class UpdateBookingStatusDTO
    {
        public string Status { get; set; } = null!;
    }

    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPut("{id}/Status")]
    public async Task<IActionResult> UpdateBookingStatus(int id, [FromBody] UpdateBookingStatusDTO dto)
    {
        try
        {
            var booking = await _context.Bookings.FindAsync(id);
            if (booking == null) return NotFound(new { message = "Không tìm thấy đơn hàng" });

            booking.Status = dto.Status;
            booking.UpdatedAt = DateTime.Now;

            // Also update payment status if confirmed
            if (dto.Status == "Confirmed")
            {
                var payment = await _context.Payments.FirstOrDefaultAsync(p => p.BookingId == id);
                if (payment != null && payment.Status == "Pending")
                {
                    payment.Status = "Success";
                    payment.PaidAt = DateTime.Now;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Đã cập nhật trạng thái đơn hàng." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    [HttpPut("{id}/Cancel")]
    public async Task<IActionResult> CancelBooking(int id)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var booking = await _context.Bookings.FindAsync(id);

            if (booking == null) return NotFound(new { message = "Không tìm thấy đơn đặt vé." });

            if (booking.UserId != userId) return Forbid();

            // CHỈ CHO PHÉP HỦY KHI ĐƠN CHƯA ĐƯỢC ADMIN XÁC NHẬN (Status: Pending hoặc AwaitingConfirmation)
            if (booking.Status == "Confirmed")
            {
                return BadRequest(new { message = "Đơn hàng đã được Admin xác nhận thành công, khách hàng không thể tự hủy!" });
            }

            if (booking.Status == "Cancelled")
            {
                return BadRequest(new { message = "Đơn hàng đã bị hủy trước đó." });
            }

            // Hoàn lại số phòng vào tồn kho khi hủy thành công
            var inventory = await _context.ScheduleCabinInventories
                .FirstOrDefaultAsync(i => i.ScheduleId == booking.ScheduleId && i.CabinTypeId == booking.CabinTypeId);
            if (inventory != null)
            {
                inventory.AvailableRooms += booking.NumberOfRooms;
            }

            booking.Status = "Cancelled";
            booking.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Đã hủy đơn đặt vé thành công." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }
}