using System.Globalization;
using System.Text;
using Finance.Application.DTOs;
using Finance.Application.Services;
using Finance.Infrastructure.Data;
using Finance.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Finance.Api.Controllers;

[ApiController, Authorize, Route("api")]
public class LedgerController(FinanceDb db, LedgerService ledger) : ControllerBase
{
    [HttpGet("accounts")]
    public async Task<IActionResult> Accounts()
    {
        var accounts = await db.Accounts.AsNoTracking().OrderBy(account => account.Name).ToListAsync();
        var amounts = await db.Transactions.Select(entry => new { entry.AccountId, entry.Type, entry.Amount }).ToListAsync();
        return Ok(accounts.Select(account => new { account.Id, account.Name, account.Type, account.Currency, account.OpeningBalance,
            balance = account.OpeningBalance + amounts.Where(entry => entry.AccountId == account.Id).Sum(entry => entry.Type == "Income" ? entry.Amount : -entry.Amount) }));
    }
    [HttpPost("accounts")]
    public async Task<IActionResult> AddAccount(AccountRequest request)
    {
        var account = await ledger.SaveAccount(request);
        return Created($"/api/accounts/{account.Id}", account);
    }
    [HttpPut("accounts/{id:guid}")]
    public async Task<IActionResult> UpdateAccount(Guid id, AccountRequest request) => Ok(await ledger.SaveAccount(request, id));
    [HttpDelete("accounts/{id:guid}")]
    public async Task<IActionResult> DeleteAccount(Guid id)
    {
        var account = await db.Accounts.SingleOrDefaultAsync(item => item.Id == id) ?? throw new BusinessException("Account not found.", 404);
        if (await db.Transactions.AnyAsync(entry => entry.AccountId == id) || await db.Recurring.AnyAsync(rule => rule.AccountId == id))
            throw new BusinessException("This account has transactions or recurring rules and cannot be deleted.", 409);
        db.Accounts.Remove(account);
        await db.SaveChangesAsync();
        return NoContent();
    }
    [HttpGet("categories")]
    public async Task<IActionResult> Categories() => Ok(await db.Categories.AsNoTracking().OrderBy(category => category.Name).ToListAsync());
    [HttpPost("categories")]
    public async Task<IActionResult> AddCategory(CategoryRequest request)
    {
        var category = await ledger.AddCategory(request);
        return Created($"/api/categories/{category.Id}", category);
    }
    [HttpGet("transactions")]
    public async Task<IActionResult> Transactions([FromQuery] TransactionQuery query) => Ok(await ledger.Transactions(query));
    [HttpGet("transactions/export")]
    public async Task<IActionResult> ExportTransactions([FromQuery] TransactionQuery query)
    {
        var rows = await ledger.ExportTransactions(query);
        var builder = new StringBuilder("date,description,amount,type,category,account\n");
        foreach (var row in rows)
            builder.Append(CultureInfo.InvariantCulture, $"{row.Date:yyyy-MM-dd},{Csv(row.Description)},{row.Amount.ToString(CultureInfo.InvariantCulture)},{row.Type},{Csv(row.Category)},{Csv(row.Account)}\n");
        return File(Encoding.UTF8.GetBytes(builder.ToString()), "text/csv", $"transactions-{DateTime.UtcNow:yyyy-MM-dd}.csv");
    }
    private static string Csv(string value) => value.Contains(',') || value.Contains('"') || value.Contains('\n')
        ? $"\"{value.Replace("\"", "\"\"")}\"" : value;
    [HttpPost("transactions")]
    public async Task<IActionResult> AddTransaction(TransactionRequest request)
    {
        var entry = await ledger.SaveTransaction(request);
        return Created($"/api/transactions/{entry.Id}", entry);
    }
    [HttpPut("transactions/{id:guid}")]
    public async Task<IActionResult> UpdateTransaction(Guid id, TransactionRequest request) => Ok(await ledger.SaveTransaction(request, id));
    [HttpDelete("transactions/{id:guid}")]
    public async Task<IActionResult> DeleteTransaction(Guid id)
    {
        var entry = await db.Transactions.SingleOrDefaultAsync(item => item.Id == id) ?? throw new BusinessException("Transaction not found.", 404);
        db.Transactions.Remove(entry);
        await db.SaveChangesAsync();
        return NoContent();
    }
    [HttpGet("budgets")]
    public async Task<IActionResult> Budgets([FromQuery] string? month)
    {
        var start = FinanceRules.Month(month);
        var end = start.AddMonths(1);
        var budgets = await db.Budgets.AsNoTracking().Where(budget => budget.Month == start).ToListAsync();
        var expenses = await db.Transactions.Where(entry => entry.Type == "Expense" && entry.TransactionDate >= start && entry.TransactionDate < end).ToListAsync();
        return Ok(budgets.Select(budget => new { budget.Id, budget.CategoryId, budget.Month, budget.Limit,
            spent = expenses.Where(entry => entry.CategoryId == budget.CategoryId).Sum(entry => entry.Amount) }));
    }
    [HttpPost("budgets")]
    public async Task<IActionResult> AddBudget(BudgetRequest request)
    {
        var budget = await ledger.SaveBudget(request);
        return Created($"/api/budgets/{budget.Id}", budget);
    }
    [HttpPut("budgets/{id:guid}")]
    public async Task<IActionResult> UpdateBudget(Guid id, BudgetRequest request) => Ok(await ledger.SaveBudget(request, id));
    [HttpDelete("budgets/{id:guid}")]
    public async Task<IActionResult> DeleteBudget(Guid id)
    {
        var budget = await db.Budgets.SingleOrDefaultAsync(item => item.Id == id) ?? throw new BusinessException("Budget not found.", 404);
        db.Budgets.Remove(budget);
        await db.SaveChangesAsync();
        return NoContent();
    }
    [HttpGet("recurring")]
    public async Task<IActionResult> Recurring() => Ok(await db.Recurring.AsNoTracking().OrderBy(rule => rule.NextOccurrence).ToListAsync());
    [HttpPost("recurring")]
    public async Task<IActionResult> AddRecurring(RecurringRequest request)
    {
        var rule = await ledger.SaveRecurring(request);
        return Created($"/api/recurring/{rule.Id}", rule);
    }
    [HttpPut("recurring/{id:guid}")]
    public async Task<IActionResult> UpdateRecurring(Guid id, RecurringRequest request) => Ok(await ledger.SaveRecurring(request, id));
}