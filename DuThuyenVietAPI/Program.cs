using DuThuyenVietAPI.Models;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.                                                                                                                                            
builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle                                                                                     
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Lấy chuỗi kết nối từ appsettings.json                                                                                                                                     
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

// Kích hoạt Database                                                                                                                                                        
builder.Services.AddDbContext<DuThuyenVietDBContext>(options =>
        options.UseSqlServer(connectionString));

var app = builder.Build();
// Configure the HTTP request pipeline.                                                                                                                                      

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();