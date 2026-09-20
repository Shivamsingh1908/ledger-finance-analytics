namespace Finance.Domain.Entities;

public class AppUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Currency { get; set; } = "USD";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public abstract class OwnedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
}

public class Account : OwnedEntity
{
    public string Name { get; set; } = "";
    public string Type { get; set; } = "Checking";
    public decimal OpeningBalance { get; set; }
    public string Currency { get; set; } = "USD";
}

public class Category : OwnedEntity
{
    public string Name { get; set; } = "";
    public string Type { get; set; } = "Expense";
    public string Color { get; set; } = "#087f70";
}

public class Transaction : OwnedEntity
{
    public Guid AccountId { get; set; }
    public Guid CategoryId { get; set; }
    public string Type { get; set; } = "Expense";
    public decimal Amount { get; set; }
    public string Description { get; set; } = "";
    public DateOnly TransactionDate { get; set; }
    public string Fingerprint { get; set; } = "";
    public string? OccurrenceKey { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Budget : OwnedEntity
{
    public Guid CategoryId { get; set; }
    public DateOnly Month { get; set; }
    public decimal Limit { get; set; }
}

public class RecurringTransaction : OwnedEntity
{
    public Guid AccountId { get; set; }
    public Guid CategoryId { get; set; }
    public string Type { get; set; } = "Expense";
    public decimal Amount { get; set; }
    public string Description { get; set; } = "";
    public string Frequency { get; set; } = "Monthly";
    public DateOnly NextOccurrence { get; set; }
    public int DayOfMonth { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ImportBatch : OwnedEntity
{
    public string FileName { get; set; } = "";
    public int ImportedCount { get; set; }
    public int DuplicateCount { get; set; }
    public int FailedCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class RefreshSession : OwnedEntity
{
    public string TokenHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
}