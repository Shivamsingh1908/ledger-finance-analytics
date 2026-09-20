using System.ComponentModel.DataAnnotations;
using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using Finance.Application.DTOs;
using Finance.Application.Interfaces;
using Finance.Application.Services;
using Finance.Domain.Entities;
using Finance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Finance.Infrastructure.Services;

public record ImportRow(int Row, string Description, string Date, string Amount, string Type, string Category,
    string Status, string? Error, Transaction? Entry);
public sealed class ImportPreview
{
    public Guid Id { get; } = Guid.NewGuid();
    public string FileName { get; init; } = "";
    public List<ImportRow> Rows { get; init; } = [];
    public SemaphoreSlim Gate { get; } = new(1, 1);
    public ImportBatch? Result { get; set; }
}

public class ImportService(FinanceDb db, ICurrentUser user, IMemoryCache cache)
{
    public async Task<object> Preview(Stream stream, string fileName, Guid accountId)
    {
        if (!await db.Accounts.AnyAsync(account => account.Id == accountId)) throw new BusinessException("Account not found.", 404);
        var categories = await db.Categories.AsNoTracking().ToListAsync();
        using var reader = new StreamReader(stream);
        using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            TrimOptions = TrimOptions.Trim, MaxFieldSize = 1000,
            PrepareHeaderForMatch = args => args.Header.Trim().ToLowerInvariant()
        });
        var rows = new List<ImportRow>();
        try
        {
            if (!await csv.ReadAsync()) throw new BusinessException("The CSV file is empty.");
            csv.ReadHeader();
            var headers = csv.HeaderRecord?.Select(header => header.Trim().ToLowerInvariant()).ToArray() ?? [];
            var required = new[] { "date", "description", "amount", "type", "category" };
            if (required.Any(header => !headers.Contains(header)) || headers.Distinct().Count() != headers.Length)
                throw new BusinessException("CSV must contain unique headers: date,description,amount,type,category.");
            var fingerprints = new HashSet<string>();
            while (await csv.ReadAsync())
            {
                if (rows.Count == 2000) throw new BusinessException("Import at most 2,000 rows at a time.");
                var dateText = csv.GetField("date") ?? "";
                var description = csv.GetField("description") ?? "";
                var amountText = csv.GetField("amount") ?? "";
                var type = csv.GetField("type") ?? "";
                type = type.Equals("income", StringComparison.OrdinalIgnoreCase) ? "Income" : type.Equals("expense", StringComparison.OrdinalIgnoreCase) ? "Expense" : type;
                var categoryText = csv.GetField("category") ?? "";
                Transaction? entry = null;
                string? error = null;
                var status = "Valid";
                try
                {
                    if (!DateOnly.TryParseExact(dateText, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                        throw new BusinessException("Date must use yyyy-MM-dd.");
                    if (!decimal.TryParse(amountText, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var amount))
                        throw new BusinessException("Amount must be a positive number, without currency symbols or commas.");
                    var category = categories.FirstOrDefault(item => item.Name.Equals(categoryText, StringComparison.OrdinalIgnoreCase) && item.Type == type)
                        ?? throw new BusinessException("Category was not found for this transaction type.");
                    var request = new TransactionRequest(accountId, category.Id, type, amount, description, date);
                    var results = new List<ValidationResult>();
                    if (!Validator.TryValidateObject(request, new ValidationContext(request), results, true))
                        throw new BusinessException(string.Join(" ", results.Select(result => result.ErrorMessage)));
                    FinanceRules.Date(date);
                    FinanceRules.Money(amount);
                    var fingerprint = FinanceRules.Fingerprint(accountId, category.Id, type, amount, description, date);
                    entry = new Transaction { UserId = user.Id, AccountId = accountId, CategoryId = category.Id, Type = type,
                        Amount = amount, Description = description.Trim(), TransactionDate = date, Fingerprint = fingerprint };
                    if (!fingerprints.Add(fingerprint)) status = "Duplicate";
                }
                catch (BusinessException exception) { error = exception.Message; status = "Invalid"; }
                rows.Add(new ImportRow(rows.Count + 2, description, dateText, amountText, type, categoryText, status, error, entry));
            }
            var existing = await db.Transactions.Where(entry => fingerprints.Contains(entry.Fingerprint)).Select(entry => entry.Fingerprint).ToListAsync();
            var existingSet = existing.ToHashSet();
            rows = rows.Select(row => row.Entry is not null && existingSet.Contains(row.Entry.Fingerprint) ? row with { Status = "Duplicate" } : row).ToList();
        }
        catch (CsvHelperException) { throw new BusinessException("CSV is malformed. Check quoting, column counts, and field lengths."); }
        if (rows.Count == 0) throw new BusinessException("The CSV file contains no data rows.");
        var preview = new ImportPreview { FileName = Path.GetFileName(fileName), Rows = rows };
        cache.Set($"import:{user.Id}", preview, TimeSpan.FromMinutes(15));
        return new { previewId = preview.Id, preview.FileName, expiresInMinutes = 15,
            validCount = rows.Count(row => row.Status == "Valid"), duplicateCount = rows.Count(row => row.Status == "Duplicate"),
            failedCount = rows.Count(row => row.Status == "Invalid"),
            rows = rows.Select(row => new { row.Row, row.Description, row.Date, row.Amount, row.Type, row.Category, row.Status, row.Error }) };
    }

    public async Task<ImportBatch> Confirm(Guid previewId)
    {
        if (!cache.TryGetValue<ImportPreview>($"import:{user.Id}", out var preview) || preview is null || preview.Id != previewId)
            throw new BusinessException("Preview expired or was replaced. Upload the CSV again.", 404);
        await preview.Gate.WaitAsync();
        try
        {
            if (preview.Result is not null) return preview.Result;
            await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var candidates = preview.Rows.Where(row => row.Status == "Valid").Select(row => row.Entry!).ToList();
            var fingerprints = candidates.Select(entry => entry.Fingerprint).ToArray();
            var existing = (await db.Transactions.Where(entry => fingerprints.Contains(entry.Fingerprint)).Select(entry => entry.Fingerprint).ToListAsync()).ToHashSet();
            var entries = candidates.Where(entry => !existing.Contains(entry.Fingerprint)).ToList();
            db.Transactions.AddRange(entries);
            var batch = new ImportBatch { UserId = user.Id, FileName = preview.FileName, ImportedCount = entries.Count,
                DuplicateCount = preview.Rows.Count(row => row.Status == "Duplicate") + candidates.Count - entries.Count,
                FailedCount = preview.Rows.Count(row => row.Status == "Invalid") };
            db.ImportBatches.Add(batch);
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            preview.Result = batch;
            return batch;
        }
        finally { preview.Gate.Release(); }
    }
}