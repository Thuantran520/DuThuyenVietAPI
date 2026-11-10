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

    public class ProcessByCodeRequestDTO
    {
        public string BookingCode { get; set; } = null!;
        public string PaymentMethod { get; set; } = null!;
    }

    [HttpPost("ProcessByCode")]
    [Authorize]
    public async Task<IActionResult> ProcessByCode([FromBody] ProcessByCodeRequestDTO request)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var groupBookings = await _context.Bookings.Where(b => b.BookingCode == request.BookingCode).ToListAsync();

            if (groupBookings.Count == 0) return NotFound(new { message = "Không tìm thấy đơn hàng" });

            var firstBooking = groupBookings.First();
            if (!string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(firstBooking.UserId) && firstBooking.UserId != userId)
                return Forbid();

            // 1. Bảo vệ cơ chế đặt hàng: Nếu đơn hàng đã được thanh toán xác nhận thành công trước đó
            if (firstBooking.Status == "Confirmed")
            {
                return Ok(new { 
                    message = "Đơn đặt phòng này đã được xác nhận thanh toán thành công!", 
                    bookingStatus = "Confirmed",
                    alreadyPaid = true 
                });
            }

            // 2. Buffer chống spam thanh toán (Spam cooldown buffer 5 giây)
            var recentPayment = await _context.Payments
                .Where(p => p.BookingId == firstBooking.BookingId && p.PaymentMethod == request.PaymentMethod && p.CreatedAt > DateTime.Now.AddSeconds(-5))
                .OrderByDescending(p => p.PaymentId)
                .FirstOrDefaultAsync();

            if (recentPayment != null)
            {
                return Ok(new { 
                    message = "Giao dịch đang được hệ thống xử lý, vui lòng không gửi trùng lặp.", 
                    transactionCode = recentPayment.TransactionCode,
                    bookingStatus = firstBooking.Status 
                });
            }

            // 3. Chuẩn hóa phương thức thanh toán cuối cùng (Huỷ các phương thức cũ đang treo để lấy phương thức mới nhất)
            var oldPendingPayments = await _context.Payments
                .Where(p => p.BookingId == firstBooking.BookingId && p.Status == "Pending")
                .ToListAsync();

            foreach (var op in oldPendingPayments)
            {
                op.Status = "Superseded"; // Đã thay thế bởi phương thức mới
            }

            bool isImmediate = request.PaymentMethod != "Cash" && request.PaymentMethod != "BankTransfer" && request.PaymentMethod != "VietQR";
            decimal totalAmount = groupBookings.Sum(b => b.TotalPrice);

            var prefix = request.PaymentMethod == "VietQR" ? "VQR" : (request.PaymentMethod == "Cash" ? "CASH" : "TXN");
            var payment = new Payment
            {
                BookingId = firstBooking.BookingId,
                Amount = totalAmount,
                PaymentMethod = request.PaymentMethod,
                TransactionCode = prefix + DateTime.Now.Ticks.ToString(),
                Status = isImmediate ? "Success" : "Pending",
                PaidAt = isImmediate ? DateTime.Now : null,
                CreatedAt = DateTime.Now
            };

            _context.Payments.Add(payment);

            string targetStatus = isImmediate ? "Confirmed" : "AwaitingConfirmation";
            foreach (var b in groupBookings)
            {
                b.Status = targetStatus;
                b.UpdatedAt = DateTime.Now;
            }

            // Tăng số lượt đã sử dụng của mã giảm giá khi đặt phòng thành công
            if (isImmediate)
            {
                var promoIds = groupBookings.Where(b => b.PromotionId.HasValue).Select(b => b.PromotionId!.Value).Distinct().ToList();
                if (promoIds.Any())
                {
                    var promos = await _context.Promotions.Where(p => promoIds.Contains(p.PromotionId)).ToListAsync();
                    foreach (var p in promos)
                    {
                        p.UsedCount++;
                    }
                }
            }

            await _context.SaveChangesAsync();

            string msg = isImmediate 
                ? "Thanh toán thành công!" 
                : (request.PaymentMethod == "VietQR" 
                    ? "Đã ghi nhận giao dịch chuyển khoản VietQR! Đơn hàng đang được đối soát và sẽ kích hoạt ngay." 
                    : "Đã ghi nhận đơn đặt tour! Nhân viên sẽ liên hệ và thu hộ theo lịch hẹn.");

            return Ok(new { message = msg, transactionCode = payment.TransactionCode, bookingStatus = targetStatus, paymentMethod = request.PaymentMethod });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
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

            bool isImmediate = request.PaymentMethod != "Cash" && request.PaymentMethod != "BankTransfer" && request.PaymentMethod != "VietQR";

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

            var groupBookings = await _context.Bookings.Where(b => b.BookingCode == booking.BookingCode).ToListAsync();
            decimal totalAmount = groupBookings.Any() ? groupBookings.Sum(b => b.TotalPrice) : booking.TotalPrice;

            var tmnCode = _configuration["VnPay:TmnCode"] ?? "J914ZYDG";
            var hashSecret = _configuration["VnPay:HashSecret"] ?? "STQJECRYLUKAESMZXXVIZKUCMEGJOORU";
            var baseUrl = _configuration["VnPay:BaseUrl"] ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
            var returnUrl = _configuration["VnPay:ReturnUrl"] ?? "https://localhost:7137/api/Payments/vnpay-return";

            var vnpay = new VnPayLibrary();
            vnpay.AddRequestData("vnp_Version", "2.1.0");
            vnpay.AddRequestData("vnp_Command", "pay");
            vnpay.AddRequestData("vnp_TmnCode", tmnCode);
            vnpay.AddRequestData("vnp_Amount", ((long)(totalAmount * 100)).ToString());
            vnpay.AddRequestData("vnp_CreateDate", DateTime.Now.ToString("yyyyMMddHHmmss"));
            vnpay.AddRequestData("vnp_CurrCode", "VND");
            vnpay.AddRequestData("vnp_IpAddr", VnPayLibrary.GetIpAddress(HttpContext));
            vnpay.AddRequestData("vnp_Locale", "vn");
            vnpay.AddRequestData("vnp_OrderInfo", $"Thanh toan ve {booking.BookingCode}");
            vnpay.AddRequestData("vnp_OrderType", "other");
            vnpay.AddRequestData("vnp_ReturnUrl", returnUrl);
            vnpay.AddRequestData("vnp_TxnRef", $"{booking.BookingId}_{DateTime.Now.Ticks}");

            var paymentUrl = vnpay.CreateRequestUrl(baseUrl, hashSecret);

            // Ghi nhận ngay phương thức thanh toán khách đã chọn (VNPAY) vào database để Admin thấy
            var oldPending = await _context.Payments
                .Where(p => p.BookingId == booking.BookingId && p.Status == "Pending")
                .ToListAsync();

            if (oldPending.Any())
            {
                var latestPending = oldPending.OrderByDescending(p => p.PaymentId).First();
                latestPending.PaymentMethod = "VNPAY";
                latestPending.TransactionCode = "VNP_PENDING_" + booking.BookingId;
                latestPending.Amount = totalAmount;

                foreach (var op in oldPending.Where(p => p.PaymentId != latestPending.PaymentId))
                {
                    op.Status = "Superseded";
                }
            }
            else
            {
                _context.Payments.Add(new Payment
                {
                    BookingId = booking.BookingId,
                    Amount = totalAmount,
                    PaymentMethod = "VNPAY",
                    TransactionCode = "VNP_PENDING_" + booking.BookingId,
                    Status = "Pending",
                    CreatedAt = DateTime.Now
                });
            }
            await _context.SaveChangesAsync();

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

        var groupBookings = await _context.Bookings.Where(b => b.BookingCode == booking.BookingCode).ToListAsync();
        decimal totalAmount = groupBookings.Any() ? groupBookings.Sum(b => b.TotalPrice) : booking.TotalPrice;

        if (vnp_ResponseCode == "00")
        {
            // Giao dịch thành công
            foreach (var b in groupBookings)
            {
                b.Status = "Confirmed";
                b.UpdatedAt = DateTime.Now;
            }

            var payment = await _context.Payments
                .Where(p => p.BookingId == booking.BookingId && p.Status != "Superseded")
                .OrderByDescending(p => p.PaymentId)
                .FirstOrDefaultAsync();
            if (payment == null)
            {
                payment = new Payment { BookingId = booking.BookingId };
                _context.Payments.Add(payment);
            }

            payment.Amount = totalAmount;
            payment.PaymentMethod = "VNPAY";
            payment.TransactionCode = "VNP" + vnp_TransactionNo;
            payment.Status = "Success";
            payment.PaidAt = DateTime.Now;
            payment.CreatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return Redirect($"/order-success.html?code={booking.BookingCode}&method=VNPAY");
        }
        else if (vnp_ResponseCode == "24")
        {
            // Khách hàng bấm Hủy giao dịch trên cổng VNPAY
            var payment = await _context.Payments
                .Where(p => p.BookingId == booking.BookingId && p.Status != "Superseded")
                .OrderByDescending(p => p.PaymentId)
                .FirstOrDefaultAsync();
            if (payment == null)
            {
                payment = new Payment { BookingId = booking.BookingId };
                _context.Payments.Add(payment);
            }

            payment.Amount = totalAmount;
            payment.PaymentMethod = "VNPAY";
            payment.TransactionCode = "VNP_CANCEL_" + DateTime.Now.Ticks;
            payment.Status = "Cancelled";
            payment.PaidAt = null;

            await _context.SaveChangesAsync();

            return Redirect($"/history.html?payment=cancelled&code={booking.BookingCode}&vnp_code=24");
        }
        else
        {
            // Giao dịch không thành công khác
            var payment = await _context.Payments
                .Where(p => p.BookingId == booking.BookingId && p.Status != "Superseded")
                .OrderByDescending(p => p.PaymentId)
                .FirstOrDefaultAsync();
            if (payment == null)
            {
                payment = new Payment { BookingId = booking.BookingId };
                _context.Payments.Add(payment);
            }

            payment.Amount = totalAmount;
            payment.PaymentMethod = "VNPAY";
            payment.TransactionCode = "VNP_FAILED_" + DateTime.Now.Ticks;
            payment.Status = "Failed";
            payment.PaidAt = null;

            await _context.SaveChangesAsync();

            return Redirect($"/history.html?payment=failed&code={booking.BookingCode}&vnp_code={vnp_ResponseCode}");
        }
    }

    // ==========================================
    // 📡 CỔNG VNPAY IPN (SERVER-TO-SERVER WEBHOOK)
    // ==========================================

    [HttpGet("vnpay-ipn")]
    [AllowAnonymous]
    public async Task<IActionResult> VnPayIpn()
    {
        try
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
                return Ok(new { RspCode = "97", Message = "Invalid Checksum" });
            }

            int bookingId = 0;
            if (!string.IsNullOrEmpty(vnp_TxnRef) && vnp_TxnRef.Contains('_'))
            {
                int.TryParse(vnp_TxnRef.Split('_')[0], out bookingId);
            }

            var booking = await _context.Bookings.FindAsync(bookingId);
            if (booking == null)
            {
                return Ok(new { RspCode = "01", Message = "Order not found" });
            }

            if (booking.Status == "Confirmed")
            {
                return Ok(new { RspCode = "02", Message = "Order already confirmed" });
            }

            if (vnp_ResponseCode == "00")
            {
                var groupBookings = await _context.Bookings.Where(b => b.BookingCode == booking.BookingCode).ToListAsync();
                decimal totalAmount = groupBookings.Any() ? groupBookings.Sum(b => b.TotalPrice) : booking.TotalPrice;

                foreach (var b in groupBookings)
                {
                    b.Status = "Confirmed";
                    b.UpdatedAt = DateTime.Now;
                }

                var payment = new Payment
                {
                    BookingId = booking.BookingId,
                    Amount = totalAmount,
                    PaymentMethod = "VNPAY",
                    TransactionCode = "VNP" + vnp_TransactionNo,
                    Status = "Success",
                    PaidAt = DateTime.Now,
                    CreatedAt = DateTime.Now
                };

                _context.Payments.Add(payment);
                await _context.SaveChangesAsync();

                return Ok(new { RspCode = "00", Message = "Confirm Success" });
            }

            return Ok(new { RspCode = "00", Message = "Confirm Success" });
        }
        catch (Exception ex)
        {
            return Ok(new { RspCode = "99", Message = "Unknown error: " + ex.Message });
        }
    }

    // ==========================================
    // 🌍 TÍCH HỢP PAYPAL SANDBOX (CHÍNH THỨC)
    // ==========================================

    public class PayPalOrderRequestDTO
    {
        public int? BookingId { get; set; }
        public string? BookingCode { get; set; }
    }

    [HttpPost("create-paypal-order")]
    [Authorize]
    public async Task<IActionResult> CreatePayPalOrder([FromBody] PayPalOrderRequestDTO request)
    {
        var query = _context.Bookings.AsQueryable();
        if (request.BookingId.HasValue && request.BookingId.Value > 0)
        {
            query = query.Where(b => b.BookingId == request.BookingId.Value);
        }
        else if (!string.IsNullOrEmpty(request.BookingCode))
        {
            query = query.Where(b => b.BookingCode == request.BookingCode);
        }
        else
        {
            return BadRequest(new { message = "Thiếu thông tin đơn đặt vé." });
        }

        var booking = await query.FirstOrDefaultAsync();
        if (booking == null) return NotFound(new { message = "Không tìm thấy đơn đặt vé." });

        var groupBookings = await _context.Bookings.Where(b => b.BookingCode == booking.BookingCode).ToListAsync();
        decimal totalAmount = groupBookings.Any() ? groupBookings.Sum(b => b.TotalPrice) : booking.TotalPrice;

        // Tỷ giá quy đổi linh hoạt từ cấu hình CurrencySettings:VndPerUsd (mặc định 25,400 VND = 1 USD)
        decimal rate = 25400m;
        if (decimal.TryParse(_configuration["CurrencySettings:VndPerUsd"], out decimal cfgRate) && cfgRate > 0)
        {
            rate = cfgRate;
        }

        decimal usdAmount = Math.Round(totalAmount / rate, 2);
        if (usdAmount < 1) usdAmount = 1;

        var clientId = _configuration["PayPal:ClientId"];
        if (string.IsNullOrEmpty(clientId) || clientId.StartsWith("YOUR_"))
        {
            clientId = "test"; // PayPal Sandbox client-id demo chuẩn
        }

        // Ghi nhận ngay phương thức PayPal mà khách chọn vào database để Admin thấy
        var oldPending = await _context.Payments
            .Where(p => p.BookingId == booking.BookingId && p.Status == "Pending")
            .ToListAsync();

        if (oldPending.Any())
        {
            var latestPending = oldPending.OrderByDescending(p => p.PaymentId).First();
            latestPending.PaymentMethod = "PayPal";
            latestPending.TransactionCode = "PAYPAL_INIT_" + booking.BookingId;
            latestPending.Amount = totalAmount;

            foreach (var op in oldPending.Where(p => p.PaymentId != latestPending.PaymentId))
            {
                op.Status = "Superseded";
            }
        }
        else
        {
            _context.Payments.Add(new Payment
            {
                BookingId = booking.BookingId,
                Amount = totalAmount,
                PaymentMethod = "PayPal",
                TransactionCode = "PAYPAL_INIT_" + booking.BookingId,
                Status = "Pending",
                CreatedAt = DateTime.Now
            });
        }
        await _context.SaveChangesAsync();

        return Ok(new
        {
            bookingId = booking.BookingId,
            bookingCode = booking.BookingCode,
            totalVnd = totalAmount,
            exchangeRate = rate,
            usdAmount = usdAmount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
            currency = "USD",
            paypalClientId = clientId
        });
    }

    public class PayPalCaptureRequestDTO
    {
        public string BookingCode { get; set; } = null!;
        public string? TransactionCode { get; set; }
        public string? OrderID { get; set; }
        public string? PayerID { get; set; }
    }

    [HttpPost("capture-paypal-order")]
    [Authorize]
    public async Task<IActionResult> CapturePayPalOrder([FromBody] PayPalCaptureRequestDTO request)
    {
        var groupBookings = await _context.Bookings.Where(b => b.BookingCode == request.BookingCode).ToListAsync();
        if (groupBookings.Count == 0) return NotFound(new { message = "Không tìm thấy đơn đặt vé." });

        foreach (var b in groupBookings)
        {
            b.Status = "Confirmed";
            b.UpdatedAt = DateTime.Now;
        }

        decimal totalAmount = groupBookings.Sum(b => b.TotalPrice);
        var firstBooking = groupBookings.First();

        var txnCode = !string.IsNullOrEmpty(request.TransactionCode) 
            ? request.TransactionCode 
            : (!string.IsNullOrEmpty(request.OrderID) ? ("PAYPAL_" + request.OrderID) : ("PAYPAL_" + DateTime.Now.Ticks));

        var payment = new Payment
        {
            BookingId = firstBooking.BookingId,
            Amount = totalAmount,
            PaymentMethod = "PayPal",
            TransactionCode = txnCode,
            Status = "Success",
            PaidAt = DateTime.Now,
            CreatedAt = DateTime.Now
        };

        _context.Payments.Add(payment);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Thanh toán PayPal thành công!", bookingCode = firstBooking.BookingCode, transactionCode = txnCode });
    }
}
