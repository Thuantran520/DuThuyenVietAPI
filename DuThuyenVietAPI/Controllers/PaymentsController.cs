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

            bool isImmediate = request.PaymentMethod != "Cash" && request.PaymentMethod != "BankTransfer";

            var payment = new Payment
            {
                BookingId = booking.BookingId,
                Amount = booking.TotalPrice,
                PaymentMethod = request.PaymentMethod,
                TransactionCode = "TXN" + DateTime.Now.Ticks.ToString(),
                Status = isImmediate ? "Success" : "Pending",
                PaidAt = isImmediate ? DateTime.Now : null,
                CreatedAt = DateTime.Now
            };

            _context.Payments.Add(payment);

            // Cập nhật trạng thái Booking
            booking.Status = isImmediate ? "Confirmed" : "AwaitingConfirmation";
            booking.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            string msg = isImmediate ? "Thanh toán thành công!" : "Đã ghi nhận yêu cầu. Vui lòng chờ nhân viên xác nhận!";
            return Ok(new { Message = msg, TransactionCode = payment.TransactionCode, BookingStatus = booking.Status });
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }
}
