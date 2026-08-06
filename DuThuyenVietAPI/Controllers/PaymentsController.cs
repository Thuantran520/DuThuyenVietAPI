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

    public class PaymentByCodeRequestDTO
    {
        public string BookingCode { get; set; } = null!;
        public string PaymentMethod { get; set; } = null!;
    }

    [HttpPost("Process")]
    public async Task<IActionResult> ProcessPayment([FromBody] PaymentRequestDTO request)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var booking = await _context.Bookings.FindAsync(request.BookingId);

            if (booking == null) return NotFound(new { message = "Không tìm thấy đơn hàng" });
            if (booking.UserId != userId) return Forbid();
            if (booking.Status != "Pending") return BadRequest(new { message = "Đơn hàng không ở trạng thái chờ thanh toán" });

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

    [HttpPost("ProcessByCode")]
    public async Task<IActionResult> ProcessByCode([FromBody] PaymentByCodeRequestDTO request)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var bookings = await _context.Bookings
                .Where(b => b.BookingCode == request.BookingCode && b.UserId == userId)
                .ToListAsync();

            if (!bookings.Any()) return NotFound(new { message = "Không tìm thấy đơn hàng với mã này" });
            if (bookings.Any(b => b.Status != "Pending")) return BadRequest(new { message = "Một số đơn hàng không ở trạng thái chờ thanh toán" });

            bool isImmediate = request.PaymentMethod != "Cash" && request.PaymentMethod != "BankTransfer";
            string transactionCode = "TXN" + DateTime.Now.Ticks.ToString();

            foreach (var booking in bookings)
            {
                var payment = new Payment
                {
                    BookingId = booking.BookingId,
                    Amount = booking.TotalPrice,
                    PaymentMethod = request.PaymentMethod,
                    TransactionCode = transactionCode,
                    Status = isImmediate ? "Success" : "Pending",
                    PaidAt = isImmediate ? DateTime.Now : null,
                    CreatedAt = DateTime.Now
                };

                _context.Payments.Add(payment);

                booking.Status = isImmediate ? "Confirmed" : "AwaitingConfirmation";
                booking.UpdatedAt = DateTime.Now;
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            string msg = isImmediate ? "Thanh toán thành công cho toàn bộ đơn hàng!" : "Đã ghi nhận yêu cầu cho toàn bộ đơn hàng. Vui lòng chờ xác nhận!";
            return Ok(new { Message = msg, TransactionCode = transactionCode });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }
}
