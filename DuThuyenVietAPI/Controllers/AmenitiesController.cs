using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AmenitiesController : ControllerBase
{
    private readonly DuThuyenVietDBContext _context;

    public AmenitiesController(DuThuyenVietDBContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Lấy danh sách tất cả các tiện ích (Public)
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAllAmenities()
    {
        try
        {
            var amenities = await _context.Amenities
                .OrderBy(a => a.Name)
                .ToListAsync();

            return Ok(amenities);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    public class CreateAmenityDTO
    {
        public string Name { get; set; } = null!;
        public string? IconClass { get; set; }
    }

    /// <summary>
    /// Thêm tiện ích mới (Admin/Staff)
    /// </summary>
    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPost]
    public async Task<IActionResult> CreateAmenity([FromBody] CreateAmenityDTO dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                return BadRequest(new { message = "Tên tiện ích không được để trống." });
            }

            var amenity = new Amenity
            {
                Name = dto.Name.Trim(),
                IconClass = dto.IconClass
            };

            _context.Amenities.Add(amenity);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Đã thêm tiện ích thành công.", AmenityId = amenity.AmenityId });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }
}
