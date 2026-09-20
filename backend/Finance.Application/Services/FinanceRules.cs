using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Finance.Application.Services;

public sealed class BusinessException(string message, int status = 400) : Exception(message)
{
    public int Status { get; } = status;
}

public static class FinanceRules
{
    public static void Money(decimal value)
    {
        if (decimal.Round(value, 2) != value)
            throw new BusinessException("Amounts must have at most two decimal places.");
    }

    public static void Date(DateOnly date)
    {
        if (date.Year < 2000 || date.Year > 2100)
            throw new BusinessException("Dates must be between 2000 and 2100.");
    }

    public static DateOnly Month(string? month)
    {
        if (month is null) return new DateOnly(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
        if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var result))
            throw new BusinessException("Month must be in yyyy-MM format.");
        Date(result);
        return result;
    }

    public static string Fingerprint(Guid accountId, Guid categoryId, string type, decimal amount,
        string description, DateOnly date) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
            string.Join("|", accountId, categoryId, type, amount.ToString("F2", CultureInfo.InvariantCulture),
                description.Trim().ToUpperInvariant(), date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)))));

    public static DateOnly Advance(DateOnly date, string frequency, int dayOfMonth)
    {
        var next = frequency switch
        {
            "Daily" => date.AddDays(1),
            "Weekly" => date.AddDays(7),
            "Monthly" => date.AddMonths(1),
            "Yearly" => date.AddYears(1),
            _ => throw new BusinessException("Unknown frequency.")
        };
        return frequency is "Monthly" or "Yearly"
            ? new DateOnly(next.Year, next.Month, Math.Min(dayOfMonth, DateTime.DaysInMonth(next.Year, next.Month)))
            : next;
    }
}