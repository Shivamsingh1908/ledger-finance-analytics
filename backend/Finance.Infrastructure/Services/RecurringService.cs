using Finance.Application.Services;
using Finance.Domain.Entities;
using Finance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Finance.Infrastructure.Services;

public class RecurringService(FinanceDb db)
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public async Task<object> Process(DateOnly today)
    {
        await Gate.WaitAsync();
        try
        {
            await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var rules = await db.Recurring.IgnoreQueryFilters().Where(rule => rule.IsActive && rule.NextOccurrence <= today)
                .OrderBy(rule => rule.NextOccurrence).Take(200).ToListAsync();
            var created = 0;
            foreach (var rule in rules)
            {
                var processed = 0;
                while (rule.NextOccurrence <= today && processed < 366)
                {
                    var occurrence = $"{rule.Id}:{rule.NextOccurrence:yyyy-MM-dd}";
                    if (!await db.Transactions.IgnoreQueryFilters().AnyAsync(entry => entry.UserId == rule.UserId && entry.OccurrenceKey == occurrence))
                    {
                        db.Transactions.Add(new Transaction { UserId = rule.UserId, AccountId = rule.AccountId,
                            CategoryId = rule.CategoryId, Amount = rule.Amount, Type = rule.Type, Description = rule.Description,
                            TransactionDate = rule.NextOccurrence, OccurrenceKey = occurrence, Fingerprint = occurrence });
                        created++;
                    }
                    rule.NextOccurrence = FinanceRules.Advance(rule.NextOccurrence, rule.Frequency, rule.DayOfMonth);
                    processed++;
                }
            }
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            return new { processedRules = rules.Count, created, through = today };
        }
        finally { Gate.Release(); }
    }
}