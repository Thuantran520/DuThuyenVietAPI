using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class CabinTypesController : ControllerBase
{
    private readonly DuThuyenVietDBContext _context;
    public CabinTypesController(DuThuyenVietDBContext context) => _context = context;

    // GET /api/CabinTypes?cruiseId=1
    [HttpGet]
    public async Task<IActionResult> GetByCruise([FromQuery] int cruiseId)
    {
        var cabins = await _context.CabinTypes
            .Where(c => c.CruiseId == cruiseId)
            .Select(c => new
            {
                c.CabinTypeId,
                c.CruiseId,
                c.Name,
                c.Description,
                c.MaxOccupancy,
                c.BasePrice,
                c.TotalRooms,
                c.ImageUrl
            })
            .ToListAsync();
        return Ok(cabins);
    }

    public class CabinTypeDTO
    {
        public int CruiseId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int MaxOccupancy { get; set; }
        public decimal BasePrice { get; set; }
        public int TotalRooms { get; set; }
        public string ImageUrl { get; set; } = string.Empty;
    }

    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CabinTypeDTO dto)
    {
        var cabin = new CabinType
        {
            CruiseId = dto.CruiseId,
            Name = dto.Name,
            Description = dto.Description,
            MaxOccupancy = dto.MaxOccupancy,
            BasePrice = dto.BasePrice,
            TotalRooms = dto.TotalRooms,
            ImageUrl = dto.ImageUrl
        };
        _context.CabinTypes.Add(cabin);
        await _context.SaveChangesAsync();
        return Ok(cabin);
    }

    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] CabinTypeDTO dto)
    {
        var cabin = await _context.CabinTypes.FindAsync(id);
        if (cabin == null) return NotFound();

        cabin.Name = dto.Name;
        cabin.Description = dto.Description;
        cabin.MaxOccupancy = dto.MaxOccupancy;
        cabin.BasePrice = dto.BasePrice;
        cabin.TotalRooms = dto.TotalRooms;
        cabin.ImageUrl = dto.ImageUrl;

        await _context.SaveChangesAsync();
        return Ok(cabin);
    }

    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var cabin = await _context.CabinTypes.FindAsync(id);
        if (cabin == null) return NotFound();
        _context.CabinTypes.Remove(cabin);
        await _context.SaveChangesAsync();
        return Ok(new { Message = "Đã xóa loại phòng" });
    }
}
