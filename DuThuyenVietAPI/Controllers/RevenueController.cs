using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DuThuyenVietAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RevenueController : ControllerBase
    {
        private readonly DuThuyenVietDBContext _context;

        public RevenueController(DuThuyenVietDBContext context)
        {
            _context = context;
        }

        // =========================================================
        // TỔNG QUAN DOANH THU
        // =========================================================
        [HttpGet("summary")]
        public async Task<IActionResult> GetRevenueSummary()
        {
            // =====================================================
            // 1. ĐƠN ĐÃ HỦY
            // =====================================================
            var cancelledBookings = await _context.Bookings
                .Where(b => b.Status == "Cancelled")
                .ToListAsync();

            var cancelled = cancelledBookings.Count;


            // =====================================================
            // 2. ĐƠN THÀNH CÔNG
            //
            // Thành công bao gồm:
            // - Confirmed
            // - Completed
            //
            // Nếu hệ thống của bạn chỉ dùng Completed thì
            // phần Confirmed sẽ tự động không có dữ liệu.
            // =====================================================
            var successfulBookings = await _context.Bookings
                .Where(b =>
                    b.Status == "Confirmed" ||
                    b.Status == "Completed")
                .ToListAsync();

            var successful = successfulBookings.Count;


            // =====================================================
            // 3. TỔNG ĐƠN
            //
            // Tổng đơn = đơn thành công + đơn đã hủy
            // =====================================================
            var totalBookings = successful + cancelled;


            // =====================================================
            // 4. TỔNG KHÁCH
            //
            // Tổng khách = khách của đơn thành công
            //            + khách của đơn đã hủy
            // =====================================================
            var totalGuests =
                successfulBookings.Sum(b => b.NumberOfGuests)
                +
                cancelledBookings.Sum(b => b.NumberOfGuests);


            // =====================================================
            // 5. TỔNG DOANH THU
            //
            // CHỈ tính doanh thu của đơn thành công.
            //
            // Đơn Cancelled KHÔNG được tính doanh thu.
            // =====================================================
            var totalRevenue = successfulBookings
                .Sum(b => b.TotalPrice);


            // =====================================================
            // 6. CHỜ XỬ LÝ
            //
            // Pending = đang chờ thanh toán/xử lý.
            // =====================================================
            var pending = await _context.Bookings
                .CountAsync(b => b.Status == "Pending");


            // =====================================================
            // 7. ĐÃ XÁC NHẬN
            //
            // Theo yêu cầu của bạn:
            // "Đã xác nhận = những đơn thực hiện thành công"
            //
            // Vì vậy lấy cả Confirmed và Completed.
            // =====================================================
            var confirmed = successful;


            // =====================================================
            // 8. HOÀN THÀNH
            //
            // Completed là đơn đã hoàn thành.
            //
            // Nếu bạn muốn ô "Hoàn thành" thể hiện toàn bộ đơn
            // thành công thì dùng successful.
            // =====================================================
            var completed = successful;


            // =====================================================
            // 9. ĐÃ HỦY
            // =====================================================
            var cancelledCount = cancelled;


            // =====================================================
            // TRẢ KẾT QUẢ CHO FRONTEND
            // =====================================================
            return Ok(new
            {
                totalRevenue,
                totalBookings,
                totalGuests,

                pending,
                confirmed,
                completed,
                cancelled = cancelledCount
            });
        }


        // =========================================================
        // DOANH THU THEO DU THUYỀN
        // =========================================================
        [HttpGet("by-cruise")]
        public async Task<IActionResult> GetRevenueByCruise()
        {
            var data = await _context.Bookings
                .Where(b =>
                    b.Status == "Confirmed" ||
                    b.Status == "Completed")
                .Include(b => b.Schedule)
                .ThenInclude(s => s.Cruise)
                .GroupBy(b => new
                {
                    CruiseId = b.Schedule.CruiseId,
                    CruiseName = b.Schedule.Cruise.Name
                })
                .Select(g => new
                {
                    cruiseId = g.Key.CruiseId,
                    cruiseName = g.Key.CruiseName,

                    // Chỉ doanh thu đơn thành công
                    revenue = g.Sum(x => x.TotalPrice),

                    // Số đơn thành công
                    bookings = g.Count(),

                    // Số khách của đơn thành công
                    guests = g.Sum(x => x.NumberOfGuests)
                })
                .OrderByDescending(x => x.revenue)
                .ToListAsync();

            return Ok(data);
        }


        // =========================================================
        // ĐƠN HÀNG GẦN ĐÂY
        // =========================================================
        [HttpGet("recent")]
        public async Task<IActionResult> GetRecentBookings()
        {
            var data = await _context.Bookings
                .Include(b => b.Schedule)
                .ThenInclude(s => s.Cruise)
                .OrderByDescending(b => b.CreatedAt)
                .Take(10)
                .Select(b => new
                {
                    bookingId = b.BookingId,
                    bookingCode = b.BookingCode,
                    contactName = b.ContactName,
                    cruiseName = b.Schedule.Cruise.Name,
                    totalPrice = b.TotalPrice,
                    status = b.Status,
                    numberOfGuests = b.NumberOfGuests,
                    createdAt = b.CreatedAt
                })
                .ToListAsync();

            return Ok(data);
        }


        // =========================================================
        // TOP DU THUYỀN ĐƯỢC YÊU THÍCH
        // =========================================================
        [HttpGet("top-cruises")]
        public async Task<IActionResult> GetTopCruises()
        {
            var data = await _context.Bookings
                .Where(b => b.Status == "Completed")
                .Include(b => b.Schedule)
                .ThenInclude(s => s.Cruise)
                .GroupBy(b => new
                {
                    CruiseId = b.Schedule.CruiseId,
                    CruiseName = b.Schedule.Cruise.Name
                })
                .Select(g => new
                {
                    cruiseId = g.Key.CruiseId,
                    cruiseName = g.Key.CruiseName,
                    bookings = g.Count(),
                    revenue = g.Sum(x => x.TotalPrice),
                    guests = g.Sum(x => x.NumberOfGuests)
                })
                .OrderByDescending(x => x.bookings)
                .Take(5)
                .ToListAsync();

            return Ok(data);
        }

        // =========================================================
        // DU THUYỀN ĐƯỢC YÊU THÍCH
        // =========================================================
        [HttpGet("favorite-cruise")]
        public async Task<IActionResult> GetFavoriteCruise()
        {
            var cruise = await _context.Cruises
                .OrderByDescending(c => c.AverageRating)
                .ThenByDescending(c => c.ReviewCount)
                .Select(c => new
                {
                    cruiseId = c.CruiseId,
                    cruiseName = c.Name,
                    averageRating = c.AverageRating,
                    reviewCount = c.ReviewCount
                })
                .FirstOrDefaultAsync();

            return Ok(cruise);
        }
    }
}