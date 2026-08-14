using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System.IO;
using System.Threading.Tasks;
using System;
using Microsoft.AspNetCore.Authorization;
using System.Linq;
using System.Collections.Generic;
using Microsoft.AspNetCore.Hosting;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class UploadController : ControllerBase
{
    private readonly IWebHostEnvironment _env;

    public UploadController(IWebHostEnvironment env)
    {
        _env = env;
    }

    [HttpPost("image")]
    [Authorize(Roles = "Admin,Manager,Staff")]
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("File không hợp lệ.");
        }

        if (file.Length > 5 * 1024 * 1024)
        {
            return BadRequest("Kích thước file không được vượt quá 5MB.");
        }

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
        {
            return BadRequest("Chỉ chấp nhận các định dạng ảnh: .jpg, .jpeg, .png, .gif, .webp");
        }

        var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
        if (!Directory.Exists(uploadsFolder))
        {
            Directory.CreateDirectory(uploadsFolder);
        }

        var uniqueFileName = Guid.NewGuid().ToString() + "_" + Path.GetFileName(file.FileName);
        var filePath = Path.Combine(uploadsFolder, uniqueFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return Ok(new { Url = $"/uploads/{uniqueFileName}" });
    }

    [HttpPost("images")]
    [Authorize(Roles = "Admin,Manager,Staff")]
    public async Task<IActionResult> UploadImages(List<IFormFile> files)
    {
        if (files == null || files.Count == 0)
            return BadRequest("Không có file nào được chọn.");
            
        if (files.Count > 5)
            return BadRequest("Chỉ được phép tải lên tối đa 5 ảnh.");
            
        var urls = new List<string>();
        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };

        var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
        if (!Directory.Exists(uploadsFolder))
        {
            Directory.CreateDirectory(uploadsFolder);
        }

        foreach (var file in files)
        {
            if (file.Length > 5 * 1024 * 1024)
                return BadRequest($"File {file.FileName} vượt quá 5MB.");
                
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(ext))
                return BadRequest($"File {file.FileName} không đúng định dạng ảnh.");
                
            var uniqueFileName = Guid.NewGuid().ToString() + "_" + Path.GetFileName(file.FileName);
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }
            
            urls.Add($"/uploads/{uniqueFileName}");
        }
        
        return Ok(new { Urls = urls });
    }
}
