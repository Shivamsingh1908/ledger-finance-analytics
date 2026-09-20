using System.Security.Cryptography;
using System.Text;
using Finance.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Finance.Api.Controllers;

[ApiController, Route("api/jobs"), EnableRateLimiting("auth")]
public class JobsController(RecurringService recurring, IConfiguration configuration) : ControllerBase
{
    [HttpPost("process-recurring")]
    public async Task<IActionResult> Process()
    {
        var expected = configuration["Scheduler:Secret"];
        var supplied = Request.Headers["X-Scheduler-Secret"].ToString();
        if (string.IsNullOrEmpty(expected) || string.IsNullOrEmpty(supplied) || !CryptographicOperations.FixedTimeEquals(
                SHA256.HashData(Encoding.UTF8.GetBytes(expected)), SHA256.HashData(Encoding.UTF8.GetBytes(supplied))))
            return Unauthorized();
        return Ok(await recurring.Process(DateOnly.FromDateTime(DateTime.UtcNow)));
    }
}