using DuThuyenVietAPI.Models;
using DuThuyenVietAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class PaymentsController : ControllerBase
{
    private readonly DuThuyenVietDBContext _context;
    private readonly IConfiguration _configuration;

    public PaymentsController(DuThuyenVietDBContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    public class PaymentRequestDTO
    {
        public int BookingId { get; set; }
        public string PaymentMethod { get; set; } = null!;
    }

    [HttpPost("Process")]
    [Authorize]
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

    // ==========================================
    // 💳 TÍCH HỢP CỔNG VNPAY SANDBOX
    // ==========================================

    [HttpGet("create-vnpay-url")]
    [Authorize]
    public async Task<IActionResult> CreateVnPayUrl([FromQuery] int? bookingId, [FromQuery] string? bookingCode)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            
            var query = _context.Bookings.AsQueryable();
            if (bookingId.HasValue && bookingId.Value > 0)
            {
                query = query.Where(b => b.BookingId == bookingId.Value);
            }
            else if (!string.IsNullOrEmpty(bookingCode))
            {
                query = query.Where(b => b.BookingCode == bookingCode);
            }
            else
            {
                return BadRequest(new { message = "Thiếu thông tin đơn đặt vé." });
            }

            var booking = await query.FirstOrDefaultAsync();

            if (booking == null) 
                return NotFound(new { message = "Không tìm thấy đơn đặt vé." });
                
            if (!string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(booking.UserId) && booking.UserId != userId) 
                return StatusCode(403, new { message = "Bạn không có quyền thanh toán đơn đặt vé này." });
                
            if (!string.Equals(booking.Status, "Pending", StringComparison.OrdinalIgnoreCase)) 
                return BadRequest(new { message = $"Đơn đặt vé này không ở trạng thái chờ thanh toán (Trạng thái hiện tại: {booking.Status})." });

            var tmnCode = _configuration["VnPay:TmnCode"] ?? "J914ZYDG";
            var hashSecret = _configuration["VnPay:HashSecret"] ?? "STQJECRYLUKAESMZXXVIZKUCMEGJOORU";
            var baseUrl = _configuration["VnPay:BaseUrl"] ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
            var returnUrl = _configuration["VnPay:ReturnUrl"] ?? "https://localhost:7137/api/Payments/vnpay-return";

            var vnpay = new VnPayLibrary();
            vnpay.AddRequestData("vnp_Version", "2.1.0");
            vnpay.AddRequestData("vnp_Command", "pay");
            vnpay.AddRequestData("vnp_TmnCode", tmnCode);
            vnpay.AddRequestData("vnp_Amount", ((long)(booking.TotalPrice * 100)).ToString());
            vnpay.AddRequestData("vnp_CreateDate", DateTime.Now.ToString("yyyyMMddHHmmss"));
            vnpay.AddRequestData("vnp_CurrCode", "VND");
            vnpay.AddRequestData("vnp_IpAddr", VnPayLibrary.GetIpAddress(HttpContext));
            vnpay.AddRequestData("vnp_Locale", "vn");
            vnpay.AddRequestData("vnp_OrderInfo", $"Thanh toan ve {booking.BookingCode}");
            vnpay.AddRequestData("vnp_OrderType", "other");
            vnpay.AddRequestData("vnp_ReturnUrl", returnUrl);
            vnpay.AddRequestData("vnp_TxnRef", $"{booking.BookingId}_{DateTime.Now.Ticks}");

            var paymentUrl = vnpay.CreateRequestUrl(baseUrl, hashSecret);

            return Ok(new { paymentUrl });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi tạo URL VNPAY: " + ex.Message });
        }
    }

    [HttpGet("vnpay-return")]
    [AllowAnonymous]
    public async Task<IActionResult> VnPayReturn()
    {
        var hashSecret = _configuration["VnPay:HashSecret"] ?? "STQJECRYLUKAESMZXXVIZKUCMEGJOORU";
        var vnpay = new VnPayLibrary();

        foreach (var (key, value) in Request.Query)
        {
            if (!string.IsNullOrEmpty(key) && key.StartsWith("vnp_"))
            {
                vnpay.AddResponseData(key, value.ToString());
            }
        }

        var vnp_ResponseCode = vnpay.GetResponseData("vnp_ResponseCode");
        var vnp_SecureHash = Request.Query["vnp_SecureHash"].ToString();
        var vnp_TxnRef = vnpay.GetResponseData("vnp_TxnRef");
        var vnp_TransactionNo = vnpay.GetResponseData("vnp_TransactionNo");

        bool checkSignature = vnpay.ValidateSignature(vnp_SecureHash, hashSecret);

        if (!checkSignature)
        {
            return Redirect("/history.html?payment=error&message=SaiChuKySo");
        }

        // Tách BookingId từ TxnRef (định dạng: bookingId_ticks)
        int bookingId = 0;
        if (!string.IsNullOrEmpty(vnp_TxnRef) && vnp_TxnRef.Contains('_'))
        {
            int.TryParse(vnp_TxnRef.Split('_')[0], out bookingId);
        }

        var booking = await _context.Bookings.FindAsync(bookingId);
        if (booking == null)
        {
            return Redirect("/history.html?payment=error&message=KhongTimThayDon");
        }

        if (vnp_ResponseCode == "00")
        {
            // Giao dịch thành công
            booking.Status = "Confirmed";
            booking.UpdatedAt = DateTime.Now;

            var payment = new Payment
            {
                BookingId = booking.BookingId,
                Amount = booking.TotalPrice,
                PaymentMethod = "VNPAY",
                TransactionCode = "VNP" + vnp_TransactionNo,
                Status = "Success",
                PaidAt = DateTime.Now,
                CreatedAt = DateTime.Now
            };

            _context.Payments.Add(payment);
            await _context.SaveChangesAsync();

            return Redirect($"/history.html?payment=success&code={booking.BookingCode}");
        }
        else
        {
            // Giao dịch không thành công hoặc khách hàng hủy thanh toán
            return Redirect($"/history.html?payment=failed&code={booking.BookingCode}&vnp_code={vnp_ResponseCode}");
        }
    }

    // ==========================================
    // 🌍 TÍCH HỢP PAYPAL SANDBOX
    // ==========================================

    [HttpPost("create-paypal-order")]
    [Authorize]
    public async Task<IActionResult> CreatePayPalOrder([FromBody] PaymentRequestDTO request)
    {
        var booking = await _context.Bookings.FindAsync(request.BookingId);
        if (booking == null) return NotFound(new { message = "Không tìm thấy đơn đặt vé." });

        // Tỷ giá quy đổi giả định: 25,000 VND = 1 USD
        decimal usdAmount = Math.Round(booking.TotalPrice / 25000m, 2);
        if (usdAmount < 1) usdAmount = 1;

        var clientId = _configuration["PayPal:ClientId"];

        return Ok(new
        {
            bookingId = booking.BookingId,
            bookingCode = booking.BookingCode,
            usdAmount = usdAmount.ToString("F2"),
            currency = "USD",
            paypalClientId = clientId
        });
    }

    [HttpPost("capture-paypal-order")]
    [Authorize]
    public async Task<IActionResult> CapturePayPalOrder([FromBody] PaymentByCodeRequestDTO request)
    {
        var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.BookingCode == request.BookingCode);
        if (booking == null) return NotFound(new { message = "Không tìm thấy đơn đặt vé." });

        booking.Status = "Confirmed";
        booking.UpdatedAt = DateTime.Now;

        var payment = new Payment
        {
            BookingId = booking.BookingId,
            Amount = booking.TotalPrice,
            PaymentMethod = "PayPal",
            TransactionCode = "PAYPAL_" + DateTime.Now.Ticks,
            Status = "Success",
            PaidAt = DateTime.Now,
            CreatedAt = DateTime.Now
        };

        _context.Payments.Add(payment);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Thanh toán PayPal thành công!", bookingCode = booking.BookingCode });
    }

    public class PaymentByCodeRequestDTO
    {
        public string BookingCode { get; set; } = null!;
        public string? PaymentMethod { get; set; }
    }
}
