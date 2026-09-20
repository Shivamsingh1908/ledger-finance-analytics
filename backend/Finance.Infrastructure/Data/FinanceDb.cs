using Finance.Application.Interfaces;
using Finance.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Finance.Infrastructure.Data;

public class FinanceDb(DbContextOptions<FinanceDb> options, ICurrentUser currentUser) : DbContext(options)
{
    public Guid UserId => currentUser.Id;
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Budget> Budgets => Set<Budget>();
    public DbSet<RecurringTransaction> Recurring => Set<RecurringTransaction>();
    public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();
    public DbSet<RefreshSession> RefreshSessions => Set<RefreshSession>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<AppUser>().HasIndex(user => user.Email).IsUnique();
        ConfigureOwned<Account>(model);
        ConfigureOwned<Category>(model);
        ConfigureOwned<Transaction>(model);
        ConfigureOwned<Budget>(model);
        ConfigureOwned<RecurringTransaction>(model);
        ConfigureOwned<ImportBatch>(model);
        ConfigureOwned<RefreshSession>(model);
        model.Entity<Account>().HasIndex(account => new { account.UserId, account.Name }).IsUnique();
        model.Entity<Category>().HasIndex(category => new { category.UserId, category.Name, category.Type }).IsUnique();
        model.Entity<Transaction>().HasIndex(entry => new { entry.UserId, entry.Fingerprint }).IsUnique();
        model.Entity<Transaction>().HasIndex(entry => new { entry.UserId, entry.TransactionDate });
        model.Entity<Transaction>().HasIndex(entry => entry.OccurrenceKey).IsUnique();
        model.Entity<Budget>().HasIndex(budget => new { budget.UserId, budget.CategoryId, budget.Month }).IsUnique();
        model.Entity<RefreshSession>().HasIndex(session => session.TokenHash).IsUnique();
        model.Entity<Transaction>().HasOne<Account>().WithMany().HasForeignKey(entry => new { entry.AccountId, entry.UserId })
            .HasPrincipalKey(account => new { account.Id, account.UserId }).OnDelete(DeleteBehavior.Restrict);
        model.Entity<Transaction>().HasOne<Category>().WithMany().HasForeignKey(entry => new { entry.CategoryId, entry.UserId })
            .HasPrincipalKey(category => new { category.Id, category.UserId }).OnDelete(DeleteBehavior.Restrict);
        model.Entity<Budget>().HasOne<Category>().WithMany().HasForeignKey(budget => new { budget.CategoryId, budget.UserId })
            .HasPrincipalKey(category => new { category.Id, category.UserId }).OnDelete(DeleteBehavior.Restrict);
        model.Entity<RecurringTransaction>().HasOne<Account>().WithMany().HasForeignKey(rule => new { rule.AccountId, rule.UserId })
            .HasPrincipalKey(account => new { account.Id, account.UserId }).OnDelete(DeleteBehavior.Restrict);
        model.Entity<RecurringTransaction>().HasOne<Category>().WithMany().HasForeignKey(rule => new { rule.CategoryId, rule.UserId })
            .HasPrincipalKey(category => new { category.Id, category.UserId }).OnDelete(DeleteBehavior.Restrict);
        foreach (var property in model.Model.GetEntityTypes().SelectMany(entity => entity.GetProperties())
                     .Where(property => property.ClrType == typeof(decimal)))
            property.SetValueConverter(new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<decimal, long>(
                value => (long)(value * 100), value => value / 100m));
    }

    private void ConfigureOwned<TEntity>(ModelBuilder model) where TEntity : OwnedEntity
    {
        model.Entity<TEntity>().HasQueryFilter(entity => entity.UserId == UserId);
        model.Entity<TEntity>().HasOne<AppUser>().WithMany().HasForeignKey(entity => entity.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}