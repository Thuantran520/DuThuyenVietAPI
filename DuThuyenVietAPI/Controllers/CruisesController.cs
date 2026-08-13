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
    private readonly IWebHostEnvironment _environment;

    public CruisesController(DuThuyenVietDBContext context, IWebHostEnvironment environment)
    {
        _context = context;
        _environment = environment;
    }

    [HttpGet]
    public async Task<IActionResult> GetCruises(
        [FromQuery] int? destinationId,
        [FromQuery] string? keyword,
        [FromQuery] string? priceRange,
        [FromQuery] DateTime? departureDate,
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
            // Bỏ c.IsActive để Admin xem và chỉnh sửa được cả du thuyền đang bị ẩn / bảo trì
            var cruise = await _context.Cruises
                .Include(c => c.Destination)
                .Include(c => c.CruiseImages)
                .Include(c => c.CabinTypes)
                .Include(c => c.Schedules)
                    .ThenInclude(s => s.ScheduleCabinInventories)
                .Include(c => c.Reviews)
                .FirstOrDefaultAsync(c => c.CruiseId == id);

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
    }

    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPost]
    public async Task<IActionResult> CreateCruise([FromBody] CruiseDTO dto)
    {
        try
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Name))
            {
                return BadRequest("Tên du thuyền không được để trống!");
            }

            string baseSlug = dto.Name.Trim().ToLower()
                .Replace(" ", "-")
                .Replace("đ", "d");
            string uniqueSlug = $"{baseSlug}-{Guid.NewGuid().ToString().Substring(0, 5)}";

            var cruise = new Cruise
            {
                DestinationId = dto.DestinationId,
                Name = dto.Name.Trim(),
                Slug = uniqueSlug,
                TotalCabins = dto.TotalCabins,
                ShortDescription = dto.ShortDescription ?? string.Empty,
                Description = dto.Description ?? string.Empty,
                ThumbnailUrl = dto.ThumbnailUrl ?? string.Empty,
                AverageRating = 0,
                ReviewCount = 0,
                IsActive = true,
                CreatedAt = DateTime.Now
            };

            _context.Cruises.Add(cruise);
            await _context.SaveChangesAsync();

            return Ok(new { cruise.CruiseId, cruise.Name, cruise.Slug, cruise.ThumbnailUrl, cruise.IsActive });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Lỗi DB: {ex.InnerException?.Message ?? ex.Message}");
        }
    }

    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateCruise(int id, [FromBody] CruiseDTO dto)
    {
        try
        {
            var cruise = await _context.Cruises
                .Include(c => c.CruiseImages)
                .FirstOrDefaultAsync(c => c.CruiseId == id);

            if (cruise == null) return NotFound("Không tìm thấy du thuyền");

            cruise.DestinationId = dto.DestinationId;
            cruise.Name = dto.Name;
            cruise.Slug = dto.Name.Trim().ToLower().Replace(" ", "-").Replace("đ", "d");
            cruise.TotalCabins = dto.TotalCabins;
            cruise.ShortDescription = dto.ShortDescription ?? string.Empty;
            cruise.Description = dto.Description ?? string.Empty;

            if (dto.IsActive.HasValue) cruise.IsActive = dto.IsActive.Value;
            cruise.UpdatedAt = DateTime.Now;

            // Cập nhật ThumbnailUrl nếu có dữ liệu mới
            if (!string.IsNullOrWhiteSpace(dto.ThumbnailUrl))
            {
                cruise.ThumbnailUrl = dto.ThumbnailUrl;

                var primaryImage = cruise.CruiseImages.FirstOrDefault(i => i.DisplayOrder == 1);
                if (primaryImage != null)
                {
                    primaryImage.ImageUrl = dto.ThumbnailUrl;
                }
                else
                {
                    cruise.CruiseImages.Add(new CruiseImage
                    {
                        ImageUrl = dto.ThumbnailUrl,
                        DisplayOrder = 1
                    });
                }
            }

            await _context.SaveChangesAsync();

            var imagesList = cruise.CruiseImages.OrderBy(i => i.DisplayOrder).Select(i => i.ImageUrl).ToList();

            return Ok(new
            {
                cruise.CruiseId,
                cruise.Name,
                cruise.Slug,
                cruise.ThumbnailUrl,
                Images = imagesList,
                cruise.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi cập nhật du thuyền: " + ex.Message);
        }
    }

    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCruise(int id)
    {
        var cruise = await _context.Cruises.FindAsync(id);
        if (cruise == null) return NotFound();

        cruise.IsActive = false;
        cruise.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();
        return Ok(new { Message = "Đã xóa du thuyền" });
    }

    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPost("upload-images/{id}")]
    public async Task<IActionResult> UploadCruiseImages(int id, IFormFile? thumbnail, List<IFormFile>? gallery)
    {
        try
        {
            var cruise = await _context.Cruises
                .Include(c => c.CruiseImages)
                .FirstOrDefaultAsync(c => c.CruiseId == id);

            if (cruise == null)
                return NotFound("Không tìm thấy du thuyền");

            var webRootPath = _environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var uploadsFolder = Path.Combine(webRootPath, "uploads", "cruises");
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            // 1. Upload Ảnh Đại Diện
            if (thumbnail != null)
            {
                if (thumbnail.Length > 5 * 1024 * 1024)
                {
                    return BadRequest("Lỗi: Ảnh đại diện không được vượt quá 5MB!");
                }

                var fileName = $"thumb_{id}_{Guid.NewGuid()}{Path.GetExtension(thumbnail.FileName)}";
                var filePath = Path.Combine(uploadsFolder, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await thumbnail.CopyToAsync(stream);
                }

                cruise.ThumbnailUrl = $"/uploads/cruises/{fileName}";

                var primaryImage = cruise.CruiseImages.FirstOrDefault(i => i.DisplayOrder == 1);
                if (primaryImage != null)
                {
                    primaryImage.ImageUrl = cruise.ThumbnailUrl;
                }
                else
                {
                    cruise.CruiseImages.Add(new CruiseImage
                    {
                        ImageUrl = cruise.ThumbnailUrl,
                        DisplayOrder = 1
                    });
                }
            }

            // 2. Upload Thư viện ảnh
            if (gallery != null && gallery.Count > 0)
            {
                if (gallery.Count > 5)
                {
                    return BadRequest("Lỗi: Thư viện ảnh chỉ được tải lên tối đa 5 ảnh!");
                }

                long totalSize = gallery.Sum(f => f.Length);
                if (totalSize > 50 * 1024 * 1024)
                {
                    return BadRequest("Lỗi: Tổng dung lượng thư viện ảnh không được vượt quá 50MB!");
                }

                var oldGalleryImages = cruise.CruiseImages.Where(i => i.DisplayOrder > 1).ToList();
                if (oldGalleryImages.Any())
                {
                    _context.CruiseImages.RemoveRange(oldGalleryImages);
                }

                int displayOrder = 2;
                foreach (var file in gallery)
                {
                    var fileName = $"gallery_{id}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                    var filePath = Path.Combine(uploadsFolder, fileName);

                    using (var stream = new FileStream(filePath, FileMode.Create))
                    {
                        await file.CopyToAsync(stream);
                    }

                    cruise.CruiseImages.Add(new CruiseImage
                    {
                        ImageUrl = $"/uploads/cruises/{fileName}",
                        DisplayOrder = displayOrder++
                    });
                }
            }

            cruise.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                Message = "Upload ảnh thành công!",
                ThumbnailUrl = cruise.ThumbnailUrl,
                Images = cruise.CruiseImages.OrderBy(i => i.DisplayOrder).Select(img => img.ImageUrl).ToList()
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi upload ảnh: " + ex.Message);
        }
    }
}