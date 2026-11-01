using System;
using System.Linq;
using System.Threading.Tasks;
using MasaPilot.Api.Services;
using MasaPilot.Application.Common;
using MasaPilot.Application.DTOs;
using MasaPilot.Domain.Entities;
using MasaPilot.Domain.Enums;
using MasaPilot.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MasaPilot.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly MasaPilotDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtService _jwt;
    private readonly ICurrentTenantService _tenantService;

    public AuthController(MasaPilotDbContext db, IPasswordHasher hasher, IJwtService jwt, ICurrentTenantService tenantService)
    {
        _db = db;
        _hasher = hasher;
        _jwt = jwt;
        _tenantService = tenantService;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterTenantRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.TenantName) || string.IsNullOrWhiteSpace(request.AdminEmail) || string.IsNullOrWhiteSpace(request.AdminPassword))
        {
            return BadRequest(new { message = "İşletme adı, e-posta ve şifre zorunludur." });
        }

        var slug = (request.Slug ?? request.TenantName.ToLowerInvariant().Replace(" ", "-")).Trim();
        if (await _db.Tenants.AnyAsync(t => t.Slug == slug))
        {
            return Conflict(new { message = "Bu işletme kısa adı (slug) zaten kullanımda." });
        }

        // Create Tenant
        var tenant = new Tenant
        {
            Name = request.TenantName,
            Slug = slug
        };
        _db.Tenants.Add(tenant);

        // Create Default Branch
        var branch = new Branch
        {
            TenantId = tenant.Id,
            Name = string.IsNullOrWhiteSpace(request.BranchName) ? "Merkez Şube" : request.BranchName,
            CurrencyCode = request.CurrencyCode,
            TimeZone = request.TimeZone
        };
        _db.Branches.Add(branch);

        // Create Admin User
        var admin = new User
        {
            TenantId = tenant.Id,
            FullName = request.AdminFullName,
            Email = request.AdminEmail.ToLowerInvariant(),
            PasswordHash = _hasher.HashPassword(request.AdminPassword),
            PinCodeHash = _hasher.HashPin("1234"), // Default quick PIN
            Role = UserRole.TenantOwner,
            DefaultBranchId = branch.Id
        };
        _db.Users.Add(admin);

        // Setup Onboarding Defaults for instant operational capability
        // 1. Kitchen & Bar Stations
        var kitchenStation = new KitchenStation { TenantId = tenant.Id, BranchId = branch.Id, Name = "Mutfak" };
        var barStation = new KitchenStation { TenantId = tenant.Id, BranchId = branch.Id, Name = "Bar" };
        _db.KitchenStations.AddRange(kitchenStation, barStation);

        // 2. Default Printers (VirtualFake so they work out of the box with zero configuration)
        var kitchenPrinter = new Printer
        {
            TenantId = tenant.Id,
            BranchId = branch.Id,
            Name = "Mutfak Termal Yazıcı",
            ConnectionType = PrinterConnectionType.VirtualFake,
            KitchenStationId = kitchenStation.Id,
            PaperWidth = "80mm"
        };
        var barPrinter = new Printer
        {
            TenantId = tenant.Id,
            BranchId = branch.Id,
            Name = "Bar Termal Yazıcı",
            ConnectionType = PrinterConnectionType.VirtualFake,
            KitchenStationId = barStation.Id,
            PaperWidth = "80mm"
        };
        var cashierPrinter = new Printer
        {
            TenantId = tenant.Id,
            BranchId = branch.Id,
            Name = "Kasa Hesap Yazıcısı",
            ConnectionType = PrinterConnectionType.VirtualFake,
            PaperWidth = "80mm"
        };
        _db.Printers.AddRange(kitchenPrinter, barPrinter, cashierPrinter);

        // 3. Default Areas & Tables
        var salonArea = new AreaFloor { TenantId = tenant.Id, BranchId = branch.Id, Name = "Salon", DisplayOrder = 1 };
        var bahceArea = new AreaFloor { TenantId = tenant.Id, BranchId = branch.Id, Name = "Bahçe", DisplayOrder = 2 };
        _db.AreaFloors.AddRange(salonArea, bahceArea);

        for (int i = 1; i <= 6; i++)
        {
            _db.DiningTables.Add(new DiningTable
            {
                TenantId = tenant.Id,
                BranchId = branch.Id,
                AreaFloorId = salonArea.Id,
                TableNumber = $"S-{i}",
                Capacity = 4,
                DisplayOrder = i,
                Status = TableStatus.Empty
            });
        }
        for (int i = 1; i <= 4; i++)
        {
            _db.DiningTables.Add(new DiningTable
            {
                TenantId = tenant.Id,
                BranchId = branch.Id,
                AreaFloorId = bahceArea.Id,
                TableNumber = $"B-{i}",
                Capacity = 4,
                DisplayOrder = i,
                Status = TableStatus.Empty
            });
        }

        // 4. Default Categories & Products
        var catHot = new Category { TenantId = tenant.Id, BranchId = branch.Id, Name = "Sıcak İçecekler", DisplayOrder = 1, ColorHex = "#EF4444" };
        var catCold = new Category { TenantId = tenant.Id, BranchId = branch.Id, Name = "Soğuk İçecekler", DisplayOrder = 2, ColorHex = "#3B82F6" };
        var catFood = new Category { TenantId = tenant.Id, BranchId = branch.Id, Name = "Ana Yemekler", DisplayOrder = 3, ColorHex = "#10B981" };
        var catDessert = new Category { TenantId = tenant.Id, BranchId = branch.Id, Name = "Tatlılar", DisplayOrder = 4, ColorHex = "#F59E0B" };
        _db.Categories.AddRange(catHot, catCold, catFood, catDessert);

        var pCay = new Product { TenantId = tenant.Id, BranchId = branch.Id, CategoryId = catHot.Id, Name = "Demleme Çay", UnitPrice = 30.00m, VatRate = 10m };
        var pKahve = new Product { TenantId = tenant.Id, BranchId = branch.Id, CategoryId = catHot.Id, Name = "Türk Kahvesi", UnitPrice = 65.00m, VatRate = 10m };
        var pLimonata = new Product { TenantId = tenant.Id, BranchId = branch.Id, CategoryId = catCold.Id, Name = "Ev Yapımı Limonata", UnitPrice = 90.00m, VatRate = 10m };
        var pBurger = new Product { TenantId = tenant.Id, BranchId = branch.Id, CategoryId = catFood.Id, Name = "MasaBurger Özel", UnitPrice = 280.00m, VatRate = 10m };
        var pPizza = new Product { TenantId = tenant.Id, BranchId = branch.Id, CategoryId = catFood.Id, Name = "Margarita Pizza", UnitPrice = 250.00m, VatRate = 10m };
        var pSufle = new Product { TenantId = tenant.Id, BranchId = branch.Id, CategoryId = catDessert.Id, Name = "Çikolatalı Sufle", UnitPrice = 140.00m, VatRate = 10m };
        _db.Products.AddRange(pCay, pKahve, pLimonata, pBurger, pPizza, pSufle);

        // Station Routes: Drinks to Bar, Foods to Kitchen
        _db.ProductStationRoutes.AddRange(
            new ProductStationRoute { TenantId = tenant.Id, BranchId = branch.Id, ProductId = pCay.Id, KitchenStationId = barStation.Id },
            new ProductStationRoute { TenantId = tenant.Id, BranchId = branch.Id, ProductId = pKahve.Id, KitchenStationId = barStation.Id },
            new ProductStationRoute { TenantId = tenant.Id, BranchId = branch.Id, ProductId = pLimonata.Id, KitchenStationId = barStation.Id },
            new ProductStationRoute { TenantId = tenant.Id, BranchId = branch.Id, ProductId = pBurger.Id, KitchenStationId = kitchenStation.Id },
            new ProductStationRoute { TenantId = tenant.Id, BranchId = branch.Id, ProductId = pPizza.Id, KitchenStationId = kitchenStation.Id },
            new ProductStationRoute { TenantId = tenant.Id, BranchId = branch.Id, ProductId = pSufle.Id, KitchenStationId = kitchenStation.Id }
        );

        // 5. Default Payment Methods
        _db.PaymentMethods.AddRange(
            new PaymentMethod { TenantId = tenant.Id, BranchId = branch.Id, Name = "Nakit", Type = PaymentType.Cash },
            new PaymentMethod { TenantId = tenant.Id, BranchId = branch.Id, Name = "Kredi / Banka Kartı", Type = PaymentType.CardExternalTerminal },
            new PaymentMethod { TenantId = tenant.Id, BranchId = branch.Id, Name = "Yemek Kartı (Sodexo / Multinet)", Type = PaymentType.MealVoucher }
        );

        // Audit Log
        _db.AuditLogs.Add(new AuditLog
        {
            TenantId = tenant.Id,
            BranchId = branch.Id,
            UserId = admin.Id,
            Action = "TenantCreated",
            EntityName = "Tenant",
            EntityId = tenant.Id,
            DetailsJson = $"{{\"TenantName\":\"{tenant.Name}\",\"AdminEmail\":\"{admin.Email}\"}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1"
        });

        await _db.SaveChangesAsync();

        var token = _jwt.GenerateToken(admin, branch.Id);
        return Ok(new AuthResponse(token, tenant.Id, branch.Id, admin.Id, admin.FullName, admin.Email, admin.Role));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "E-posta ve şifre zorunludur." });
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email.ToLowerInvariant() && u.IsActive);
        if (user == null || !_hasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Geçersiz e-posta veya şifre." });
        }

        var branch = await _db.Branches.FirstOrDefaultAsync(b => b.TenantId == user.TenantId && b.IsActive);
        var token = _jwt.GenerateToken(user, branch?.Id);

        return Ok(new AuthResponse(token, user.TenantId, branch?.Id, user.Id, user.FullName, user.Email, user.Role));
    }

    [HttpPost("pin-login")]
    public async Task<ActionResult<AuthResponse>> PinLogin([FromBody] PinLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Pin))
        {
            return BadRequest(new { message = "PIN kodu zorunludur." });
        }

        var branch = await _db.Branches.FirstOrDefaultAsync(b => b.Id == request.BranchId && b.IsActive);
        if (branch == null)
        {
            return NotFound(new { message = "Şube bulunamadı." });
        }

        // Fast search user matching pin hash in this tenant
        var users = await _db.Users.Where(u => u.TenantId == branch.TenantId && u.IsActive).ToListAsync();
        var user = users.FirstOrDefault(u => _hasher.VerifyPin(request.Pin, u.PinCodeHash));

        if (user == null)
        {
            return Unauthorized(new { message = "Geçersiz PIN kodu." });
        }

        var token = _jwt.GenerateToken(user, branch.Id);
        return Ok(new AuthResponse(token, user.TenantId, branch.Id, user.Id, user.FullName, user.Email, user.Role));
    }

    [HttpGet("me")]
    public async Task<ActionResult> GetMe()
    {
        if (!_tenantService.IsAuthenticated || !_tenantService.UserId.HasValue)
        {
            return Unauthorized();
        }

        var user = await _db.Users.FindAsync(_tenantService.UserId.Value);
        if (user == null) return NotFound();

        var branch = _tenantService.BranchId.HasValue
            ? await _db.Branches.FindAsync(_tenantService.BranchId.Value)
            : await _db.Branches.FirstOrDefaultAsync(b => b.TenantId == user.TenantId);

        return Ok(new
        {
            userId = user.Id,
            fullName = user.FullName,
            email = user.Email,
            role = user.Role.ToString(),
            tenantId = user.TenantId,
            branchId = branch?.Id,
            branchName = branch?.Name,
            currencyCode = branch?.CurrencyCode ?? "TRY"
        });
    }
}
