using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "Admin,Manager,Staff")]
public class UsersController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;

    public UsersController(UserManager<ApplicationUser> userManager, RoleManager<IdentityRole> roleManager)
    {
        _userManager = userManager;
        _roleManager = roleManager;
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

    public class AssignRoleReq { public string Role { get; set; } }

    [HttpPost("{id}/assign-role")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> AssignRole(string id, [FromBody] AssignRoleReq req)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound("Không tìm thấy user.");

        string newRole = req.Role;
        var validRoles = new[] { "Admin", "Manager", "Staff", "Customer" };
        if (!validRoles.Contains(newRole)) return BadRequest("Role không hợp lệ.");

        var callerRoles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
        bool isAdmin = callerRoles.Contains("Admin");

        if (!isAdmin && (newRole == "Admin" || newRole == "Manager"))
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

        var callerRoles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
        bool isAdmin = callerRoles.Contains("Admin");

        if (!isAdmin && (targetIsAdmin || targetIsManager))
            return Forbid();

        await _userManager.DeleteAsync(targetUser);
        return Ok(new { message = "Đã xóa user." });
    }

    public class ResetPwdReq { public string NewPassword { get; set; } }

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
}
