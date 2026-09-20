using System.Security.Claims;
using Finance.Application.Interfaces;

namespace Finance.Api.Identity;

public class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid Id => Guid.TryParse(accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : Guid.Empty;
    public string Currency => accessor.HttpContext?.User.FindFirstValue("currency") ?? "USD";
}