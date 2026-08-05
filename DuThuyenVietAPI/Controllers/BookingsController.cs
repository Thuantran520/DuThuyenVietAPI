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
                return Unauthorized("Không tìm thấy thông tin người dùng.");

            // Kiểm tra Schedule và CabinType
            var schedule = await _context.Schedules.FindAsync(dto.ScheduleId);
            var cabin = await _context.CabinTypes.FindAsync(dto.CabinTypeId);

            if (schedule == null || schedule.Status != "Open" || cabin == null || cabin.CruiseId != schedule.CruiseId)
            {
                return BadRequest("Lịch trình hoặc loại phòng không hợp lệ.");
            }

            // Tính tiền
            decimal totalPrice = cabin.BasePrice * dto.NumberOfRooms;

            // Mã booking random
            string bookingCode = "BKG" + DateTime.Now.ToString("yyyyMMddHHmmss") + new Random().Next(100, 999);

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
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }

    [HttpGet("MyBookings")]
    public async Task<IActionResult> GetMyBookings()
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var bookings = await _context.Bookings
                .Include(b => b.Schedule)
                .ThenInclude(s => s.Cruise)
                .Include(b => b.CabinType)
                .Where(b => b.UserId == userId)
                .OrderByDescending(b => b.CreatedAt)
                .Select(b => new
                {
                    b.BookingId,
                    b.BookingCode,
                    CruiseName = b.Schedule.Cruise.Name,
                    CabinName = b.CabinType.Name,
                    b.Schedule.DepartureDate,
                    b.NumberOfRooms,
                    b.TotalPrice,
                    b.Status,
                    b.CreatedAt
                })
                .ToListAsync();

            return Ok(bookings);
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetBookingDetail(int id)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var booking = await _context.Bookings
                .Include(b => b.Schedule)
                .ThenInclude(s => s.Cruise)
                .Include(b => b.CabinType)
                .Include(b => b.Payments)
                .FirstOrDefaultAsync(b => b.BookingId == id);

            if (booking == null) return NotFound("Không tìm thấy đơn đặt vé.");

            // Chỉ người đặt vé hoặc Admin mới được xem
            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            if (booking.UserId != userId && role != "Admin")
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
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }

    [HttpPut("{id}/Cancel")]
    public async Task<IActionResult> CancelBooking(int id)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var booking = await _context.Bookings.FindAsync(id);

            if (booking == null) return NotFound();

            if (booking.UserId != userId) return Forbid();

            if (booking.Status != "Pending")
            {
                return BadRequest("Chỉ có thể hủy đơn đang chờ thanh toán.");
            }

            booking.Status = "Cancelled";
            booking.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Đã hủy đơn đặt vé thành công." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }
}
