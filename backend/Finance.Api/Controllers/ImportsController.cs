using Finance.Application.DTOs;
using Finance.Application.Services;
using Finance.Infrastructure.Data;
using Finance.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Finance.Api.Controllers;

[ApiController, Authorize, Route("api/imports"), EnableRateLimiting("auth")]
public class ImportsController(ImportService imports, FinanceDb db) : ControllerBase
{
    [HttpPost("preview"), RequestSizeLimit(2_200_000), RequestFormLimits(MultipartBodyLengthLimit = 2_200_000)]
    public async Task<IActionResult> Preview(IFormFile file, [FromForm] Guid accountId)
    {
        if (file.Length is 0 or > 2_000_000 || !Path.GetExtension(file.FileName).Equals(".csv", StringComparison.OrdinalIgnoreCase))
            throw new BusinessException("Choose a non-empty .csv file under 2 MB.");
        await using var stream = file.OpenReadStream();
        return Ok(await imports.Preview(stream, file.FileName, accountId));
    }
    [HttpPost("confirm")]
    public async Task<IActionResult> Confirm(ConfirmImportRequest request) => Ok(await imports.Confirm(request.PreviewId));
    [HttpGet]
    public async Task<IActionResult> History() => Ok(await db.ImportBatches.AsNoTracking().OrderByDescending(batch => batch.CreatedAt).Take(20).ToListAsync());
}