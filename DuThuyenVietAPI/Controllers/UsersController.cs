using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "Admin,Manager,Staff,Accountant")]
public class UsersController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly DuThuyenVietDBContext _context;

    public UsersController(UserManager<ApplicationUser> userManager, RoleManager<IdentityRole> roleManager, DuThuyenVietDBContext context)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllUsers()
    {
        var users = await _userManager.Users.ToListAsync();
        var userList = new List<object>();
        foreach (var u in users)
        {
            var roles = await _userManager.GetRolesAsync(u);
            userList.Add(new
            {
                u.Id,
                u.FullName,
                u.UserName,
                u.Email,
                Roles = roles
            });
        }
        return Ok(userList);
    }

    public class AssignRoleReq { public string Role { get; set; } = string.Empty; }

    [HttpPost("{id}/assign-role")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> AssignRole(string id, [FromBody] AssignRoleReq req)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound("Không tìm thấy user.");

        string newRole = req.Role;
        var validRoles = new[] { "Admin", "Manager", "Accountant", "Staff", "Customer" };
        if (!validRoles.Contains(newRole)) return BadRequest("Role không hợp lệ.");

        var callerRoles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
        bool isAdmin = callerRoles.Contains("Admin");

        if (!isAdmin && (newRole == "Admin" || newRole == "Manager" || newRole == "Accountant"))
            return Forbid();

        if (!await _roleManager.RoleExistsAsync(newRole))
            await _roleManager.CreateAsync(new IdentityRole(newRole));

        var currentRoles = await _userManager.GetRolesAsync(user);
        await _userManager.RemoveFromRolesAsync(user, currentRoles);
        await _userManager.AddToRoleAsync(user, newRole);

        return Ok(new { message = "Cấp quyền thành công." });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        var targetUser = await _userManager.FindByIdAsync(id);
        if (targetUser == null) return NotFound();

        var targetRoles = await _userManager.GetRolesAsync(targetUser);
        bool targetIsAdmin = targetRoles.Contains("Admin");
        bool targetIsManager = targetRoles.Contains("Manager");

        var callerId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (callerId == id) return BadRequest(new { message = "Không thể tự xóa tài khoản của chính mình." });

        var callerRoles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
        bool isAdmin = callerRoles.Contains("Admin");
        bool isManager = callerRoles.Contains("Manager");

        if (isAdmin && targetIsAdmin) 
            return StatusCode(403, new { message = "Quản trị viên không thể xóa một Quản trị viên khác." });
            
        if (!isAdmin && isManager && targetIsManager) 
            return StatusCode(403, new { message = "Quản lý không thể xóa một Quản lý khác." });
            
        if (!isAdmin && targetIsAdmin) 
            return StatusCode(403, new { message = "Không có quyền xóa Quản trị viên." });

        await _userManager.DeleteAsync(targetUser);
        return Ok(new { message = "Đã xóa user." });
    }

    public class ResetPwdReq { public string NewPassword { get; set; } = string.Empty; }

    [HttpPost("{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(string id, [FromBody] ResetPwdReq req)
    {
        var targetUser = await _userManager.FindByIdAsync(id);
        if (targetUser == null) return NotFound();

        var targetRoles = await _userManager.GetRolesAsync(targetUser);
        bool isTargetCustomer = targetRoles.Count == 0 || targetRoles.Contains("Customer");

        var callerRoles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
        bool isAdmin = callerRoles.Contains("Admin");

        if (!isTargetCustomer && !isAdmin)
            return Forbid(); // Chỉ Admin mới đổi mk được cho staff/manager

        var token = await _userManager.GeneratePasswordResetTokenAsync(targetUser);
        var result = await _userManager.ResetPasswordAsync(targetUser, token, req.NewPassword);

        if (result.Succeeded) return Ok(new { message = "Đã reset mật khẩu." });
        return BadRequest(result.Errors);
    }

    /// <summary>
    /// Báo cáo thống kê hiệu suất tư vấn và đánh giá sao của từng nhân viên (Admin, Manager, Accountant)
    /// </summary>
    [HttpGet("StaffPerformance")]
    [Authorize(Roles = "Admin,Manager,Accountant")]
    public async Task<IActionResult> GetStaffPerformance()
    {
        var users = await _userManager.Users.ToListAsync();
        var allConversations = await _context.ChatConversations.AsNoTracking().ToListAsync();

        var staffStats = new List<object>();

        foreach (var u in users)
        {
            var roles = await _userManager.GetRolesAsync(u);
            // Lọc ra các tài khoản thuộc bộ phận vận hành (Admin, Manager, Accountant, Staff)
            var staffRoles = roles.Where(r => new[] { "Admin", "Manager", "Accountant", "Staff" }.Contains(r)).ToList();
            if (!staffRoles.Any()) continue;

            // Lấy tất cả cuộc trò chuyện mà nhân viên này phụ trách hoặc giải quyết
            var staffChats = allConversations.Where(c =>
                c.AssignedStaffId == u.Id ||
                (!string.IsNullOrWhiteSpace(c.AssignedStaffName) && (c.AssignedStaffName.Equals(u.FullName, StringComparison.OrdinalIgnoreCase) || c.AssignedStaffName.Equals(u.UserName, StringComparison.OrdinalIgnoreCase))) ||
                (!string.IsNullOrWhiteSpace(c.ResolvedBy) && (c.ResolvedBy.Equals(u.FullName, StringComparison.OrdinalIgnoreCase) || c.ResolvedBy.Equals(u.UserName, StringComparison.OrdinalIgnoreCase)))
            ).ToList();

            int totalConsulted = staffChats.Count;
            int totalResolved = staffChats.Count(c => c.Status == "Resolved");
            var ratedChats = staffChats.Where(c => c.Rating.HasValue && c.Rating.Value > 0).ToList();

            double avgRating = ratedChats.Any() ? Math.Round(ratedChats.Average(c => c.Rating!.Value), 1) : 5.0;
            double satisfactionRate = ratedChats.Any()
                ? Math.Round((double)ratedChats.Count(c => c.Rating!.Value >= 4) / ratedChats.Count * 100, 1)
                : 100.0;
            int disputeCount = ratedChats.Count(c => c.Rating!.Value <= 2);

            var recentReviews = ratedChats
                .OrderByDescending(c => c.RatedAt ?? c.ResolvedAt ?? c.CreatedAt)
                .Take(5)
                .Select(c => new
                {
                    c.ConversationId,
                    c.CustomerName,
                    c.CustomerEmail,
                    c.Rating,
                    c.RatingComment,
                    date = (c.RatedAt ?? c.ResolvedAt ?? c.CreatedAt).ToString("dd/MM/yyyy HH:mm"),
                    c.Status
                })
                .ToList();

            string primaryRole = staffRoles.Contains("Admin") ? "Admin" :
                                 staffRoles.Contains("Manager") ? "Manager" :
                                 staffRoles.Contains("Accountant") ? "Accountant" : "Staff";

            staffStats.Add(new
            {
                userId = u.Id,
                fullName = u.FullName ?? u.UserName,
                userName = u.UserName,
                email = u.Email,
                roles = staffRoles,
                primaryRole,
                totalConsulted,
                totalResolved,
                totalRatings = ratedChats.Count,
                avgRating,
                satisfactionRate,
                disputeCount,
                recentReviews
            });
        }

        return Ok(staffStats.OrderByDescending(s => ((dynamic)s).totalConsulted));
    }

    /// <summary>
    /// Tra cứu lịch sử tư vấn, phản hồi đánh giá và giải quyết khiếu nại (Admin, Manager, Accountant)
    /// </summary>
    [HttpGet("AuditDisputes")]
    [Authorize(Roles = "Admin,Manager,Accountant")]
    public async Task<IActionResult> AuditDisputes([FromQuery] string? staffName = null, [FromQuery] int? maxRating = null, [FromQuery] string? search = null)
    {
        var query = _context.ChatConversations.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(staffName))
        {
            query = query.Where(c => (c.AssignedStaffName != null && c.AssignedStaffName.Contains(staffName)) ||
                                     (c.ResolvedBy != null && c.ResolvedBy.Contains(staffName)));
        }

        if (maxRating.HasValue && maxRating.Value > 0)
        {
            query = query.Where(c => c.Rating.HasValue && c.Rating.Value <= maxRating.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(c => c.CustomerName.Contains(search) ||
                                     (c.CustomerEmail != null && c.CustomerEmail.Contains(search)) ||
                                     (c.RatingComment != null && c.RatingComment.Contains(search)) ||
                                     (c.LastMessageSnippet != null && c.LastMessageSnippet.Contains(search)));
        }

        var results = await query
            .OrderByDescending(c => c.RatedAt ?? c.ResolvedAt ?? c.LastMessageAt)
            .Take(50)
            .Select(c => new
            {
                c.ConversationId,
                c.CustomerName,
                c.CustomerEmail,
                c.AssignedStaffName,
                c.Rating,
                c.RatingComment,
                c.Status,
                c.ResolvedBy,
                resolvedAt = c.ResolvedAt.HasValue ? c.ResolvedAt.Value.ToString("dd/MM/yyyy HH:mm") : null,
                createdAt = c.CreatedAt.ToString("dd/MM/yyyy HH:mm"),
                lastMessageSnippet = c.LastMessageSnippet
            })
            .ToListAsync();

        return Ok(results);
    }
}
