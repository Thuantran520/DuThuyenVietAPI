using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class BlogPostsController : ControllerBase
{
    private readonly DuThuyenVietDBContext _context;

    public BlogPostsController(DuThuyenVietDBContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Lấy danh sách tất cả bài viết tin tức / cẩm nang (Public)
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetPublishedPosts([FromQuery] int page = 1, [FromQuery] int pageSize = 6)
    {
        try
        {
            var query = _context.BlogPosts
                .Where(b => b.IsPublished)
                .OrderByDescending(b => b.PublishedAt ?? b.CreatedAt);

            int total = await query.CountAsync();
            var posts = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(b => new
                {
                    b.BlogPostId,
                    b.Title,
                    b.Slug,
                    b.Summary,
                    b.ThumbnailUrl,
                    PublishedAt = b.PublishedAt ?? b.CreatedAt,
                    b.AuthorId
                })
                .ToListAsync();

            return Ok(new
            {
                Posts = posts,
                Total = total,
                TotalPages = (int)Math.Ceiling((double)total / pageSize),
                CurrentPage = page
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    /// <summary>
    /// Lấy chi tiết bài viết theo Slug hoặc ID (Public)
    /// </summary>
    [HttpGet("{slugOrId}")]
    public async Task<IActionResult> GetPostBySlugOrId(string slugOrId)
    {
        try
        {
            BlogPost? post = null;

            if (int.TryParse(slugOrId, out int id))
            {
                post = await _context.BlogPosts.FindAsync(id);
            }
            else
            {
                post = await _context.BlogPosts.FirstOrDefaultAsync(b => b.Slug == slugOrId);
            }

            if (post == null || (!post.IsPublished && !User.IsInRole("Admin")))
            {
                return NotFound(new { message = "Không tìm thấy bài viết." });
            }

            return Ok(post);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    public class CreateBlogPostDTO
    {
        public string Title { get; set; } = null!;
        public string? Slug { get; set; }
        public string? Summary { get; set; }
        public string? Content { get; set; }
        public string? ThumbnailUrl { get; set; }
        public bool IsPublished { get; set; } = true;
    }

    /// <summary>
    /// Tạo mới bài viết tin tức (Admin/Staff)
    /// </summary>
    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPost]
    public async Task<IActionResult> CreatePost([FromBody] CreateBlogPostDTO dto)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            string slug = !string.IsNullOrEmpty(dto.Slug) 
                ? dto.Slug 
                : dto.Title.ToLower().Replace(" ", "-").Replace("/", "-");

            var post = new BlogPost
            {
                Title = dto.Title,
                Slug = slug,
                Summary = dto.Summary,
                Content = dto.Content,
                ThumbnailUrl = dto.ThumbnailUrl,
                AuthorId = userId,
                IsPublished = dto.IsPublished,
                PublishedAt = dto.IsPublished ? DateTime.Now : null,
                CreatedAt = DateTime.Now
            };

            _context.BlogPosts.Add(post);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Đã tạo bài viết thành công.", BlogPostId = post.BlogPostId });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    /// <summary>
    /// Cập nhật bài viết (Admin/Staff)
    /// </summary>
    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePost(int id, [FromBody] CreateBlogPostDTO dto)
    {
        try
        {
            var post = await _context.BlogPosts.FindAsync(id);
            if (post == null) return NotFound(new { message = "Không tìm thấy bài viết." });

            post.Title = dto.Title;
            if (!string.IsNullOrEmpty(dto.Slug)) post.Slug = dto.Slug;
            post.Summary = dto.Summary;
            post.Content = dto.Content;
            post.ThumbnailUrl = dto.ThumbnailUrl;
            
            if (!post.IsPublished && dto.IsPublished)
            {
                post.PublishedAt = DateTime.Now;
            }
            post.IsPublished = dto.IsPublished;

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Đã cập nhật bài viết thành công." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }

    /// <summary>
    /// Xóa bài viết (Admin/Staff)
    /// </summary>
    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePost(int id)
    {
        try
        {
            var post = await _context.BlogPosts.FindAsync(id);
            if (post == null) return NotFound(new { message = "Không tìm thấy bài viết." });

            _context.BlogPosts.Remove(post);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Đã xóa bài viết thành công." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
        }
    }
}
