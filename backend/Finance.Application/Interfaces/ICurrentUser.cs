namespace Finance.Application.Interfaces;

public interface ICurrentUser
{
    Guid Id { get; }
    string Currency { get; }
}