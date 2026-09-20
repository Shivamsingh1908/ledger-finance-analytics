using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Finance.Application.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Finance.Tests;

public class FinanceFactory : WebApplicationFactory<Program>
{
    private readonly string database = Path.Combine(Path.GetTempPath(), $"finance-test-{Guid.NewGuid()}.db");
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = $"Data Source={database}",
            ["Scheduler:Secret"] = "test-only-scheduler-secret-not-for-production"
        }));
    }
    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        foreach (var suffix in new[] { "", "-wal", "-shm" }) if (File.Exists(database + suffix)) File.Delete(database + suffix);
    }
}

public class ApiTests(FinanceFactory factory) : IClassFixture<FinanceFactory>
{
    private async Task<HttpClient> Register()
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new { email = $"{Guid.NewGuid()}@example.com", password = "LocalTestPassword!42", currency = "USD" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var auth = await response.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.GetProperty("accessToken").GetString());
        client.DefaultRequestHeaders.Add("X-Finance-Client", "web");
        return client;
    }
    private static async Task<(Guid Account, Guid Category)> References(HttpClient client)
    {
        var accounts = await client.GetFromJsonAsync<JsonElement>("/api/accounts");
        var categories = await client.GetFromJsonAsync<JsonElement>("/api/categories");
        return (accounts[0].GetProperty("id").GetGuid(), categories.EnumerateArray().First(category => category.GetProperty("type").GetString() == "Expense").GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task TenantIsolationAndDashboardAreEnforced()
    {
        using var owner = await Register();
        using var stranger = await Register();
        var refs = await References(owner);
        var payload = new { accountId = refs.Account, categoryId = refs.Category, type = "Expense", amount = 12.34m, description = "Coffee", transactionDate = "2026-09-02" };
        var created = await owner.PostAsJsonAsync("/api/transactions", payload);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var entry = await created.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.DeleteAsync($"/api/transactions/{entry.GetProperty("id").GetGuid()}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PostAsJsonAsync("/api/transactions", payload)).StatusCode);
        var strangerEntries = await stranger.GetFromJsonAsync<JsonElement>("/api/transactions");
        Assert.Equal(0, strangerEntries.GetProperty("total").GetInt32());
        var summary = await owner.GetFromJsonAsync<JsonElement>("/api/dashboard/summary?month=2026-09");
        Assert.Equal(12.34m, summary.GetProperty("expenses").GetDecimal());
        Assert.Equal(-12.34m, summary.GetProperty("net").GetDecimal());
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsJsonAsync("/api/transactions", payload)).StatusCode);
    }

    [Fact]
    public async Task RefreshRotatesAndLogoutRevokesSession()
    {
        using var client = await Register();
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync("/api/auth/refresh", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/auth/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync("/api/auth/refresh", null)).StatusCode);
        using var anonymous = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/transactions")).StatusCode);
    }

    [Fact]
    public async Task CsvPreviewRejectsBadRowsAndConfirmationIsIdempotent()
    {
        using var client = await Register();
        using var stranger = await Register();
        var refs = await References(client);
        var categories = await client.GetFromJsonAsync<JsonElement>("/api/categories");
        var category = categories.EnumerateArray().First(item => item.GetProperty("id").GetGuid() == refs.Category).GetProperty("name").GetString();
        var csv = $"date,description,amount,type,category\n2026-09-01,Lunch,10.25,Expense,{category}\n2026-09-01,Lunch,10.25,Expense,{category}\nwrong,Bad,2,Expense,{category}\n2026-09-01,Bad,-5,Expense,{category}\n";
        using var form = new MultipartFormDataContent();
        form.Add(new StringContent(refs.Account.ToString()), "accountId");
        form.Add(new StringContent(csv), "file", "statement.csv");
        var response = await client.PostAsync("/api/imports/preview", form);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var preview = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, preview.GetProperty("validCount").GetInt32());
        Assert.Equal(1, preview.GetProperty("duplicateCount").GetInt32());
        Assert.Equal(2, preview.GetProperty("failedCount").GetInt32());
        var confirm = new { previewId = preview.GetProperty("previewId").GetGuid() };
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PostAsJsonAsync("/api/imports/confirm", confirm)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/imports/confirm", confirm)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/imports/confirm", confirm)).StatusCode);
        var entries = await client.GetFromJsonAsync<JsonElement>("/api/transactions");
        Assert.Equal(1, entries.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task SchedulerRequiresSecretAndRetriesDoNotDuplicate()
    {
        using var client = await Register();
        var refs = await References(client);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var response = await client.PostAsJsonAsync("/api/recurring", new { accountId = refs.Account, categoryId = refs.Category,
            type = "Expense", amount = 15m, description = "Subscription", frequency = "Monthly", nextOccurrence = today.ToString("yyyy-MM-dd"), isActive = true });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync("/api/jobs/process-recurring", null)).StatusCode);
        client.DefaultRequestHeaders.Add("X-Scheduler-Secret", "test-only-scheduler-secret-not-for-production");
        var results = await Task.WhenAll(client.PostAsync("/api/jobs/process-recurring", null), client.PostAsync("/api/jobs/process-recurring", null));
        Assert.All(results, result => Assert.Equal(HttpStatusCode.OK, result.StatusCode));
        var entries = await client.GetFromJsonAsync<JsonElement>("/api/transactions");
        Assert.Equal(1, entries.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task BudgetsValidationAndTransactionFilteringWork()
    {
        using var client = await Register();
        var refs = await References(client);
        var invalid = await client.PostAsJsonAsync("/api/transactions", new { accountId = refs.Account, categoryId = refs.Category,
            type = "Expense", amount = 1.001m, description = "Bad precision", transactionDate = "2026-09-01" });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var budget = await client.PostAsJsonAsync("/api/budgets", new { categoryId = refs.Category, month = "2026-09", limit = 100m });
        Assert.Equal(HttpStatusCode.Created, budget.StatusCode);
        await client.PostAsJsonAsync("/api/transactions", new { accountId = refs.Account, categoryId = refs.Category,
            type = "Expense", amount = 20m, description = "Coffee beans", transactionDate = "2026-09-01" });
        var budgets = await client.GetFromJsonAsync<JsonElement>("/api/budgets?month=2026-09");
        Assert.Equal(20m, budgets[0].GetProperty("spent").GetDecimal());
        var filtered = await client.GetFromJsonAsync<JsonElement>("/api/transactions?search=COFFEE&sortBy=amount&sortDirection=asc&pageSize=1");
        Assert.Equal(1, filtered.GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/transactions?pageSize=1000")).StatusCode);
    }

    [Theory]
    [InlineData("2026-01-31", "Monthly", 31, "2026-02-28")]
    [InlineData("2026-02-28", "Monthly", 31, "2026-03-31")]
    [InlineData("2024-02-29", "Yearly", 29, "2025-02-28")]
    public void RecurrenceRetainsCalendarAnchor(string date, string frequency, int anchor, string expected)
        => Assert.Equal(DateOnly.Parse(expected), FinanceRules.Advance(DateOnly.Parse(date), frequency, anchor));
}