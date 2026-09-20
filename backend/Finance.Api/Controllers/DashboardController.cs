using Finance.Application.DTOs;
using Finance.Application.Services;
using Finance.Domain.Entities;
using Finance.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Finance.Api.Controllers;

[ApiController, Authorize, Route("api/dashboard")]
public class DashboardController(FinanceDb db) : ControllerBase
{
    [HttpGet, HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] DashboardQuery query)
    {
        var (start, end) = Resolve(query);
        var previousStart = query.From is not null && query.To is not null
            ? start.AddDays(-(end.DayNumber - start.DayNumber))
            : start.AddMonths(-1);
        var entries = await Filter(query, start, end).ToListAsync();
        var previous = await Filter(query, previousStart, start).ToListAsync();
        var income = entries.Where(entry => entry.Type == "Income").Sum(entry => entry.Amount);
        var expenses = entries.Where(entry => entry.Type == "Expense").Sum(entry => entry.Amount);
        var previousIncome = previous.Where(entry => entry.Type == "Income").Sum(entry => entry.Amount);
        var previousExpenses = previous.Where(entry => entry.Type == "Expense").Sum(entry => entry.Amount);
        var categories = await db.Categories.AsNoTracking().ToDictionaryAsync(category => category.Id);
        return Ok(new { income, expenses, net = income - expenses, savingsRate = income == 0 ? 0 : Math.Round((income - expenses) / income * 100, 1),
            previousIncome, previousExpenses, previousNet = previousIncome - previousExpenses,
            transactionCount = entries.Count,
            byCategory = entries.Where(entry => entry.Type == "Expense").GroupBy(entry => entry.CategoryId)
                .Select(group => new { categoryId = group.Key, name = categories[group.Key].Name, color = categories[group.Key].Color, amount = group.Sum(entry => entry.Amount) })
                .OrderByDescending(category => category.amount),
            recent = entries.OrderByDescending(entry => entry.TransactionDate).ThenByDescending(entry => entry.CreatedAt).Take(5) });
    }

    [HttpGet("trends")]
    public async Task<IActionResult> Trends([FromQuery] DashboardQuery query)
    {
        var anchor = query.To ?? Resolve(query).End.AddDays(-1);
        var end = new DateOnly(anchor.Year, anchor.Month, 1).AddMonths(1);
        var start = end.AddMonths(-6);
        var entries = await Filter(query, start, end).ToListAsync();
        return Ok(Enumerable.Range(0, 6).Select(offset =>
        {
            var period = start.AddMonths(offset);
            var subset = entries.Where(entry => entry.TransactionDate.Year == period.Year && entry.TransactionDate.Month == period.Month).ToList();
            return new { month = period.ToString("yyyy-MM"), income = subset.Where(entry => entry.Type == "Income").Sum(entry => entry.Amount),
                expenses = subset.Where(entry => entry.Type == "Expense").Sum(entry => entry.Amount) };
        }));
    }

    private IQueryable<Transaction> Filter(DashboardQuery query, DateOnly start, DateOnly end)
    {
        var entries = db.Transactions.AsNoTracking().Where(entry => entry.TransactionDate >= start && entry.TransactionDate < end);
        if (query.AccountId is { } account) entries = entries.Where(entry => entry.AccountId == account);
        if (query.CategoryId is { } category) entries = entries.Where(entry => entry.CategoryId == category);
        if (query.Type is { } type) entries = entries.Where(entry => entry.Type == type);
        return entries;
    }

    private static (DateOnly Start, DateOnly End) Resolve(DashboardQuery query)
    {
        if (query.From is { } from && query.To is { } to)
        {
            FinanceRules.Date(from);
            FinanceRules.Date(to);
            if (from > to) throw new BusinessException("The start date must precede the end date.");
            return (from, to.AddDays(1));
        }
        var start = FinanceRules.Month(query.Month);
        return (start, start.AddMonths(1));
    }
}