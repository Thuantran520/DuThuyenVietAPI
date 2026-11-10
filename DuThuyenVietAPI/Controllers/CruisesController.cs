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
        [FromQuery] string? priceRange,
        [FromQuery] DateTime? departureDate,
        [FromQuery] bool includeInactive = false,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        try
        {
            var query = _context.Cruises
                .Include(c => c.Destination)
                .Include(c => c.CabinTypes)
                .Include(c => c.CruiseImages)
                .Include(c => c.Schedules)
                .Where(c => !c.IsDeleted)
                .AsQueryable();

            // Filter status: active / maintenance / all
            if (!string.IsNullOrEmpty(status))
            {
                if (status.Equals("active", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(c => c.IsActive);
                }
                else if (status.Equals("maintenance", StringComparison.OrdinalIgnoreCase) || status.Equals("inactive", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(c => !c.IsActive);
                }
            }
            else if (!includeInactive)
            {
                // Default customer view: only show active cruises
                query = query.Where(c => c.IsActive);
            }

            if (destinationId.HasValue && destinationId.Value > 0)
            {
                query = query.Where(c => c.DestinationId == destinationId.Value);
            }

            if (!string.IsNullOrEmpty(keyword))
            {
                query = query.Where(c => c.Name.Contains(keyword) || c.Destination.Name.Contains(keyword));
            }

            if (!string.IsNullOrEmpty(priceRange))
            {
                var parts = priceRange.Split('-');
                if (parts.Length == 2 && decimal.TryParse(parts[0], out var minPrice) && decimal.TryParse(parts[1], out var maxPrice))
                {
                    query = query.Where(c => c.CabinTypes.Any(cb => cb.BasePrice >= minPrice && cb.BasePrice <= maxPrice));
                }
                else if (parts.Length == 1 && decimal.TryParse(parts[0], out var minP))
                {
                    query = query.Where(c => c.CabinTypes.Any(cb => cb.BasePrice >= minP));
                }
            }

            if (departureDate.HasValue)
            {
                var targetDate = departureDate.Value.Date;
                query = query.Where(c => c.Schedules.Any(s => s.DepartureDate.Date == targetDate));
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
                    c.DestinationId,
                    DestinationName = c.Destination != null ? c.Destination.Name : "Đang cập nhật",
                    ThumbnailUrl = c.CruiseImages.OrderBy(img => img.DisplayOrder).Select(img => img.ImageUrl).FirstOrDefault() ?? c.ThumbnailUrl,
                    c.ShortDescription,
                    StartingPrice = c.CabinTypes.Any() ? c.CabinTypes.Min(cb => cb.BasePrice) : 0,
                    c.IsActive
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
                .Include(c => c.Schedules)
                    .ThenInclude(s => s.ScheduleCabinInventories)
                .Include(c => c.Reviews)
                .FirstOrDefaultAsync(c => c.CruiseId == id && !c.IsDeleted);

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
                cruise.TotalCabins,
                cruise.ThumbnailUrl,
                cruise.IsActive,
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
                Schedules = cruise.Schedules
                    .Where(s => s.DepartureDate.Date > DateTime.Now.Date)
                    .OrderBy(s => s.DepartureDate)
                    .Select(s => new
                {
                    s.ScheduleId,
                    s.DepartureDate,
                    s.ReturnDate,
                    s.DurationLabel,
                    Inventories = s.ScheduleCabinInventories.Select(i => new { i.CabinTypeId, i.AvailableRooms, i.PriceOverride }).ToList()
                }).ToList(),
                RecentReviews = cruise.Reviews.OrderByDescending(r => r.CreatedAt).Take(5).Select(r => new
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
        public bool? IsActive { get; set; }
        public List<string>? GalleryUrls { get; set; }
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
            IsActive = dto.IsActive ?? true,
            IsDeleted = false,
            CreatedAt = DateTime.Now
        };
        _context.Cruises.Add(cruise);
        await _context.SaveChangesAsync();
        
        if (dto.GalleryUrls != null && dto.GalleryUrls.Any())
        {
            int order = 2;
            foreach (var url in dto.GalleryUrls)
            {
                _context.CruiseImages.Add(new CruiseImage
                {
                    CruiseId = cruise.CruiseId,
                    ImageUrl = url,
                    DisplayOrder = order++
                });
            }
            await _context.SaveChangesAsync();
        }
        
        return Ok(new { cruise.CruiseId, cruise.Name, cruise.Slug, cruise.ThumbnailUrl, cruise.IsActive });
    }
    
    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateCruise(int id, [FromBody] CruiseDTO dto)
    {
        var cruise = await _context.Cruises.Include(c => c.CruiseImages).FirstOrDefaultAsync(c => c.CruiseId == id && !c.IsDeleted);
        if (cruise == null) return NotFound();
        var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");

        // Delete old thumbnail if it has changed
        if (!string.IsNullOrEmpty(cruise.ThumbnailUrl) && cruise.ThumbnailUrl != dto.ThumbnailUrl && cruise.ThumbnailUrl.StartsWith("/uploads/"))
        {
            var oldFilePath = Path.Combine(uploadsFolder, Path.GetFileName(cruise.ThumbnailUrl));
            if (System.IO.File.Exists(oldFilePath)) System.IO.File.Delete(oldFilePath);
        }

        cruise.DestinationId = dto.DestinationId;
        cruise.Name = dto.Name;
        cruise.Slug = dto.Name.ToLower().Replace(" ", "-").Replace("đ", "d");
        cruise.TotalCabins = dto.TotalCabins;
        cruise.ShortDescription = dto.ShortDescription;
        cruise.Description = dto.Description;
        cruise.ThumbnailUrl = dto.ThumbnailUrl;
        if (dto.IsActive.HasValue) cruise.IsActive = dto.IsActive.Value;
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
        
        if (dto.GalleryUrls != null)
        {
            var existingGallery = cruise.CruiseImages.Where(i => i.DisplayOrder > 1).ToList();
            
            // Delete removed gallery images from disk
            var removedImages = existingGallery.Where(i => !dto.GalleryUrls.Contains(i.ImageUrl)).ToList();
            foreach (var img in removedImages)
            {
                if (!string.IsNullOrEmpty(img.ImageUrl) && img.ImageUrl.StartsWith("/uploads/"))
                {
                    var oldFilePath = Path.Combine(uploadsFolder, Path.GetFileName(img.ImageUrl));
                    if (System.IO.File.Exists(oldFilePath)) System.IO.File.Delete(oldFilePath);
                }
            }

            _context.CruiseImages.RemoveRange(existingGallery);
            
            int order = 2;
            foreach (var url in dto.GalleryUrls)
            {
                cruise.CruiseImages.Add(new CruiseImage
                {
                    ImageUrl = url,
                    DisplayOrder = order++
                });
            }
        }
        
        await _context.SaveChangesAsync();
        return Ok(new { cruise.CruiseId, cruise.Name, cruise.Slug, cruise.ThumbnailUrl, cruise.IsActive, cruise.UpdatedAt });
    }

    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPut("{id}/toggle-maintenance")]
    public async Task<IActionResult> ToggleMaintenance(int id)
    {
        var cruise = await _context.Cruises.FirstOrDefaultAsync(c => c.CruiseId == id && !c.IsDeleted);
        if (cruise == null) return NotFound(new { message = "Không tìm thấy du thuyền." });

        cruise.IsActive = !cruise.IsActive;
        cruise.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();
        return Ok(new
        {
            cruise.CruiseId,
            cruise.Name,
            cruise.IsActive,
            Message = cruise.IsActive
                ? $"Đã mở lại hoạt động cho du thuyền \"{cruise.Name}\""
                : $"Đã đưa du thuyền \"{cruise.Name}\" vào chế độ bảo trì"
        });
    }
    
    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCruise(int id)
    {
        var cruise = await _context.Cruises
            .Include(c => c.CabinTypes)
            .Include(c => c.Schedules)
            .Include(c => c.CruiseImages)
            .Include(c => c.Reviews)
            .FirstOrDefaultAsync(c => c.CruiseId == id && !c.IsDeleted);
            
        if (cruise == null) return NotFound(new { message = "Không tìm thấy du thuyền hoặc đã bị xóa." });
        
        var scheduleIds = cruise.Schedules.Select(s => s.ScheduleId).ToList();
        var cabinTypeIds = cruise.CabinTypes.Select(c => c.CabinTypeId).ToList();
        
        bool hasBookings = await _context.Bookings.AnyAsync(b => 
            scheduleIds.Contains(b.ScheduleId) || cabinTypeIds.Contains(b.CabinTypeId));
            
        if (hasBookings)
        {
            // Du thuyền đã có dữ liệu đơn đặt phòng lịch sử -> Đánh dấu IsDeleted = true
            // để bảo toàn dữ liệu hóa đơn/thanh toán nhưng biến mất hoàn toàn khỏi danh sách quản lý
            cruise.IsDeleted = true;
            cruise.IsActive = false;
            cruise.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();
        }
        else
        {
            // Du thuyền chưa từng phát sinh đơn đặt phòng -> Xóa dứt điểm khỏi Database
            var inventories = await _context.ScheduleCabinInventories
                .Where(i => scheduleIds.Contains(i.ScheduleId) || cabinTypeIds.Contains(i.CabinTypeId))
                .ToListAsync();
            if (inventories.Any())
            {
                _context.ScheduleCabinInventories.RemoveRange(inventories);
            }
            
            _context.Cruises.Remove(cruise);
            await _context.SaveChangesAsync();
        }
        
        return Ok(new { Message = $"Đã xóa vĩnh viễn du thuyền \"{cruise.Name}\" thành công." });
    }
}