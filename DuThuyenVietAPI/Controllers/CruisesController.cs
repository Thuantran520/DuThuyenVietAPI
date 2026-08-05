using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class CruisesController : ControllerBase
{
    private readonly DuThuyenVietDBContext _context;

    public CruisesController(DuThuyenVietDBContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetCruises(
        [FromQuery] int? destinationId,
        [FromQuery] string? keyword,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        try
        {
            var query = _context.Cruises
                .Include(c => c.Destination)
                .Include(c => c.CabinTypes)
                .Include(c => c.CruiseImages)
                .Where(c => c.IsActive)
                .AsQueryable();

            if (destinationId.HasValue && destinationId.Value > 0)
            {
                query = query.Where(c => c.DestinationId == destinationId.Value);
            }

            if (!string.IsNullOrEmpty(keyword))
            {
                query = query.Where(c => c.Name.Contains(keyword) || c.Destination.Name.Contains(keyword));
            }

            int totalItems = await query.CountAsync();
            int totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

            var cruises = await query
                .OrderByDescending(c => c.AverageRating)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new
                {
                    c.CruiseId,
                    c.Name,
                    c.Slug,
                    c.AverageRating,
                    c.ReviewCount,
                    DestinationName = c.Destination.Name,
                    ThumbnailUrl = c.CruiseImages.OrderBy(img => img.DisplayOrder).Select(img => img.ImageUrl).FirstOrDefault() ?? c.ThumbnailUrl,
                    c.ShortDescription,
                    StartingPrice = c.CabinTypes.Any() ? c.CabinTypes.Min(cb => cb.BasePrice) : 0
                })
                .ToListAsync();

            return Ok(new
            {
                TotalItems = totalItems,
                TotalPages = totalPages,
                CurrentPage = page,
                PageSize = pageSize,
                Data = cruises
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetCruiseById(int id)
    {
        try
        {
            var cruise = await _context.Cruises
                .Include(c => c.Destination)
                .Include(c => c.CruiseImages)
                .Include(c => c.CabinTypes)
                .Include(c => c.Schedules.OrderByDescending(s => s.DepartureDate))
                .Include(c => c.Reviews.OrderByDescending(r => r.CreatedAt).Take(5))
                .FirstOrDefaultAsync(c => c.CruiseId == id && c.IsActive);

            if (cruise == null)
                return NotFound("Không tìm thấy du thuyền");

            var result = new
            {
                cruise.CruiseId,
                cruise.Name,
                cruise.Slug,
                cruise.AverageRating,
                cruise.ReviewCount,
                cruise.ShortDescription,
                cruise.Description,
                DestinationId = cruise.DestinationId,
                DestinationName = cruise.Destination != null ? cruise.Destination.Name : "Đang cập nhật",
                Images = cruise.CruiseImages.Any() 
                    ? cruise.CruiseImages.OrderBy(img => img.DisplayOrder).Select(img => img.ImageUrl).ToList() 
                    : (!string.IsNullOrEmpty(cruise.ThumbnailUrl) ? new List<string> { cruise.ThumbnailUrl } : new List<string>()),

                Cabins = cruise.CabinTypes.Select(cb => new
                {
                    cb.CabinTypeId,
                    cb.Name,
                    cb.MaxOccupancy,
                    cb.BasePrice,
                    cb.ImageUrl,
                    cb.Description,
                    cb.TotalRooms
                }).ToList(),
                Schedules = cruise.Schedules.Select(s => new
                {
                    s.ScheduleId,
                    s.DepartureDate,
                    s.ReturnDate,
                    s.DurationLabel
                }).ToList(),
                RecentReviews = cruise.Reviews.Select(r => new
                {
                    r.ReviewId,
                    r.Rating,
                    r.Comment,
                    r.CreatedAt
                }).ToList()
            };

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }

    public class CruiseDTO
    {
        public int DestinationId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int TotalCabins { get; set; }
        public string ShortDescription { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ThumbnailUrl { get; set; } = string.Empty;
    }

    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPost]
    public async Task<IActionResult> CreateCruise([FromBody] CruiseDTO dto)
    {
        var cruise = new Cruise
        {
            DestinationId = dto.DestinationId,
            Name = dto.Name,
            Slug = dto.Name.ToLower().Replace(" ", "-").Replace("đ", "d"), // basic slug
            TotalCabins = dto.TotalCabins,
            ShortDescription = dto.ShortDescription,
            Description = dto.Description,
            ThumbnailUrl = dto.ThumbnailUrl,
            IsActive = true,
            CreatedAt = DateTime.Now
        };
        _context.Cruises.Add(cruise);
        await _context.SaveChangesAsync();
        return Ok(cruise);
    }
    
    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateCruise(int id, [FromBody] CruiseDTO dto)
    {
        var cruise = await _context.Cruises.Include(c => c.CruiseImages).FirstOrDefaultAsync(c => c.CruiseId == id);
        if (cruise == null) return NotFound();
        
        cruise.DestinationId = dto.DestinationId;
        cruise.Name = dto.Name;
        cruise.Slug = dto.Name.ToLower().Replace(" ", "-").Replace("đ", "d");
        cruise.TotalCabins = dto.TotalCabins;
        cruise.ShortDescription = dto.ShortDescription;
        cruise.Description = dto.Description;
        cruise.ThumbnailUrl = dto.ThumbnailUrl;
        cruise.UpdatedAt = DateTime.Now;
        
        // Also update CruiseImages to reflect the new ThumbnailUrl as primary
        if (!string.IsNullOrEmpty(dto.ThumbnailUrl))
        {
            var primaryImage = cruise.CruiseImages.FirstOrDefault(i => i.DisplayOrder == 1);
            if (primaryImage != null)
            {
                primaryImage.ImageUrl = dto.ThumbnailUrl;
            }
            else if (!cruise.CruiseImages.Any(i => i.ImageUrl == dto.ThumbnailUrl))
            {
                cruise.CruiseImages.Add(new CruiseImage
                {
                    ImageUrl = dto.ThumbnailUrl,
                    DisplayOrder = 1
                });
            }
        }
        
        await _context.SaveChangesAsync();
        return Ok(cruise);
    }
    
    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCruise(int id)
    {
        var cruise = await _context.Cruises.FindAsync(id);
        if (cruise == null) return NotFound();
        
        cruise.IsActive = false; // soft delete
        cruise.UpdatedAt = DateTime.Now;
        
        await _context.SaveChangesAsync();
        return Ok(new { Message = "Đã xóa du thuyền" });
    }
}