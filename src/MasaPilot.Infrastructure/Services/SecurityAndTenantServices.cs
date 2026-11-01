using System;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using MasaPilot.Application.Common;
using MasaPilot.Domain.Enums;
using Microsoft.AspNetCore.Http;

namespace MasaPilot.Infrastructure.Services;

public class CurrentTenantService : ICurrentTenantService
{
    private readonly IHttpContextAccessor? _httpContextAccessor;
    private Guid? _manualTenantId;
    private Guid? _manualBranchId;
    private Guid? _manualUserId;
    private UserRole? _manualRole;

    public CurrentTenantService(IHttpContextAccessor? httpContextAccessor = null)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid? TenantId
    {
        get
        {
            if (_manualTenantId.HasValue) return _manualTenantId.Value;
            var claim = _httpContextAccessor?.HttpContext?.User.FindFirst("tenant_id")?.Value;
            return Guid.TryParse(claim, out var tid) ? tid : null;
        }
    }

    public Guid? BranchId
    {
        get
        {
            if (_manualBranchId.HasValue) return _manualBranchId.Value;
            var claim = _httpContextAccessor?.HttpContext?.User.FindFirst("branch_id")?.Value;
            if (Guid.TryParse(claim, out var bid)) return bid;
            // Also check header if provided
            var header = _httpContextAccessor?.HttpContext?.Request.Headers["X-Branch-Id"].ToString();
            return Guid.TryParse(header, out var hbid) ? hbid : null;
        }
    }

    public Guid? UserId
    {
        get
        {
            if (_manualUserId.HasValue) return _manualUserId.Value;
            var claim = _httpContextAccessor?.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                        ?? _httpContextAccessor?.HttpContext?.User.FindFirst("sub")?.Value;
            return Guid.TryParse(claim, out var uid) ? uid : null;
        }
    }

    public UserRole? Role
    {
        get
        {
            if (_manualRole.HasValue) return _manualRole.Value;
            var claim = _httpContextAccessor?.HttpContext?.User.FindFirst(ClaimTypes.Role)?.Value;
            return Enum.TryParse<UserRole>(claim, out var role) ? role : null;
        }
    }

    public bool IsAuthenticated => _httpContextAccessor?.HttpContext?.User.Identity?.IsAuthenticated == true || _manualUserId.HasValue;

    public void SetManualContext(Guid tenantId, Guid branchId, Guid userId, UserRole role)
    {
        _manualTenantId = tenantId;
        _manualBranchId = branchId;
        _manualUserId = userId;
        _manualRole = role;
    }
}

public class PasswordHasher : IPasswordHasher
{
    private const int SaltSize = 16;
    private const int KeySize = 32;
    private const int Iterations = 100_000;

    public string HashPassword(string password)
    {
        if (string.IsNullOrEmpty(password)) throw new ArgumentNullException(nameof(password));

        byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
        byte[] hash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            salt,
            Iterations,
            HashAlgorithmName.SHA256,
            KeySize);

        return $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public bool VerifyPassword(string password, string hash)
    {
        if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(hash)) return false;

        var parts = hash.Split('.');
        if (parts.Length != 2) return false;

        byte[] salt = Convert.FromBase64String(parts[0]);
        byte[] expectedHash = Convert.FromBase64String(parts[1]);

        byte[] actualHash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            salt,
            Iterations,
            HashAlgorithmName.SHA256,
            KeySize);

        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }

    public string HashPin(string pin) => HashPassword(pin);
    public bool VerifyPin(string pin, string hash) => VerifyPassword(pin, hash);
}
