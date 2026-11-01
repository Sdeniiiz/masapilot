using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using MasaPilot.Application.Common;
using MasaPilot.Application.DTOs;
using MasaPilot.Domain.Entities;
using MasaPilot.Domain.Enums;
using MasaPilot.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MasaPilot.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1")]
public class ShiftsController : ControllerBase
{
    private readonly MasaPilotDbContext _db;
    private readonly ICurrentTenantService _tenantService;

    public ShiftsController(MasaPilotDbContext db, ICurrentTenantService tenantService)
    {
        _db = db;
        _tenantService = tenantService;
    }

    [HttpGet("shifts/current")]
    public async Task<ActionResult<ShiftDto?>> GetCurrentShift()
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var shift = await _db.Shifts
            .Where(s => s.TenantId == tenantId.Value && s.BranchId == branchId.Value && s.ClosedAtUtc == null)
            .OrderByDescending(s => s.OpenedAtUtc)
            .FirstOrDefaultAsync();

        if (shift == null) return Ok(null);

        var user = await _db.Users.FindAsync(shift.OpenedByUserId);

        // Calculate expected cash from cash payments during this shift
        var cashMethod = await _db.PaymentMethods.FirstOrDefaultAsync(m => m.BranchId == branchId.Value && m.Type == PaymentType.Cash);
        var cashTotal = 0.00m;
        if (cashMethod != null)
        {
            cashTotal = await _db.Payments
                .Where(p => p.BranchId == branchId.Value && p.PaymentMethodId == cashMethod.Id && p.ProcessedAtUtc >= shift.OpenedAtUtc && p.Status == PaymentStatus.Completed)
                .SumAsync(p => p.Amount);
        }

        var expectedCash = shift.StartingCash + cashTotal;

        return Ok(new ShiftDto(
            shift.Id,
            shift.OpenedByUserId,
            user?.FullName ?? "Kullanıcı",
            shift.OpenedAtUtc,
            shift.ClosedAtUtc,
            shift.StartingCash,
            expectedCash,
            shift.ActualCash,
            shift.Difference,
            shift.Notes,
            shift.ClosedAtUtc == null
        ));
    }

    [HttpPost("shifts/open")]
    public async Task<ActionResult<ShiftDto>> OpenShift([FromBody] OpenShiftRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        var userId = _tenantService.UserId;
        if (!tenantId.HasValue || !branchId.HasValue || !userId.HasValue) return BadRequest();

        var existingOpenShift = await _db.Shifts.FirstOrDefaultAsync(s => s.BranchId == branchId.Value && s.ClosedAtUtc == null);
        if (existingOpenShift != null)
        {
            return BadRequest("Şu anda açık bir kasa/vardiya zaten bulunmaktadır.");
        }

        var shift = new Shift
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            OpenedByUserId = userId.Value,
            OpenedAtUtc = DateTime.UtcNow,
            StartingCash = request.StartingCash,
            Notes = request.Notes
        };

        _db.Shifts.Add(shift);
        await _db.SaveChangesAsync();

        var user = await _db.Users.FindAsync(userId.Value);
        return Ok(new ShiftDto(shift.Id, shift.OpenedByUserId, user?.FullName ?? "", shift.OpenedAtUtc, null, shift.StartingCash, shift.StartingCash, 0m, 0m, shift.Notes, true));
    }

    [HttpPost("shifts/close")]
    public async Task<ActionResult<ShiftDto>> CloseShift([FromBody] CloseShiftRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var shift = await _db.Shifts.FirstOrDefaultAsync(s => s.BranchId == branchId.Value && s.ClosedAtUtc == null);
        if (shift == null) return NotFound("Açık kasa/vardiya bulunamadı.");

        var cashMethod = await _db.PaymentMethods.FirstOrDefaultAsync(m => m.BranchId == branchId.Value && m.Type == PaymentType.Cash);
        var cashTotal = 0.00m;
        if (cashMethod != null)
        {
            cashTotal = await _db.Payments
                .Where(p => p.BranchId == branchId.Value && p.PaymentMethodId == cashMethod.Id && p.ProcessedAtUtc >= shift.OpenedAtUtc && p.Status == PaymentStatus.Completed)
                .SumAsync(p => p.Amount);
        }

        shift.ExpectedCash = shift.StartingCash + cashTotal;
        shift.ActualCash = request.ActualCash;
        shift.Difference = shift.ActualCash - shift.ExpectedCash;
        shift.ClosedAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrEmpty(request.Notes)) shift.Notes = request.Notes;

        await _db.SaveChangesAsync();

        var user = await _db.Users.FindAsync(shift.OpenedByUserId);
        return Ok(new ShiftDto(shift.Id, shift.OpenedByUserId, user?.FullName ?? "", shift.OpenedAtUtc, shift.ClosedAtUtc, shift.StartingCash, shift.ExpectedCash, shift.ActualCash, shift.Difference, shift.Notes, false));
    }

    [HttpGet("payment-methods")]
    public async Task<ActionResult<List<PaymentMethodDto>>> GetPaymentMethods()
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var methods = await _db.PaymentMethods
            .Where(m => m.TenantId == tenantId.Value && m.BranchId == branchId.Value && m.IsActive)
            .Select(m => new PaymentMethodDto(m.Id, m.Name, m.Type, m.IsActive))
            .ToListAsync();

        return Ok(methods);
    }
}

[ApiController]
[Authorize]
[Route("api/v1/reports")]
public class ReportsController : ControllerBase
{
    private readonly MasaPilotDbContext _db;
    private readonly ICurrentTenantService _tenantService;

    public ReportsController(MasaPilotDbContext db, ICurrentTenantService tenantService)
    {
        _db = db;
        _tenantService = tenantService;
    }

    [HttpGet("daily")]
    public async Task<ActionResult<DailySalesReport>> GetDailyReport([FromQuery] DateTime? date)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var targetDate = (date ?? DateTime.UtcNow).Date;
        var nextDate = targetDate.AddDays(1);

        var sessions = await _db.TableSessions
            .Include(s => s.Orders).ThenInclude(o => o.OrderLines)
            .Include(s => s.Payments).ThenInclude(p => p.PaymentMethod)
            .Where(s => s.TenantId == tenantId.Value && s.BranchId == branchId.Value
                        && s.OpenedAtUtc >= targetDate && s.OpenedAtUtc < nextDate
                        && s.Status != SessionStatus.Cancelled)
            .ToListAsync();

        var activeLines = sessions.SelectMany(s => s.Orders).SelectMany(o => o.OrderLines).Where(l => l.Status != OrderLineStatus.Voided).ToList();
        var completedPayments = sessions.SelectMany(s => s.Payments).Where(p => p.Status == PaymentStatus.Completed).ToList();

        var grossSales = activeLines.Sum(l => l.LineTotal);
        var totalTax = activeLines.Sum(l => l.LineTax);
        var totalDiscounts = sessions.Sum(s => s.DiscountTotal);
        var netSales = grossSales - totalTax - totalDiscounts;

        var paymentBreakdown = completedPayments
            .GroupBy(p => p.PaymentMethod?.Name ?? "Diğer")
            .Select(g => new PaymentMethodTotalDto(g.Key, g.Sum(p => p.Amount), g.Count()))
            .ToList();

        var topProducts = activeLines
            .GroupBy(l => l.ProductNameSnapshot)
            .Select(g => new ProductSalesDto(g.Key, g.Sum(l => l.LineTotal), g.Sum(l => l.Quantity)))
            .OrderByDescending(p => p.TotalAmount)
            .Take(10)
            .ToList();

        var report = new DailySalesReport(
            targetDate,
            grossSales,
            netSales,
            totalTax,
            totalDiscounts,
            sessions.SelectMany(s => s.Orders).Count(),
            sessions.Count,
            paymentBreakdown,
            new List<CategorySalesDto>(),
            topProducts
        );

        return Ok(report);
    }

    [HttpGet("audit-logs")]
    public async Task<ActionResult<List<AuditLog>>> GetAuditLogs([FromQuery] int limit = 50)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var logs = await _db.AuditLogs
            .Where(l => l.TenantId == tenantId.Value && l.BranchId == branchId.Value)
            .OrderByDescending(l => l.CreatedAtUtc)
            .Take(limit)
            .ToListAsync();

        return Ok(logs);
    }
}

[ApiController]
[Route("api/v1")]
public class HealthAndSyncController : ControllerBase
{
    private readonly MasaPilotDbContext _db;
    private readonly IBackupService _backupService;
    private readonly IWebHostEnvironment _env;

    public HealthAndSyncController(MasaPilotDbContext db, IBackupService backupService, IWebHostEnvironment env)
    {
        _db = db;
        _backupService = backupService;
        _env = env;
    }

    [HttpGet("health")]
    public async Task<ActionResult<SystemHealthDto>> GetHealth()
    {
        bool dbConnected = false;
        long dbSize = 0;

        try
        {
            dbConnected = await _db.Database.CanConnectAsync();
            var dbPath = Path.Combine(_env.ContentRootPath, "masapilot.db");
            if (System.IO.File.Exists(dbPath))
            {
                dbSize = new FileInfo(dbPath).Length;
            }
        }
        catch { }

        var pendingOutbox = 0;
        var queuedPrint = 0;
        var failedPrint = 0;

        if (dbConnected)
        {
            pendingOutbox = await _db.OutboxEvents.CountAsync(e => !e.IsDispatched);
            queuedPrint = await _db.PrintJobs.CountAsync(j => j.Status == PrintJobStatus.Queued);
            failedPrint = await _db.PrintJobs.CountAsync(j => j.Status == PrintJobStatus.RetryableFailed || j.Status == PrintJobStatus.ManualReview);
        }

        return Ok(new SystemHealthDto(
            RuntimeMode: "Edge",
            DatabaseProvider: _db.Database.ProviderName ?? "Unknown",
            DatabaseConnected: dbConnected,
            DatabaseSizeBytes: dbSize,
            PendingOutboxCount: pendingOutbox,
            QueuedPrintJobsCount: queuedPrint,
            FailedPrintJobsCount: failedPrint,
            LastSyncUtc: DateTime.UtcNow,
            ServerTimeUtc: DateTime.UtcNow
        ));
    }

    [HttpPost("backup/create")]
    public async Task<IActionResult> CreateBackup()
    {
        var backupDir = Path.Combine(_env.ContentRootPath, "backups");
        var (path, checksum, size) = await _backupService.CreateBackupAsync(backupDir);

        return Ok(new
        {
            success = true,
            filePath = path,
            checksumSha256 = checksum,
            sizeBytes = size,
            createdAtUtc = DateTime.UtcNow
        });
    }

    [HttpPost("backup/verify")]
    public async Task<IActionResult> VerifyBackup([FromQuery] string backupPath, [FromQuery] string expectedChecksum)
    {
        if (string.IsNullOrEmpty(backupPath) || string.IsNullOrEmpty(expectedChecksum))
        {
            return BadRequest("Yedek dosya yolu ve beklenen checksum zorunludur.");
        }

        var (isValid, message, rowCounts) = await _backupService.VerifyBackupAsync(backupPath, expectedChecksum);

        return Ok(new
        {
            isValid,
            message,
            rowCounts
        });
    }

    [HttpPost("sync/push")]
    public async Task<ActionResult<SyncPushResponse>> ReceiveSyncEvents([FromBody] List<SyncEventDto> events)
    {
        if (events == null || !events.Any())
        {
            return Ok(new SyncPushResponse(0, 0, 0));
        }

        int processed = 0;
        int duplicates = 0;

        foreach (var ev in events)
        {
            var exists = await _db.InboxEvents.AnyAsync(i => i.TenantId == ev.TenantId && i.BranchId == ev.BranchId && i.EventId == ev.EventId);
            if (exists)
            {
                duplicates++;
                continue;
            }

            _db.InboxEvents.Add(new InboxEvent
            {
                TenantId = ev.TenantId,
                BranchId = ev.BranchId,
                EventId = ev.EventId,
                AggregateType = ev.AggregateType,
                PayloadJson = ev.PayloadJson,
                ProcessedAtUtc = DateTime.UtcNow
            });
            processed++;
        }

        await _db.SaveChangesAsync();

        return Ok(new SyncPushResponse(events.Count, processed, duplicates));
    }
}
