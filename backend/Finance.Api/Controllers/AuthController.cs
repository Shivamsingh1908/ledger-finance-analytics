using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Finance.Application.DTOs;
using Finance.Application.Services;
using Finance.Domain.Entities;
using Finance.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace Finance.Api.Controllers;

[ApiController, Route("api/auth"), EnableRateLimiting("auth")]
public class AuthController(FinanceDb db, IPasswordHasher<AppUser> hasher, IConfiguration config,
    IWebHostEnvironment environment, IHttpClientFactory clients, ILogger<AuthController> logger) : ControllerBase
{
    private const string CookieName = "finance.refresh";

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(user => user.Email == email))
            throw new BusinessException("Unable to register with this email. Try signing in.", 409);
        var user = new AppUser { Email = email, Currency = request.Currency };
        user.PasswordHash = hasher.HashPassword(user, request.Password);
        db.Users.Add(user);
        db.Accounts.Add(new Account { UserId = user.Id, Name = "Everyday account", Currency = user.Currency });
        var categories = new[] { ("Salary", "Income", "#087f70"), ("Other income", "Income", "#248ab0"),
            ("Food & drink", "Expense", "#e8a13d"), ("Housing", "Expense", "#5264be"),
            ("Transport", "Expense", "#db6573"), ("Shopping", "Expense", "#218bab"),
            ("Health", "Expense", "#65954b"), ("Other", "Expense", "#778182") };
        db.Categories.AddRange(categories.Select(category => new Category
            { UserId = user.Id, Name = category.Item1, Type = category.Item2, Color = category.Item3 }));
        await db.SaveChangesAsync();
        var result = await IssueSession(user);
        if (!string.IsNullOrEmpty(config["Resend:ApiKey"]) && !string.IsNullOrEmpty(config["Resend:From"]))
        {
            try
            {
                using var message = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
                message.Headers.Authorization = new("Bearer", config["Resend:ApiKey"]);
                message.Content = JsonContent.Create(new { from = config["Resend:From"], to = new[] { user.Email },
                    subject = "Welcome to Ledger", text = "Your finance workspace is ready. Your account has been created successfully." });
                using var response = await clients.CreateClient("email").SendAsync(message);
                if (!response.IsSuccessStatusCode) logger.LogWarning("Welcome email failed with status {Status}", response.StatusCode);
            }
            catch (HttpRequestException) { logger.LogWarning("Welcome email service is unavailable"); }
            catch (TaskCanceledException) { logger.LogWarning("Welcome email service timed out"); }
        }
        return Ok(result);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(item => item.Email == email);
        if (user is null || hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
            throw new BusinessException("Email or password is incorrect.", 401);
        return Ok(await IssueSession(user));
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        RequireBrowserHeader();
        var token = Request.Cookies[CookieName];
        if (token is null) return Unauthorized();
        var hash = Hash(token);
        await using var transaction = await db.Database.BeginTransactionAsync();
        var session = await db.RefreshSessions.IgnoreQueryFilters().SingleOrDefaultAsync(item => item.TokenHash == hash);
        if (session is null || session.ExpiresAt <= DateTime.UtcNow) return Unauthorized();
        var removed = await db.RefreshSessions.IgnoreQueryFilters().Where(item => item.Id == session.Id && item.TokenHash == hash)
            .ExecuteDeleteAsync();
        if (removed != 1) return Unauthorized();
        var user = await db.Users.SingleAsync(item => item.Id == session.UserId);
        var result = await IssueSession(user);
        await transaction.CommitAsync();
        return Ok(result);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        RequireBrowserHeader();
        if (Request.Cookies[CookieName] is { } token)
        {
            var hash = Hash(token);
            await db.RefreshSessions.IgnoreQueryFilters().Where(item => item.TokenHash == hash).ExecuteDeleteAsync();
        }
        Response.Cookies.Delete(CookieName, CookieOptions());
        return NoContent();
    }

    private void RequireBrowserHeader()
    {
        if (Request.Headers["X-Finance-Client"] != "web") throw new BusinessException("Missing request protection header.", 403);
        var origin = Request.Headers.Origin.ToString();
        var allowed = (config["Cors:AllowedOrigins"] ?? "http://localhost:5173").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (origin.Length > 0 && !allowed.Contains(origin, StringComparer.OrdinalIgnoreCase))
            throw new BusinessException("Origin is not permitted.", 403);
    }

    private CookieOptions CookieOptions() => new()
    {
        HttpOnly = true, Secure = !environment.IsDevelopment() && !environment.IsEnvironment("Testing"),
        SameSite = environment.IsProduction() ? SameSiteMode.None : SameSiteMode.Lax,
        Path = "/api/auth", Expires = DateTimeOffset.UtcNow.AddDays(7), IsEssential = true
    };

    private async Task<object> IssueSession(AppUser user)
    {
        if (Request.Cookies[CookieName] is { } previous)
        {
            var previousHash = Hash(previous);
            await db.RefreshSessions.IgnoreQueryFilters().Where(session => session.TokenHash == previousHash).ExecuteDeleteAsync();
        }
        await db.RefreshSessions.IgnoreQueryFilters().Where(session => session.UserId == user.Id && session.ExpiresAt < DateTime.UtcNow).ExecuteDeleteAsync();
        var refresh = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        db.RefreshSessions.Add(new RefreshSession { UserId = user.Id, TokenHash = Hash(refresh), ExpiresAt = DateTime.UtcNow.AddDays(7) });
        await db.SaveChangesAsync();
        Response.Cookies.Append(CookieName, refresh, CookieOptions());
        var expires = DateTime.UtcNow.AddMinutes(15);
        var jwt = new JwtSecurityToken(config["Jwt:Issuer"], config["Jwt:Audience"],
            [new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), new Claim(ClaimTypes.Email, user.Email), new Claim("currency", user.Currency)],
            expires: expires, signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!)), SecurityAlgorithms.HmacSha256));
        return new { accessToken = new JwtSecurityTokenHandler().WriteToken(jwt), expiresAt = expires,
            user = new { user.Id, user.Email, user.Currency } };
    }

    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}