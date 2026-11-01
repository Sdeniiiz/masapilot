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
[Route("api/v1")]
public class TablesController : ControllerBase
{
    private readonly MasaPilotDbContext _db;
    private readonly ICurrentTenantService _tenantService;
    private readonly IHubContext<OrderHub> _orderHub;

    public TablesController(MasaPilotDbContext db, ICurrentTenantService tenantService, IHubContext<OrderHub> orderHub)
    {
        _db = db;
        _tenantService = tenantService;
        _orderHub = orderHub;
    }

    [HttpGet("areas")]
    public async Task<ActionResult<List<AreaDto>>> GetAreas()
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;

        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest("Tenant ve Şube bağlamı gereklidir.");

        var areas = await _db.AreaFloors
            .Where(a => a.TenantId == tenantId.Value && a.BranchId == branchId.Value)
            .OrderBy(a => a.DisplayOrder)
            .Include(a => a.DiningTables)
            .ToListAsync();

        // Fetch active open sessions for this branch
        var activeSessions = await _db.TableSessions
            .Where(s => s.TenantId == tenantId.Value && s.BranchId == branchId.Value && s.Status == SessionStatus.Open && s.DiningTableId != null)
            .ToDictionaryAsync(s => s.DiningTableId!.Value, s => s);

        var result = areas.Select(a => new AreaDto(
            a.Id,
            a.Name,
            a.DisplayOrder,
            a.DiningTables
                .OrderBy(t => int.TryParse(System.Text.RegularExpressions.Regex.Match(t.TableNumber, @"\d+").Value, out var n) ? n : t.DisplayOrder)
                .ThenBy(t => t.TableNumber)
                .Select(t =>
            {
                activeSessions.TryGetValue(t.Id, out var sess);
                return new TableDto(
                    t.Id,
                    t.AreaFloorId,
                    a.Name,
                    t.TableNumber,
                    t.Capacity,
                    t.Status,
                    t.DisplayOrder,
                    sess?.Id,
                    sess?.GrandTotal,
                    sess?.OpenedAtUtc
                );
            }).ToList()
        )).ToList();

        return Ok(result);
    }

    [HttpPost("areas")]
    public async Task<ActionResult<AreaDto>> CreateArea([FromBody] CreateAreaRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var area = new AreaFloor
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            Name = request.Name,
            DisplayOrder = request.DisplayOrder
        };

        _db.AreaFloors.Add(area);
        await _db.SaveChangesAsync();

        return Ok(new AreaDto(area.Id, area.Name, area.DisplayOrder, new List<TableDto>()));
    }

    [HttpPost("tables")]
    public async Task<ActionResult<TableDto>> CreateTable([FromBody] CreateTableRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var area = await _db.AreaFloors.FirstOrDefaultAsync(a => a.Id == request.AreaFloorId && a.TenantId == tenantId.Value);
        if (area == null) return NotFound("Bölüm bulunamadı.");

        var tableNumber = request.TableNumber?.Trim();
        var existingTables = await _db.DiningTables
            .Where(t => t.AreaFloorId == area.Id && t.TenantId == tenantId.Value)
            .ToListAsync();

        if (string.IsNullOrWhiteSpace(tableNumber))
        {
            // Determine prefix from area name: "Salon" -> "S", "Bahçe" -> "B"
            var prefix = !string.IsNullOrWhiteSpace(area.Name) ? area.Name.Trim().Substring(0, 1).ToUpperInvariant() : "M";

            // If existing tables use another prefix, match that style
            var matchPrefix = existingTables
                .Select(t => System.Text.RegularExpressions.Regex.Match(t.TableNumber, @"^[A-Za-zÇĞİÖŞÜçğıöşü]+"))
                .FirstOrDefault(m => m.Success)?.Value;

            if (!string.IsNullOrEmpty(matchPrefix))
            {
                prefix = matchPrefix.ToUpperInvariant();
            }

            int nextNum = 1;
            var numbers = existingTables
                .Select(t => System.Text.RegularExpressions.Regex.Match(t.TableNumber, @"\d+"))
                .Where(m => m.Success)
                .Select(m => int.Parse(m.Value))
                .ToList();

            if (numbers.Any())
            {
                nextNum = numbers.Max() + 1;
            }

            tableNumber = $"{prefix}{nextNum}";
        }

        var displayOrder = request.DisplayOrder > 0
            ? request.DisplayOrder
            : (existingTables.Count > 0 ? existingTables.Max(t => t.DisplayOrder) + 1 : 1);

        var table = new DiningTable
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            AreaFloorId = request.AreaFloorId,
            TableNumber = tableNumber,
            Capacity = request.Capacity > 0 ? request.Capacity : 4,
            DisplayOrder = displayOrder,
            Status = TableStatus.Empty
        };

        _db.DiningTables.Add(table);
        await _db.SaveChangesAsync();

        return Ok(new TableDto(table.Id, table.AreaFloorId, area.Name, table.TableNumber, table.Capacity, table.Status, table.DisplayOrder, null, null, null));
    }

    [HttpPost("tables/{id}/status")]
    public async Task<IActionResult> UpdateTableStatus(Guid id, [FromBody] TableStatus newStatus)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var table = await _db.DiningTables.FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId.Value);
        if (table == null) return NotFound();

        table.Status = newStatus;
        await _db.SaveChangesAsync();

        await _orderHub.Clients.Group($"branch_{branchId.Value}").SendAsync("TableStatusChanged", new { tableId = table.Id, status = table.Status });

        return Ok(new { success = true, tableId = table.Id, status = table.Status });
    }
}
