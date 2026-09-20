using Finance.Application.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Finance.Infrastructure.Data;

// Lets `dotnet ef migrations` build the Npgsql model offline, without booting the API.
public class FinanceDbFactory : IDesignTimeDbContextFactory<FinanceDb>
{
    public FinanceDb CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<FinanceDb>()
            .UseNpgsql("Host=localhost;Database=finance_design;Username=postgres;Password=design-time-only")
            .Options;
        return new FinanceDb(options, new DesignTimeUser());
    }

    private sealed class DesignTimeUser : ICurrentUser
    {
        public Guid Id => Guid.Empty;
        public string Currency => "USD";
    }
}
