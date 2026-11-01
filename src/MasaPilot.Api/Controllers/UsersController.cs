using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using MasaPilot.Api.Services;
using MasaPilot.Application.Common;
using MasaPilot.Domain.Entities;
using MasaPilot.Domain.Enums;
using MasaPilot.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MasaPilot.Api.Controllers;

public record UserDto(Guid Id, string FullName, string Email, string Role, bool IsActive, DateTime CreatedAtUtc);
public record CreateUserRequest(string FullName, string Email, string Password, string Pin, string Role);

[ApiController]
[Authorize]
[Route("api/v1/users")]
public class UsersController : ControllerBase
{
    private readonly MasaPilotDbContext _db;
    private readonly ICurrentTenantService _tenantService;
    private readonly IPasswordHasher _hasher;

    public UsersController(MasaPilotDbContext db, ICurrentTenantService tenantService, IPasswordHasher hasher)
    {
        _db = db;
        _tenantService = tenantService;
        _hasher = hasher;
    }

    [HttpGet]
    public async Task<ActionResult<List<UserDto>>> GetUsers()
    {
        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue) return BadRequest();

        var users = await _db.Users
            .Where(u => u.TenantId == tenantId.Value && u.IsActive)
            .OrderBy(u => u.FullName)
            .Select(u => new UserDto(
                u.Id,
                u.FullName,
                u.Email,
                u.Role.ToString(),
                u.IsActive,
                u.CreatedAtUtc
            ))
            .ToListAsync();

        return Ok(users);
    }

    [HttpPost]
    public async Task<ActionResult<UserDto>> CreateUser([FromBody] CreateUserRequest request)
    {
        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue) return BadRequest();

        if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { message = "Ad soyad ve e-posta zorunludur." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.TenantId == tenantId.Value && u.Email == normalizedEmail))
        {
            return Conflict(new { message = "Bu e-posta adresine sahip bir kullanıcı zaten mevcut." });
        }

        var role = Enum.TryParse<UserRole>(request.Role, true, out var parsedRole) ? parsedRole : UserRole.Waiter;

        var user = new User
        {
            TenantId = tenantId.Value,
            FullName = request.FullName.Trim(),
            Email = normalizedEmail,
            PasswordHash = _hasher.HashPassword(string.IsNullOrWhiteSpace(request.Password) ? "MasaPilot123!" : request.Password),
            PinCodeHash = _hasher.HashPin(string.IsNullOrWhiteSpace(request.Pin) ? "1234" : request.Pin),
            Role = role,
            IsActive = true
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(new UserDto(user.Id, user.FullName, user.Email, user.Role.ToString(), user.IsActive, user.CreatedAtUtc));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue) return BadRequest();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId.Value);
        if (user == null) return NotFound();

        // Soft delete
        user.IsActive = false;
        await _db.SaveChangesAsync();

        return NoContent();
    }
}
