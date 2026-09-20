using Finance.Application.DTOs;
using Finance.Application.Interfaces;
using Finance.Application.Services;
using Finance.Domain.Entities;
using Finance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Finance.Infrastructure.Services;

public record TransactionExportRow(DateOnly Date, string Description, decimal Amount, string Type, string Category, string Account);

public class LedgerService(FinanceDb db, ICurrentUser user)
{
    public async Task<Account> SaveAccount(AccountRequest request, Guid? id = null)
    {
        FinanceRules.Money(request.OpeningBalance);
        if (request.Currency != user.Currency) throw new BusinessException("All accounts must use your profile currency.");
        var account = id.HasValue ? await db.Accounts.SingleOrDefaultAsync(item => item.Id == id)
            ?? throw new BusinessException("Account not found.", 404) : new Account { UserId = user.Id };
        account.Name = request.Name.Trim();
        account.Type = request.Type;
        account.OpeningBalance = request.OpeningBalance;
        account.Currency = request.Currency;
        if (!id.HasValue) db.Accounts.Add(account);
        await db.SaveChangesAsync();
        return account;
    }

    public async Task<Category> AddCategory(CategoryRequest request)
    {
        var category = new Category { UserId = user.Id, Name = request.Name.Trim(), Type = request.Type, Color = request.Color };
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        return category;
    }

    public async Task ValidateReferences(Guid accountId, Guid categoryId, string type)
    {
        if (!await db.Accounts.AnyAsync(account => account.Id == accountId))
            throw new BusinessException("Account not found.", 404);
        if (!await db.Categories.AnyAsync(category => category.Id == categoryId && category.Type == type))
            throw new BusinessException("Choose a category that belongs to you and matches the transaction type.");
    }

    public async Task<Transaction> SaveTransaction(TransactionRequest request, Guid? id = null)
    {
        FinanceRules.Money(request.Amount);
        FinanceRules.Date(request.TransactionDate);
        await ValidateReferences(request.AccountId, request.CategoryId, request.Type);
        var entry = id.HasValue ? await db.Transactions.SingleOrDefaultAsync(item => item.Id == id)
            ?? throw new BusinessException("Transaction not found.", 404) : new Transaction { UserId = user.Id };
        entry.AccountId = request.AccountId;
        entry.CategoryId = request.CategoryId;
        entry.Type = request.Type;
        entry.Amount = request.Amount;
        entry.Description = request.Description.Trim();
        entry.TransactionDate = request.TransactionDate;
        entry.Fingerprint = FinanceRules.Fingerprint(entry.AccountId, entry.CategoryId, entry.Type, entry.Amount, entry.Description, entry.TransactionDate);
        if (!id.HasValue) db.Transactions.Add(entry);
        await db.SaveChangesAsync();
        return entry;
    }

    private IQueryable<Transaction> FilterAndSort(TransactionQuery request)
    {
        if (request.From > request.To) throw new BusinessException("The start date must precede the end date.");
        var query = db.Transactions.AsNoTracking();
        if (request.From.HasValue) query = query.Where(entry => entry.TransactionDate >= request.From);
        if (request.To.HasValue) query = query.Where(entry => entry.TransactionDate <= request.To);
        if (request.Type is not null) query = query.Where(entry => entry.Type == request.Type);
        if (request.CategoryId.HasValue) query = query.Where(entry => entry.CategoryId == request.CategoryId);
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim().ToLowerInvariant();
            query = query.Where(entry => entry.Description.ToLower().Contains(search));
        }
        var descending = request.SortDirection == "desc";
        IOrderedQueryable<Transaction> sorted = request.SortBy switch
        {
            "amount" => descending ? query.OrderByDescending(entry => entry.Amount) : query.OrderBy(entry => entry.Amount),
            "description" => descending ? query.OrderByDescending(entry => entry.Description) : query.OrderBy(entry => entry.Description),
            _ => descending ? query.OrderByDescending(entry => entry.TransactionDate) : query.OrderBy(entry => entry.TransactionDate)
        };
        return sorted.ThenBy(entry => entry.Id);
    }

    public async Task<object> Transactions(TransactionQuery request)
    {
        var query = FilterAndSort(request);
        var total = await query.CountAsync();
        var items = await query.Skip((request.Page - 1) * request.PageSize).Take(request.PageSize).ToListAsync();
        return new { items, total, request.Page, request.PageSize };
    }

    public async Task<List<TransactionExportRow>> ExportTransactions(TransactionQuery request)
    {
        var rows = await FilterAndSort(request).Take(10000).ToListAsync();
        var accounts = await db.Accounts.AsNoTracking().ToDictionaryAsync(account => account.Id, account => account.Name);
        var categories = await db.Categories.AsNoTracking().ToDictionaryAsync(category => category.Id, category => category.Name);
        return rows.Select(entry => new TransactionExportRow(entry.TransactionDate, entry.Description, entry.Amount, entry.Type,
            categories.GetValueOrDefault(entry.CategoryId, ""), accounts.GetValueOrDefault(entry.AccountId, ""))).ToList();
    }

    public async Task<Budget> SaveBudget(BudgetRequest request, Guid? id = null)
    {
        FinanceRules.Money(request.Limit);
        if (!await db.Categories.AnyAsync(category => category.Id == request.CategoryId && category.Type == "Expense"))
            throw new BusinessException("Choose one of your expense categories.");
        var budget = id.HasValue ? await db.Budgets.SingleOrDefaultAsync(item => item.Id == id)
            ?? throw new BusinessException("Budget not found.", 404) : new Budget { UserId = user.Id };
        budget.CategoryId = request.CategoryId;
        budget.Month = FinanceRules.Month(request.Month);
        budget.Limit = request.Limit;
        if (!id.HasValue) db.Budgets.Add(budget);
        await db.SaveChangesAsync();
        return budget;
    }

    public async Task<RecurringTransaction> SaveRecurring(RecurringRequest request, Guid? id = null)
    {
        FinanceRules.Money(request.Amount);
        FinanceRules.Date(request.NextOccurrence);
        await ValidateReferences(request.AccountId, request.CategoryId, request.Type);
        var rule = id.HasValue ? await db.Recurring.SingleOrDefaultAsync(item => item.Id == id)
            ?? throw new BusinessException("Recurring transaction not found.", 404) : new RecurringTransaction { UserId = user.Id };
        if (!id.HasValue || rule.NextOccurrence != request.NextOccurrence) rule.DayOfMonth = request.NextOccurrence.Day;
        rule.AccountId = request.AccountId;
        rule.CategoryId = request.CategoryId;
        rule.Type = request.Type;
        rule.Amount = request.Amount;
        rule.Description = request.Description.Trim();
        rule.Frequency = request.Frequency;
        rule.NextOccurrence = request.NextOccurrence;
        rule.IsActive = request.IsActive;
        if (!id.HasValue) db.Recurring.Add(rule);
        await db.SaveChangesAsync();
        return rule;
    }
}