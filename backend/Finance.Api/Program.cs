using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Finance.Api.Identity;
using Finance.Application.Interfaces;
using Finance.Application.Services;
using Finance.Domain.Entities;
using Finance.Infrastructure.Data;
using Finance.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog((context, logging) => logging.MinimumLevel.Information()
	.MinimumLevel.Override("Microsoft", Serilog.Events.LogEventLevel.Warning)
	.WriteTo.Console());
var local = builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Testing");
builder.Configuration["Jwt:Issuer"] ??= "FinanceAnalyticsApi";
builder.Configuration["Jwt:Audience"] ??= "FinanceAnalyticsClient";
if (local) builder.Configuration["Jwt:Key"] ??= Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
var key = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(key) || Encoding.UTF8.GetByteCount(key) < 32)
	throw new InvalidOperationException("Jwt__Key must contain at least 32 bytes.");
if (!local && (string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("DefaultConnection")) ||
	string.IsNullOrWhiteSpace(builder.Configuration["Cors:AllowedOrigins"]) ||
	(builder.Configuration["Scheduler:Secret"]?.Length ?? 0) < 32))
	throw new InvalidOperationException("Production requires a database, explicit CORS origins, and a scheduler secret of at least 32 characters.");
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
builder.Services.Configure<PasswordHasherOptions>(options => options.IterationCount = 210000);
builder.Services.AddScoped<LedgerService>();
builder.Services.AddScoped<ImportService>();
builder.Services.AddScoped<RecurringService>();
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient("email", client => client.Timeout = TimeSpan.FromSeconds(5));
builder.Services.AddDbContext<FinanceDb>(options =>
{
	if (builder.Configuration["Database:Provider"] == "Postgres" || !local)
		options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
	else options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=finance.db");
});
builder.Services.AddControllers();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
	options.TokenValidationParameters = new TokenValidationParameters
	{
		ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true,
		ValidIssuer = builder.Configuration["Jwt:Issuer"], ValidAudience = builder.Configuration["Jwt:Audience"],
		IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), ClockSkew = TimeSpan.FromSeconds(15)
	});
builder.Services.AddAuthorization();
var origins = (builder.Configuration["Cors:AllowedOrigins"] ?? "http://localhost:5173").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddRateLimiter(options =>
{
	options.RejectionStatusCode = 429;
	options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
		_ => new FixedWindowRateLimiterOptions { PermitLimit = builder.Environment.IsEnvironment("Testing") ? 1000 : 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
	options.SwaggerDoc("v1", new OpenApiInfo { Title = "Finance Analytics API", Version = "v1" });
	options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme { Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT" });
	options.AddSecurityRequirement(new OpenApiSecurityRequirement { [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = [] });
});
var app = builder.Build();
app.Use(async (context, next) =>
{
	context.Response.Headers["X-Content-Type-Options"] = "nosniff";
	context.Response.Headers["Referrer-Policy"] = "no-referrer";
	context.Response.Headers.CacheControl = "no-store";
	try { await next(); }
	catch (BusinessException exception)
	{
		await Results.Problem(title: exception.Message, statusCode: exception.Status).ExecuteAsync(context);
	}
	catch (DbUpdateException)
	{
		await Results.Problem(title: "This record conflicts with existing data. Check for a duplicate or linked record.", statusCode: 409).ExecuteAsync(context);
	}
	catch (Exception exception)
	{
		app.Logger.LogError(exception, "Request failed: {TraceId}", context.TraceIdentifier);
		await Results.Problem(title: "Something went wrong. Please try again.", statusCode: 500).ExecuteAsync(context);
	}
});
if (!local) { app.UseHsts(); app.UseHttpsRedirection(); }
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseSwagger();
app.UseSwaggerUI();
app.MapControllers();
app.MapGet("/health", async (FinanceDb db) => await db.Database.CanConnectAsync()
	? Results.Ok(new { status = "healthy" }) : Results.StatusCode(503));
using (var scope = app.Services.CreateScope())
{
	var db = scope.ServiceProvider.GetRequiredService<FinanceDb>();
	// Local/tests use SQLite via EnsureCreated; production applies the Npgsql migrations.
	if (local) await db.Database.EnsureCreatedAsync();
	else await db.Database.MigrateAsync();
}
app.Run();

public partial class Program;