using DuThuyenVietAPI.DTOs;
using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AccountController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly IConfiguration _configuration;

    public AccountController(UserManager<ApplicationUser> userManager, RoleManager<IdentityRole> roleManager, IConfiguration configuration)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _configuration = configuration;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDTO request)
    {
        var emailExists = await _userManager.FindByEmailAsync(request.Email);
        if (emailExists != null)
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Email này đã được đăng ký!" });

        var usernameExists = await _userManager.FindByNameAsync(request.Username);
        if (usernameExists != null)
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Tên đăng nhập đã có người sử dụng!" });

        if (!string.IsNullOrEmpty(request.PhoneNumber))
        {
            var phoneExists = await _userManager.Users.AnyAsync(u => u.PhoneNumber == request.PhoneNumber);
            if (phoneExists)
                return StatusCode(StatusCodes.Status400BadRequest, new { message = "Số điện thoại này đã được đăng ký!" });
        }

        ApplicationUser user = new ApplicationUser()
        {
            Email = request.Email,
            SecurityStamp = Guid.NewGuid().ToString(),
            UserName = !string.IsNullOrWhiteSpace(request.Username) ? request.Username : request.Email,
            FullName = request.FullName,
            PhoneNumber = request.PhoneNumber
        };
        var result = await _userManager.CreateAsync(user, request.Password);
        
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return StatusCode(StatusCodes.Status400BadRequest, new { message = $"Đăng ký thất bại! {errors}" });
        }

        // Automatically assign Customer role
        if (!await _roleManager.RoleExistsAsync("Customer"))
            await _roleManager.CreateAsync(new IdentityRole("Customer"));

        await _userManager.AddToRoleAsync(user, "Customer");

        return Ok(new { message = "User created successfully!" });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDTO request)
    {
        var user = await _userManager.FindByEmailAsync(request.UsernameOrEmail ?? "");
        if (user == null)
        {
            user = await _userManager.FindByNameAsync(request.UsernameOrEmail ?? "");
        }

        if (user != null && await _userManager.CheckPasswordAsync(user, request.Password))
        {
            var userRoles = await _userManager.GetRolesAsync(user);

            // Nếu không chọn đăng nhập dưới quyền Admin, ép token chỉ có quyền Customer
            if (!request.LoginAsAdmin)
            {
                userRoles = new List<string> { "Customer" };
            }

            var authClaims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, user.UserName ?? ""),
                new Claim(ClaimTypes.Email, user.Email ?? ""),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.NameIdentifier, user.Id ?? "")
            };

            foreach (var userRole in userRoles)
            {
                authClaims.Add(new Claim(ClaimTypes.Role, userRole ?? ""));
            }

            var authSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Issuer"],
                expires: DateTime.Now.AddHours(3),
                claims: authClaims,
                signingCredentials: new SigningCredentials(authSigningKey, SecurityAlgorithms.HmacSha256)
            );

            return Ok(new
            {
                token = new JwtSecurityTokenHandler().WriteToken(token),
                expiration = token.ValidTo
            });
        }
        return Unauthorized();
    }

    [Authorize]
    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        // Get user from claims
        var email = User.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        var user = await _userManager.FindByEmailAsync(email);
        if (user == null) return NotFound("User not found");

        var roles = await _userManager.GetRolesAsync(user);

        return Ok(new
        {
            user.Id,
            user.UserName,
            user.Email,
            user.FullName,
            user.PhoneNumber,
            user.AvatarUrl,
            Roles = roles
        });
    }

    [Authorize]
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDTO request)
    {
        var email = User.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        var user = await _userManager.FindByEmailAsync(email);
        if (user == null) return NotFound("User not found");

        user.FullName = request.FullName;
        user.PhoneNumber = request.PhoneNumber;
        
        var result = await _userManager.UpdateAsync(user);
        if (result.Succeeded)
            return Ok(new { message = "Profile updated successfully" });
            
        return BadRequest("Failed to update profile");
    }

    [Authorize]
    [HttpPost("avatar")]
    public async Task<IActionResult> UploadAvatar(IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded");

            var email = User.FindFirstValue(ClaimTypes.Email);
            var user = await _userManager.FindByEmailAsync(email ?? "");
            if (user == null) return NotFound("User not found");

            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "avatars");
            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);

            // Xóa file ảnh cũ nếu có
            if (!string.IsNullOrEmpty(user.AvatarUrl))
            {
                var oldFileName = Path.GetFileName(user.AvatarUrl);
                var oldFilePath = Path.Combine(uploadsFolder, oldFileName);
                if (System.IO.File.Exists(oldFilePath))
                {
                    System.IO.File.Delete(oldFilePath);
                }
            }

            var uniqueFileName = Guid.NewGuid().ToString() + "_" + file.FileName;
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(fileStream);
            }

            user.AvatarUrl = "/uploads/avatars/" + uniqueFileName;
            await _userManager.UpdateAsync(user);

            return Ok(new { message = "Avatar uploaded successfully", avatarUrl = user.AvatarUrl });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }
}
