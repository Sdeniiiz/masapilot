using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MasaPilot.Domain.Entities;
using MasaPilot.Domain.Enums;

namespace MasaPilot.Application.Common;

public interface ICurrentTenantService
{
    Guid? TenantId { get; }
    Guid? BranchId { get; }
    Guid? UserId { get; }
    UserRole? Role { get; }
    bool IsAuthenticated { get; }
    void SetManualContext(Guid tenantId, Guid branchId, Guid userId, UserRole role);
}

public interface IPasswordHasher
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
    string HashPin(string pin);
    bool VerifyPin(string pin, string hash);
}

public interface IEscPosGenerator
{
    string GenerateKitchenTicket(TableSession session, Order order, IEnumerable<OrderLine> lines, string stationName, bool isReprint);
    string GeneratePreReceipt(TableSession session, IEnumerable<OrderLine> lines, Branch branch, bool isReprint);
}

public interface IBackupService
{
    Task<(string FilePath, string Checksum, long SizeBytes)> CreateBackupAsync(string destinationDirectory, CancellationToken cancellationToken = default);
    Task<(bool IsValid, string Message, Dictionary<string, int> RowCounts)> VerifyBackupAsync(string backupFilePath, string expectedChecksum, CancellationToken cancellationToken = default);
}
