using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class SchedulesController : ControllerBase
{
    private readonly DuThuyenVietDBContext _context;
    public SchedulesController(DuThuyenVietDBContext context) => _context = context;

    // GET /api/Schedules?cruiseId=1
    [HttpGet]
    public async Task<IActionResult> GetByCruise([FromQuery] int cruiseId)
    {
        var schedules = await _context.Schedules
            .Where(s => s.CruiseId == cruiseId && s.Status != "Deleted")
            .OrderByDescending(s => s.DepartureDate)
            .Select(s => new
            {
                s.ScheduleId,
                s.CruiseId,
                DepartureDate = s.DepartureDate.ToString("yyyy-MM-dd"),
                ReturnDate = s.ReturnDate.ToString("yyyy-MM-dd"),
                s.DurationLabel,
                s.Status
            })
            .ToListAsync();
        return Ok(schedules);
    }

    public class ScheduleDTO
    {
        public int CruiseId { get; set; }
        public DateTime DepartureDate { get; set; }
        public DateTime ReturnDate { get; set; }
        public string DurationLabel { get; set; } = string.Empty;
        public string Status { get; set; } = "Available";
    }

    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ScheduleDTO dto)
    {
        var schedule = new Schedule
        {
            CruiseId = dto.CruiseId,
            DepartureDate = dto.DepartureDate,
            ReturnDate = dto.ReturnDate,
            DurationLabel = dto.DurationLabel,
            Status = dto.Status,
            CreatedAt = DateTime.Now
        };
        _context.Schedules.Add(schedule);
        await _context.SaveChangesAsync();
        return Ok(new { schedule.ScheduleId, schedule.CruiseId, DepartureDate = schedule.DepartureDate.ToString("yyyy-MM-dd"), ReturnDate = schedule.ReturnDate.ToString("yyyy-MM-dd"), schedule.DurationLabel, schedule.Status });
    }

    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] ScheduleDTO dto)
    {
        var schedule = await _context.Schedules.FindAsync(id);
        if (schedule == null) return NotFound();

        schedule.DepartureDate = dto.DepartureDate;
        schedule.ReturnDate = dto.ReturnDate;
        schedule.DurationLabel = dto.DurationLabel;
        schedule.Status = dto.Status;

        await _context.SaveChangesAsync();
        return Ok(new { schedule.ScheduleId, schedule.CruiseId, DepartureDate = schedule.DepartureDate.ToString("yyyy-MM-dd"), ReturnDate = schedule.ReturnDate.ToString("yyyy-MM-dd"), schedule.DurationLabel, schedule.Status });
    }

    [Authorize(Roles = "Admin,Manager,Staff")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var schedule = await _context.Schedules
            .Include(s => s.Bookings)
            .Include(s => s.ScheduleCabinInventories)
            .FirstOrDefaultAsync(s => s.ScheduleId == id);

        if (schedule == null) return NotFound();

        if (schedule.Bookings != null && schedule.Bookings.Any())
        {
            schedule.Status = "Deleted";
            await _context.SaveChangesAsync();
            return Ok(new { message = "Lịch trình đã có người đặt, đã được đưa vào lưu trữ lịch sử thay vì xóa hoàn toàn." });
        }

        if (schedule.ScheduleCabinInventories != null && schedule.ScheduleCabinInventories.Any())
        {
            _context.ScheduleCabinInventories.RemoveRange(schedule.ScheduleCabinInventories);
        }

        _context.Schedules.Remove(schedule);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã xóa lịch trình" });
    }
}
