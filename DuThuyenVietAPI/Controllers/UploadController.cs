using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System.IO;
using System.Threading.Tasks;
using System;
using Microsoft.AspNetCore.Authorization;
using System.Linq;
using System.Collections.Generic;
using Microsoft.AspNetCore.Hosting;
using DuThuyenVietAPI.Models;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class UploadController : ControllerBase
{
    private readonly IWebHostEnvironment _env;
    private readonly DuThuyenVietDBContext _context;

    public UploadController(IWebHostEnvironment env, DuThuyenVietDBContext context)
    {
        _env = env;
        _context = context;
    }

    [HttpPost("image")]
    [Authorize(Roles = "Admin,Manager,Staff")]
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("File không hợp lệ.");
        }

        if (file.Length > 10 * 1024 * 1024)
        {
            return BadRequest("Kích thước file không được vượt quá 10MB.");
        }

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
        {
            return BadRequest("Chỉ chấp nhận các định dạng ảnh: .jpg, .jpeg, .png, .gif, .webp");
        }

        // Lưu trực tiếp vào Database SQL Server (không lưu vào ổ đĩa / source code)
        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);

        var stored = new StoredImage
        {
            FileName = file.FileName,
            ContentType = string.IsNullOrEmpty(file.ContentType) ? "image/jpeg" : file.ContentType,
            Data = memoryStream.ToArray(),
            CreatedAt = DateTime.Now
        };

        _context.StoredImages.Add(stored);
        await _context.SaveChangesAsync();

        // Trả về đường dẫn API xem ảnh trực tiếp từ Database
        return Ok(new { imageUrl = $"/api/Upload/image/{stored.Id}" });
    }

    [HttpGet("image/{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetImage(int id)
    {
        var stored = await _context.StoredImages.FindAsync(id);
        if (stored == null)
        {
            return NotFound("Không tìm thấy ảnh trong database.");
        }

        return File(stored.Data, stored.ContentType);
    }

    [HttpPost("avatar")]
    [Authorize]
    public async Task<IActionResult> UploadAvatar(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest("File không hợp lệ.");
        if (file.Length > 5 * 1024 * 1024) return BadRequest("Avatar tối đa 5MB.");

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);

        var stored = new StoredImage
        {
            FileName = file.FileName,
            ContentType = file.ContentType ?? "image/jpeg",
            Data = memoryStream.ToArray(),
            CreatedAt = DateTime.Now
        };

        _context.StoredImages.Add(stored);
        await _context.SaveChangesAsync();

        return Ok(new { avatarUrl = $"/api/Upload/image/{stored.Id}" });
    }
}
