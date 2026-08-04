using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DuThuyenVietAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CruisesController : ControllerBase
    {
        private readonly DuThuyenVietDBContext _context;

        // Gọi DBContext vào đây                                                                                                                                             
        public CruisesController(DuThuyenVietDBContext context)
        {
            _context = context;
        }

        // Tạo API GET: /api/cruises                                                                                                                                         
        [HttpGet]
        public async Task<IActionResult> GetCruises()
        {
            try
            {
                // Thử lấy 5 chiếc du thuyền đầu tiên trong Database                                                                                                         
                var cruises = await _context.Cruises.Take(5).ToListAsync();

                if (cruises == null || cruises.Count == 0)
                {
                    return NotFound("Chưa có dữ liệu Du thuyền nào trong Database!");
                }

                return Ok(cruises);
            }
            catch (Exception ex)
            {
                // Nếu lỗi kết nối, nó sẽ in ra lỗi chi tiết ở đây                                                                                                           
                return StatusCode(500, "Lỗi kết nối DB: " + ex.Message);
            }
        }
    }
}