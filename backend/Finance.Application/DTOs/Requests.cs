using System.ComponentModel.DataAnnotations;

namespace Finance.Application.DTOs;

public record RegisterRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, StringLength(128, MinimumLength = 12)] string Password,
    [RegularExpression("^(USD|EUR|GBP|INR|CAD|AUD)$")] string Currency = "USD");
public record LoginRequest([Required, EmailAddress, MaxLength(254)] string Email,
    [Required, MaxLength(128)] string Password);
public record AccountRequest([Required, StringLength(80, MinimumLength = 1)] string Name,
    [Required, RegularExpression("^(Checking|Savings|Cash|Credit)$")] string Type,
    [Range(typeof(decimal), "-999999999", "999999999")] decimal OpeningBalance,
    [Required, RegularExpression("^(USD|EUR|GBP|INR|CAD|AUD)$")] string Currency);
public record CategoryRequest([Required, StringLength(60, MinimumLength = 1)] string Name,
    [Required, RegularExpression("^(Income|Expense)$")] string Type,
    [Required, RegularExpression("^#[0-9a-fA-F]{6}$")] string Color);
public record TransactionRequest(Guid AccountId, Guid CategoryId,
    [Required, RegularExpression("^(Income|Expense)$")] string Type,
    [Range(typeof(decimal), "0.01", "999999999")] decimal Amount,
    [Required, StringLength(300, MinimumLength = 1)] string Description,
    DateOnly TransactionDate);
public record BudgetRequest(Guid CategoryId, [Required] string Month,
    [Range(typeof(decimal), "0.01", "999999999")] decimal Limit);
public record RecurringRequest(Guid AccountId, Guid CategoryId,
    [Required, RegularExpression("^(Income|Expense)$")] string Type,
    [Range(typeof(decimal), "0.01", "999999999")] decimal Amount,
    [Required, StringLength(300, MinimumLength = 1)] string Description,
    [Required, RegularExpression("^(Daily|Weekly|Monthly|Yearly)$")] string Frequency,
    DateOnly NextOccurrence, bool IsActive = true);
public record ConfirmImportRequest(Guid PreviewId);
public class TransactionQuery
{
    [Range(1, 100000)] public int Page { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 20;
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    [RegularExpression("^(Income|Expense)$")] public string? Type { get; set; }
    public Guid? CategoryId { get; set; }
    [MaxLength(100)] public string? Search { get; set; }
    [RegularExpression("^(transactionDate|amount|description)$")] public string SortBy { get; set; } = "transactionDate";
    [RegularExpression("^(asc|desc)$")] public string SortDirection { get; set; } = "desc";
}
public class DashboardQuery
{
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    public Guid? AccountId { get; set; }
    public Guid? CategoryId { get; set; }
    [RegularExpression("^(Income|Expense)$")] public string? Type { get; set; }
    public string? Month { get; set; }
}