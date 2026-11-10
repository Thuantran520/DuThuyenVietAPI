using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Rewrite;
using System.Text;
using System.Security.Claims;
var builder = WebApplication.CreateBuilder(args);

// Nạp file bảo mật appsettings.Secrets.json (tự động đè các giá trị bí mật như VNPAY, PayPal, JWT nếu file tồn tại)
builder.Configuration.AddJsonFile("appsettings.Secrets.json", optional: true, reloadOnChange: true);

// Add services to the container.                                                                                                                                            
builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle                                                                                     
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Lấy chuỗi kết nối từ appsettings.json                                                                                                                                     
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", builder =>
        builder.AllowAnyOrigin()
               .AllowAnyMethod()
               .AllowAnyHeader());
});

// Kích hoạt Database                                                                                                                                                        
builder.Services.AddDbContext<DuThuyenVietDBContext>(options =>
        options.UseSqlServer(connectionString));

// Add Identity
builder.Services.AddIdentity<ApplicationUser, IdentityRole>()
    .AddEntityFrameworkStores<DuThuyenVietDBContext>()
    .AddDefaultTokenProviders();

// Add JWT Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
})
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Issuer"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
            RoleClaimType = ClaimTypes.Role,
            NameClaimType = ClaimTypes.Name
        };
    });

var app = builder.Build();

// Xử lý trang 404 tự động cho các route tĩnh không tìm thấy
app.UseStatusCodePagesWithReExecute("/404.html");

// Configure the HTTP request pipeline.                                                                                                                                      

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Rewrite Rules for Friendly URLs
var rewriteOptions = new RewriteOptions()
    .AddRewrite(@"^du-thuyen/(\d+)(?:-[a-zA-Z0-9-]+)?/?$", "cruise-detail.html?id=$1", skipRemainingRules: true);
app.UseRewriter(rewriteOptions);

app.UseDefaultFiles(); // Allow index.html/login.html by default if needed
app.UseStaticFiles();  // Serve files from wwwroot

app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Tự động tạo các quyền (Roles) nếu chưa có trong Database
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<DuThuyenVietDBContext>();
    try { context.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Reviews') AND name = 'StaffReply') ALTER TABLE Reviews ADD StaffReply NVARCHAR(MAX) NULL;"); } catch { }
    try { context.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Reviews') AND name = 'StaffReplyUserId') ALTER TABLE Reviews ADD StaffReplyUserId NVARCHAR(450) NULL;"); } catch { }
    try { context.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StoredImages') CREATE TABLE StoredImages (Id INT IDENTITY(1,1) PRIMARY KEY, FileName NVARCHAR(255) NOT NULL, ContentType NVARCHAR(100) NOT NULL, Data VARBINARY(MAX) NOT NULL, CreatedAt DATETIME DEFAULT GETDATE());"); } catch { }
    try { context.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Cruises') AND name = 'IsDeleted') ALTER TABLE Cruises ADD IsDeleted BIT NOT NULL DEFAULT 0;"); } catch { }

    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    string[] roles = { "Admin", "Manager", "Accountant", "Staff", "Customer" };
    foreach (var role in roles)
    {
        if (!await roleManager.RoleExistsAsync(role))
        {
            await roleManager.CreateAsync(new IdentityRole(role));
        }
    }
    
    // Seed Admin account
    var adminEmail = "admin@duthuyenviet.vn";
    if (await userManager.FindByEmailAsync(adminEmail) == null)
    {
        var adminUser = new ApplicationUser
        {
            UserName = "admin",
            Email = adminEmail,
            FullName = "Administrator",
            EmailConfirmed = true
        };
        await userManager.CreateAsync(adminUser, "Admin@123");
        await userManager.AddToRoleAsync(adminUser, "Admin");
    }

    var dbContext = scope.ServiceProvider.GetRequiredService<DuThuyenVietDBContext>();
    if (!await dbContext.Schedules.AnyAsync())
    {
        var cruises = await dbContext.Cruises.ToListAsync();
        foreach (var cruise in cruises)
        {
            dbContext.Schedules.Add(new Schedule { CruiseId = cruise.CruiseId, DepartureDate = DateTime.Now.AddDays(2), ReturnDate = DateTime.Now.AddDays(3), DurationLabel = "2 Ngày 1 Đêm", Status = "Open", CreatedAt = DateTime.Now });
            dbContext.Schedules.Add(new Schedule { CruiseId = cruise.CruiseId, DepartureDate = DateTime.Now.AddDays(5), ReturnDate = DateTime.Now.AddDays(7), DurationLabel = "3 Ngày 2 Đêm", Status = "Open", CreatedAt = DateTime.Now });
        }
        await dbContext.SaveChangesAsync();
    }
}

app.Run();