using DuThuyenVietAPI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DuThuyenVietAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class DestinationsController : ControllerBase
{
    private readonly DuThuyenVietDBContext _context;

    public DestinationsController(DuThuyenVietDBContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetDestinations()
    {
        try
        {
            var destinations = await _context.Destinations
                .Where(d => d.IsActive)
                .Select(d => new
                {
                    d.DestinationId,
                    d.Name,
                    d.Slug,
                    d.ImageUrl,
                    CruiseCount = d.Cruises.Count(c => c.IsActive)
                })
                .ToListAsync();
            return Ok(destinations);
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Lỗi server: " + ex.Message);
        }
    }
}
