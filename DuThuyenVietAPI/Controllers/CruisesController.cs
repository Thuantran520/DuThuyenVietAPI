using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
                .Include(c => c.Schedules.Where(s => s.DepartureDate >= DateTime.Now && s.Status == "Open"))
                .Include(c => c.Reviews.OrderByDescending(r => r.CreatedAt).Take(5))
                .Include(c => c.Amenities)
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
                cruise.Description,
                DestinationName = cruise.Destination.Name,
                Images = cruise.CruiseImages.Any() 
                    ? cruise.CruiseImages.OrderBy(img => img.DisplayOrder).Select(img => img.ImageUrl).ToList() 
                    : (!string.IsNullOrEmpty(cruise.ThumbnailUrl) ? new List<string> { cruise.ThumbnailUrl } : new List<string>()),
                Amenities = cruise.Amenities.Select(a => new
                {
                    a.AmenityId,
                    a.Name,
                    a.IconClass
                }).ToList(),
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
}