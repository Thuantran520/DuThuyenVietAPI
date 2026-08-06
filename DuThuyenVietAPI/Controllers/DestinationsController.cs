using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class DestinationsController : ControllerBase
{
    private readonly DuThuyenVietDBContext _context;

    public DestinationsController(DuThuyenVietDBContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetDestinations()
    {
        try
        {
            var destinations = await _context.Destinations
                .Where(d => d.IsActive)
                .Select(d => new
                {
                    d.DestinationId,
                    d.Name,
                    d.Slug,
                    d.ImageUrl,
                    CruiseCount = d.Cruises.Count(c => c.IsActive)
                })
                .ToListAsync();
            return Ok(destinations);
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }

    public class DestinationDTO
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ImageUrl { get; set; } = string.Empty;
    }

    [Authorize(Roles = "Admin,Manager")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] DestinationDTO dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "Tên khu vực không được để trống." });

        var slug = dto.Name.ToLower()
            .Replace(" ", "-")
            .Replace("đ", "d")
            .Replace("ă", "a").Replace("â", "a").Replace("à", "a").Replace("á", "a").Replace("ả", "a").Replace("ã", "a").Replace("ạ", "a")
            .Replace("ê", "e").Replace("è", "e").Replace("é", "e").Replace("ẻ", "e").Replace("ẽ", "e").Replace("ẹ", "e")
            .Replace("ô", "o").Replace("ơ", "o").Replace("ồ", "o").Replace("ố", "o").Replace("ổ", "o").Replace("ỗ", "o").Replace("ộ", "o")
            .Replace("ư", "u").Replace("ừ", "u").Replace("ứ", "u").Replace("ử", "u").Replace("ữ", "u").Replace("ự", "u")
            .Replace("ị", "i").Replace("ì", "i").Replace("í", "i").Replace("ỉ", "i").Replace("ĩ", "i")
            .Replace("ỳ", "y").Replace("ý", "y").Replace("ỷ", "y").Replace("ỹ", "y").Replace("ỵ", "y");

        var destination = new Destination
        {
            Name = dto.Name,
            Slug = slug,
            Description = dto.Description,
            ImageUrl = dto.ImageUrl,
            IsActive = true,
            CreatedAt = DateTime.Now
        };

        _context.Destinations.Add(destination);
        await _context.SaveChangesAsync();
        return Ok(new { destination.DestinationId, destination.Name, destination.Slug });
    }

    [Authorize(Roles = "Admin,Manager")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var destination = await _context.Destinations.FindAsync(id);
        if (destination == null)
            return NotFound(new { message = "Không tìm thấy khu vực." });

        // Soft delete or hard delete? Let's do hard delete or deactivate
        destination.IsActive = false;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đã xóa khu vực thành công." });
    }
}
