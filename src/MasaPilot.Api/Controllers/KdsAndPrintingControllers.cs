using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using MasaPilot.Api.Hubs;
using MasaPilot.Application.Common;
using MasaPilot.Application.DTOs;
using MasaPilot.Domain.Entities;
using MasaPilot.Domain.Enums;
using MasaPilot.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace MasaPilot.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/kds")]
public class KdsController : ControllerBase
{
    private readonly MasaPilotDbContext _db;
    private readonly ICurrentTenantService _tenantService;
    private readonly IHubContext<KitchenHub> _kitchenHub;

    public KdsController(MasaPilotDbContext db, ICurrentTenantService tenantService, IHubContext<KitchenHub> kitchenHub)
    {
        _db = db;
        _tenantService = tenantService;
        _kitchenHub = kitchenHub;
    }

    [HttpGet("stations")]
    public async Task<ActionResult<List<KitchenStationDto>>> GetStations()
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var stations = await _db.KitchenStations
            .Where(s => s.TenantId == tenantId.Value && s.BranchId == branchId.Value && s.IsActive)
            .Select(s => new KitchenStationDto(s.Id, s.Name, s.IsActive))
            .ToListAsync();

        return Ok(stations);
    }

    [HttpGet("orders")]
    public async Task<ActionResult<List<object>>> GetActiveKdsOrders([FromQuery] Guid? stationId)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        // Get open orders that have lines not yet served or voided
        var query = _db.OrderLines
            .Include(l => l.Order).ThenInclude(o => o!.TableSession).ThenInclude(s => s!.DiningTable)
            .Include(l => l.KitchenStation)
            .Where(l => l.TenantId == tenantId.Value && l.BranchId == branchId.Value
                        && l.Status != OrderLineStatus.Served && l.Status != OrderLineStatus.Voided
                        && l.Order!.TableSession!.Status == SessionStatus.Open);

        if (stationId.HasValue)
        {
            query = query.Where(l => l.KitchenStationId == stationId.Value);
        }

        var lines = await query.OrderBy(l => l.Order!.CreatedAtUtc).ToListAsync();

        // Group by Order
        var orderGroups = lines.GroupBy(l => l.Order!).Select(g => new
        {
            OrderId = g.Key.Id,
            OrderNumber = g.Key.OrderNumber,
            SessionNumber = g.Key.TableSession?.SessionNumber,
            TableNumber = g.Key.TableSession?.DiningTable?.TableNumber ?? "Paket",
            CreatedAtUtc = g.Key.CreatedAtUtc,
            ElapsedMinutes = (int)(DateTime.UtcNow - g.Key.CreatedAtUtc).TotalMinutes,
            OrderNotes = g.Key.Notes,
            Lines = g.Select(l => new
            {
                LineId = l.Id,
                ProductName = l.ProductNameSnapshot,
                Quantity = l.Quantity,
                Notes = l.Notes,
                Status = l.Status.ToString(),
                StationName = l.KitchenStation?.Name ?? "Genel"
            }).ToList()
        }).ToList();

        return Ok(orderGroups);
    }

    [HttpPost("lines/{lineId}/status")]
    public async Task<IActionResult> UpdateLineStatus(Guid lineId, [FromBody] OrderLineStatus newStatus)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var line = await _db.OrderLines.FirstOrDefaultAsync(l => l.Id == lineId && l.TenantId == tenantId.Value);
        if (line == null) return NotFound("Sipariş satırı bulunamadı.");

        line.Status = newStatus;
        await _db.SaveChangesAsync();

        await _kitchenHub.Clients.Group($"kds_branch_{branchId.Value}").SendAsync("LineStatusUpdated", new { lineId = line.Id, status = line.Status.ToString() });

        return Ok(new { success = true, lineId = line.Id, status = line.Status.ToString() });
    }
}

[ApiController]
[Authorize]
[Route("api/v1/printers")]
public class PrintingController : ControllerBase
{
    private readonly MasaPilotDbContext _db;
    private readonly ICurrentTenantService _tenantService;
    private readonly IEscPosGenerator _escPos;

    public PrintingController(MasaPilotDbContext db, ICurrentTenantService tenantService, IEscPosGenerator escPos)
    {
        _db = db;
        _tenantService = tenantService;
        _escPos = escPos;
    }

    [HttpGet]
    public async Task<ActionResult<List<PrinterDto>>> GetPrinters()
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var printers = await _db.Printers
            .Include(p => p.KitchenStationId)
            .Where(p => p.TenantId == tenantId.Value && p.BranchId == branchId.Value && p.IsActive)
            .ToListAsync();

        var stations = await _db.KitchenStations.Where(s => s.TenantId == tenantId.Value).ToDictionaryAsync(s => s.Id, s => s.Name);

        var dtos = printers.Select(p => new PrinterDto(
            p.Id,
            p.Name,
            p.ConnectionType,
            p.IpAddress,
            p.Port,
            p.WindowsDriverName,
            p.PaperWidth,
            p.KitchenStationId,
            p.KitchenStationId.HasValue && stations.TryGetValue(p.KitchenStationId.Value, out var sName) ? sName : null,
            p.IsActive
        )).ToList();

        return Ok(dtos);
    }

    [HttpPost]
    public async Task<ActionResult<PrinterDto>> CreatePrinter([FromBody] CreatePrinterRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var printer = new Printer
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            Name = request.Name,
            ConnectionType = request.ConnectionType,
            IpAddress = request.IpAddress,
            Port = request.Port,
            WindowsDriverName = request.WindowsDriverName,
            PaperWidth = request.PaperWidth,
            KitchenStationId = request.KitchenStationId,
            IsActive = true
        };

        _db.Printers.Add(printer);
        await _db.SaveChangesAsync();

        return Ok(new PrinterDto(printer.Id, printer.Name, printer.ConnectionType, printer.IpAddress, printer.Port, printer.WindowsDriverName, printer.PaperWidth, printer.KitchenStationId, null, printer.IsActive));
    }

    [HttpGet("jobs")]
    public async Task<ActionResult<List<PrintJobDto>>> GetPrintJobs([FromQuery] int limit = 30)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var jobs = await _db.PrintJobs
            .Include(j => j.Printer)
            .Where(j => j.TenantId == tenantId.Value && j.BranchId == branchId.Value)
            .OrderByDescending(j => j.CreatedAtUtc)
            .Take(limit)
            .Select(j => new PrintJobDto(
                j.Id,
                j.PrinterId,
                j.Printer != null ? j.Printer.Name : "Bilinmeyen",
                j.JobType,
                j.Title,
                j.Status,
                j.AttemptsCount,
                j.LastAttemptAtUtc,
                j.LastError,
                j.IsReprint,
                j.CreatedAtUtc,
                j.RawContentEscPos
            ))
            .ToListAsync();

        return Ok(jobs);
    }

    [HttpPost("jobs/{id}/reprint")]
    public async Task<IActionResult> ReprintJob(Guid id)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var originalJob = await _db.PrintJobs
            .Include(j => j.Printer)
            .FirstOrDefaultAsync(j => j.Id == id && j.TenantId == tenantId.Value);

        if (originalJob == null) return NotFound("Yazdırma işi bulunamadı.");

        // Mark with clear *** TEKRAR BASKI *** banner
        var reprintContent = originalJob.RawContentEscPos;
        if (!reprintContent.Contains("*** TEKRAR BASKI ***"))
        {
            reprintContent = "========================================\n*** TEKRAR BASKI ***\nBu fis daha once yazdirilmis olabilir!\n========================================\n" + reprintContent;
        }

        var newJob = new PrintJob
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            PrinterId = originalJob.PrinterId,
            JobType = originalJob.JobType,
            Title = $"[TEKRAR] {originalJob.Title}",
            RawContentEscPos = reprintContent,
            Status = PrintJobStatus.Queued,
            IsReprint = true
        };

        _db.PrintJobs.Add(newJob);
        await _db.SaveChangesAsync();

        return Ok(new { success = true, newJobId = newJob.Id, message = "Tekrar basım işi kuyruğa eklendi." });
    }

    [HttpPost("jobs/{id}/confirm-printed")]
    public async Task<IActionResult> ConfirmJobPrinted(Guid id)
    {
        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue) return BadRequest();

        var job = await _db.PrintJobs.FirstOrDefaultAsync(j => j.Id == id && j.TenantId == tenantId.Value);
        if (job == null) return NotFound();

        // Used by user when physical ticket was already printed but status was in ManualReview
        job.Status = PrintJobStatus.Printed;
        job.LastError = "Kullanıcı tarafından basıldı olarak doğrulandı.";
        await _db.SaveChangesAsync();

        return Ok(new { success = true, jobId = job.Id, status = job.Status });
    }
}
