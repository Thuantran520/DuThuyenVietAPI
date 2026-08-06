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
            decimal totalPrice = unitPrice * dto.NumberOfRooms;

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
                Note = dto.Note,
                TotalPrice = totalPrice,
                Status = "Pending", // Đợi thanh toán
                CreatedAt = DateTime.Now
            };

            _context.Bookings.Add(booking);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Đặt vé thành công", BookingId = booking.BookingId, BookingCode = bookingCode });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
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
                    CruiseName = b.Schedule != null && b.Schedule.Cruise != null ? b.Schedule.Cruise.Name : "Không xác định",
                    CabinName = b.CabinType != null ? b.CabinType.Name : "Không xác định",
                    DepartureDate = b.Schedule != null ? b.Schedule.DepartureDate : (DateTime?)null,
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

            if (booking.Status != "Pending")
            {
                return BadRequest(new { message = "Chỉ có thể hủy đơn đang chờ thanh toán." });
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
