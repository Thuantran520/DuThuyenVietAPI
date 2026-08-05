using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class PaymentsController : ControllerBase
{
    private readonly DuThuyenVietDBContext _context;

    public PaymentsController(DuThuyenVietDBContext context)
    {
        _context = context;
    }

    public class PaymentRequestDTO
    {
        public int BookingId { get; set; }
        public string PaymentMethod { get; set; } = null!;
    }

    [HttpPost("Process")]
    public async Task<IActionResult> ProcessPayment([FromBody] PaymentRequestDTO request)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var booking = await _context.Bookings.FindAsync(request.BookingId);

            if (booking == null) return NotFound("Không tìm thấy đơn hàng");
            if (booking.UserId != userId) return Forbid();
            if (booking.Status != "Pending") return BadRequest("Đơn hàng không ở trạng thái chờ thanh toán");

            // Mock thanh toán luôn thành công cho mục đích đồ án
            var payment = new Payment
            {
                BookingId = booking.BookingId,
                Amount = booking.TotalPrice,
                PaymentMethod = request.PaymentMethod,
                TransactionCode = "TXN" + DateTime.Now.Ticks.ToString(),
                Status = "Success",
                PaidAt = DateTime.Now,
                CreatedAt = DateTime.Now
            };

            _context.Payments.Add(payment);

            // Cập nhật trạng thái Booking
            booking.Status = "Confirmed";
            booking.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new { Message = "Thanh toán thành công!", TransactionCode = payment.TransactionCode });
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }
}
