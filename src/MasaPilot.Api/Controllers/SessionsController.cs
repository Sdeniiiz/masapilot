using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
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
[Route("api/v1/sessions")]
public class SessionsController : ControllerBase
{
    private readonly MasaPilotDbContext _db;
    private readonly ICurrentTenantService _tenantService;
    private readonly IEscPosGenerator _escPos;
    private readonly IHubContext<OrderHub> _orderHub;
    private readonly IHubContext<KitchenHub> _kitchenHub;
    private readonly IPasswordHasher _hasher;

    public SessionsController(
        MasaPilotDbContext db,
        ICurrentTenantService tenantService,
        IEscPosGenerator escPos,
        IHubContext<OrderHub> orderHub,
        IHubContext<KitchenHub> kitchenHub,
        IPasswordHasher hasher)
    {
        _db = db;
        _tenantService = tenantService;
        _escPos = escPos;
        _orderHub = orderHub;
        _kitchenHub = kitchenHub;
        _hasher = hasher;
    }

    [HttpPost("open")]
    public async Task<ActionResult<SessionDetailDto>> OpenSession([FromBody] OpenSessionRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        var userId = _tenantService.UserId;
        if (!tenantId.HasValue || !branchId.HasValue || !userId.HasValue) return BadRequest();

        // 1. Check if table already has an active open session
        var existingSession = await _db.TableSessions
            .Include(s => s.DiningTable)
            .Include(s => s.Orders).ThenInclude(o => o.OrderLines)
            .Include(s => s.Payments).ThenInclude(p => p.PaymentMethod)
            .FirstOrDefaultAsync(s => s.TenantId == tenantId.Value && s.BranchId == branchId.Value && s.DiningTableId == request.DiningTableId && s.Status == SessionStatus.Open);

        if (existingSession != null)
        {
            return Ok(MapToDetail(existingSession));
        }

        var table = await _db.DiningTables.FirstOrDefaultAsync(t => t.Id == request.DiningTableId && t.TenantId == tenantId.Value);
        if (table == null) return NotFound("Masa bulunamadı.");

        var countToday = await _db.TableSessions.CountAsync(s => s.BranchId == branchId.Value && s.OpenedAtUtc.Date == DateTime.UtcNow.Date);
        var sessionNumber = $"A-{DateTime.UtcNow:yyMMdd}-{(countToday + 1):D3}";

        var session = new TableSession
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            DiningTableId = table.Id,
            SessionNumber = sessionNumber,
            OpenedByUserId = userId.Value,
            OpenedAtUtc = DateTime.UtcNow,
            Status = SessionStatus.Open,
            Notes = request.Notes
        };

        table.Status = TableStatus.Occupied;

        _db.TableSessions.Add(session);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException ex)
        {
            var details = string.Join(", ", ex.Entries.Select(e => $"{e.Entity.GetType().Name}: {e.State} (Id={e.Property("Id").CurrentValue})"));
            throw new Exception($"Concurrency failure on entries: {details}", ex);
        }

        await _orderHub.Clients.Group($"branch_{branchId.Value}").SendAsync("TableStatusChanged", new { tableId = table.Id, status = table.Status, sessionId = session.Id });

        return Ok(MapToDetail(session));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SessionDetailDto>> GetSession(Guid id)
    {
        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue) return BadRequest();

        var session = await _db.TableSessions
            .Include(s => s.DiningTable)
            .Include(s => s.Orders).ThenInclude(o => o.OrderLines).ThenInclude(l => l.KitchenStation)
            .Include(s => s.Payments).ThenInclude(p => p.PaymentMethod)
            .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId.Value);

        if (session == null) return NotFound();

        return Ok(MapToDetail(session));
    }

    [HttpPost("{id}/orders")]
    public async Task<ActionResult<SessionDetailDto>> AddOrder(Guid id, [FromBody] AddOrderRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        var userId = _tenantService.UserId;
        if (!tenantId.HasValue || !branchId.HasValue || !userId.HasValue) return BadRequest();

        if (request.Lines == null || !request.Lines.Any())
        {
            return BadRequest("Sipariş en az bir satır içermelidir.");
        }

        // Idempotency check: if request has idempotency key and was already recorded, return current session
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existingOrder = await _db.Orders
                .FirstOrDefaultAsync(o => o.TableSessionId == id && o.IdempotencyKey == request.IdempotencyKey);
            if (existingOrder != null)
            {
                var currentSession = await _db.TableSessions
                    .Include(s => s.DiningTable)
                    .Include(s => s.Orders).ThenInclude(o => o.OrderLines).ThenInclude(l => l.KitchenStation)
                    .Include(s => s.Payments).ThenInclude(p => p.PaymentMethod)
                    .FirstAsync(s => s.Id == id);
                return Ok(MapToDetail(currentSession));
            }
        }

        var session = await _db.TableSessions
            .Include(s => s.DiningTable)
            .Include(s => s.Orders).ThenInclude(o => o.OrderLines)
            .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId.Value && s.Status == SessionStatus.Open);

        if (session == null) return NotFound("Açık adisyon bulunamadı.");

        // Read all referenced products for authoritative pricing snapshot
        var productIds = request.Lines.Select(l => l.ProductId).Distinct().ToList();
        var products = await _db.Products
            .Include(p => p.StationRoutes)
            .Where(p => productIds.Contains(p.Id) && p.TenantId == tenantId.Value)
            .ToDictionaryAsync(p => p.Id, p => p);

        var orderCount = session.Orders.Count + 1;
        var order = new Order
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            TableSessionId = session.Id,
            OrderNumber = $"{session.SessionNumber}-{orderCount}",
            CreatedByUserId = userId.Value,
            Status = OrderStatus.Submitted,
            IdempotencyKey = request.IdempotencyKey,
            Notes = request.OrderNotes
        };

        var orderLines = new List<OrderLine>();
        var stationRoutingMap = new Dictionary<Guid, List<OrderLine>>();

        foreach (var lineInput in request.Lines)
        {
            if (!products.TryGetValue(lineInput.ProductId, out var prod)) continue;

            var unitPrice = (lineInput.CustomUnitPrice.HasValue && lineInput.CustomUnitPrice.Value > 0)
                ? lineInput.CustomUnitPrice.Value
                : prod.UnitPrice;

            var productName = !string.IsNullOrWhiteSpace(lineInput.PortionName)
                ? $"{prod.Name} ({lineInput.PortionName})"
                : prod.Name;

            var vatRate = prod.VatRate;
            var lineTotal = lineInput.IsComplimentary ? 0.00m : (unitPrice * lineInput.Quantity);
            var lineTax = lineInput.IsComplimentary ? 0.00m : (lineTotal * (vatRate / 100m));

            var lineNotes = lineInput.Notes;
            if (lineInput.IsComplimentary)
            {
                var reasonText = !string.IsNullOrWhiteSpace(lineInput.ComplimentaryReason)
                    ? $"[İKRAM: {lineInput.ComplimentaryReason}]"
                    : "[İKRAM]";
                lineNotes = string.IsNullOrWhiteSpace(lineNotes) ? reasonText : $"{lineNotes} {reasonText}";
            }

            // Determine routing station
            var primaryStationId = prod.StationRoutes.FirstOrDefault()?.KitchenStationId;

            var line = new OrderLine
            {
                TenantId = tenantId.Value,
                BranchId = branchId.Value,
                OrderId = order.Id,
                ProductId = prod.Id,
                Quantity = lineInput.Quantity,
                ProductNameSnapshot = productName,
                UnitPriceSnapshot = lineInput.IsComplimentary ? 0.00m : unitPrice,
                VatRateSnapshot = vatRate,
                LineTotal = lineTotal,
                LineTax = lineTax,
                Notes = lineNotes,
                IsComplimentary = lineInput.IsComplimentary,
                ComplimentaryReason = lineInput.ComplimentaryReason,
                PortionName = lineInput.PortionName,
                KitchenStationId = primaryStationId,
                Status = OrderLineStatus.SentToKitchen
            };

            orderLines.Add(line);
            order.OrderLines.Add(line);

            if (primaryStationId.HasValue)
            {
                if (!stationRoutingMap.ContainsKey(primaryStationId.Value))
                    stationRoutingMap[primaryStationId.Value] = new List<OrderLine>();
                stationRoutingMap[primaryStationId.Value].Add(line);
            }
        }

        _db.Orders.Add(order);
        if (!session.Orders.Contains(order))
        {
            session.Orders.Add(order);
        }

        // Recalculate session totals
        RecalculateSessionTotals(session);

        // Generate PrintJobs in same database transaction
        var printers = await _db.Printers
            .Where(p => p.TenantId == tenantId.Value && p.BranchId == branchId.Value && p.IsActive)
            .ToListAsync();

        foreach (var (stationId, linesForStation) in stationRoutingMap)
        {
            var stationPrinters = printers.Where(p => p.KitchenStationId == stationId).ToList();
            if (!stationPrinters.Any())
            {
                // Fallback to first available printer
                stationPrinters = printers.Take(1).ToList();
            }

            var stationObj = await _db.KitchenStations.FindAsync(stationId);
            var stationName = stationObj?.Name ?? "İstasyon";

            foreach (var printer in stationPrinters)
            {
                var rawEscPos = _escPos.GenerateKitchenTicket(session, order, linesForStation, stationName, isReprint: false);
                _db.PrintJobs.Add(new PrintJob
                {
                    TenantId = tenantId.Value,
                    BranchId = branchId.Value,
                    PrinterId = printer.Id,
                    JobType = PrintJobType.KitchenTicket,
                    Title = $"{stationName} Sipariş: {order.OrderNumber}",
                    RawContentEscPos = rawEscPos,
                    Status = PrintJobStatus.Queued,
                    IsReprint = false
                });
            }
        }

        // Add Outbox Event for Cloud Sync
        _db.OutboxEvents.Add(new OutboxEvent
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            AggregateType = "Order",
            AggregateId = order.Id,
            EventType = "OrderSubmitted",
            PayloadJson = JsonSerializer.Serialize(new { OrderId = order.Id, SessionId = session.Id, OrderNumber = order.OrderNumber, LineCount = orderLines.Count })
        });

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException ex)
        {
            var details = string.Join(", ", ex.Entries.Select(e => $"{e.Entity.GetType().Name}: {e.State} (Id={e.Property("Id").CurrentValue})"));
            throw new Exception($"Concurrency failure on entries: {details}", ex);
        }

        // Broadcast to LAN clients
        await _orderHub.Clients.Group($"branch_{branchId.Value}").SendAsync("OrderAdded", new { sessionId = session.Id, orderId = order.Id });
        await _kitchenHub.Clients.Group($"kds_branch_{branchId.Value}").SendAsync("NewKitchenOrder", new { sessionId = session.Id, orderId = order.Id, lines = orderLines.Select(l => new { l.Id, l.ProductNameSnapshot, l.Quantity, l.KitchenStationId, l.Notes }) });

        var reloadedSession = await _db.TableSessions
            .Include(s => s.DiningTable)
            .Include(s => s.Orders).ThenInclude(o => o.OrderLines).ThenInclude(l => l.KitchenStation)
            .Include(s => s.Payments).ThenInclude(p => p.PaymentMethod)
            .FirstAsync(s => s.Id == id);

        return Ok(MapToDetail(reloadedSession));
    }

    [HttpPost("{id}/void-line/{lineId}")]
    public async Task<ActionResult<SessionDetailDto>> VoidOrderLine(Guid id, Guid lineId, [FromBody] VoidLineRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        var userId = _tenantService.UserId;
        if (!tenantId.HasValue || !branchId.HasValue || !userId.HasValue) return BadRequest();

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest("İptal gerekçesi belirtilmelidir.");
        }

        // Supervisor PIN Security Check for Waiters / Kitchen staff
        var currentUser = await _db.Users.FindAsync(userId.Value);
        if (currentUser != null && (currentUser.Role == UserRole.Waiter || currentUser.Role == UserRole.KitchenStaff))
        {
            if (string.IsNullOrWhiteSpace(request.SupervisorPin))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Garson hesabıyla satır iptali için Yönetici/Kasa PIN kodu gereklidir." });
            }

            var managers = await _db.Users
                .Where(u => u.TenantId == tenantId.Value && u.IsActive &&
                            (u.Role == UserRole.BranchManager || u.Role == UserRole.TenantOwner || u.Role == UserRole.PlatformAdmin))
                .ToListAsync();

            var isValid = managers.Any(m => _hasher.VerifyPin(request.SupervisorPin, m.PinCodeHash));
            if (!isValid)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Geçersiz Yönetici PIN kodu! İptal işlemi onaylanmadı." });
            }
        }

        var session = await _db.TableSessions
            .Include(s => s.DiningTable)
            .Include(s => s.Orders).ThenInclude(o => o.OrderLines)
            .Include(s => s.Payments).ThenInclude(p => p.PaymentMethod)
            .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId.Value && s.Status == SessionStatus.Open);

        if (session == null) return NotFound("Açık adisyon bulunamadı.");

        var line = session.Orders.SelectMany(o => o.OrderLines).FirstOrDefault(l => l.Id == lineId);
        if (line == null) return NotFound("Sipariş satırı bulunamadı.");

        if (line.Status == OrderLineStatus.Voided)
        {
            return BadRequest("Bu satır zaten iptal edilmiş.");
        }

        line.Status = OrderLineStatus.Voided;
        line.VoidReason = request.Reason;
        line.VoidByUserId = userId.Value;

        // Recalculate totals excluding voided lines
        RecalculateSessionTotals(session);

        // Audit Log
        _db.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            UserId = userId.Value,
            Action = "OrderLineVoided",
            EntityName = "OrderLine",
            EntityId = line.Id,
            DetailsJson = JsonSerializer.Serialize(new { line.ProductNameSnapshot, line.Quantity, line.LineTotal, request.Reason }),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1"
        });

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException ex)
        {
            var details = string.Join(", ", ex.Entries.Select(e => $"{e.Entity.GetType().Name}: {e.State} (Id={e.Property("Id").CurrentValue})"));
            throw new Exception($"Concurrency failure on entries: {details}", ex);
        }

        await _orderHub.Clients.Group($"branch_{branchId.Value}").SendAsync("OrderLineVoided", new { sessionId = session.Id, lineId = line.Id });
        await _kitchenHub.Clients.Group($"kds_branch_{branchId.Value}").SendAsync("OrderLineVoided", new { sessionId = session.Id, lineId = line.Id });

        return Ok(MapToDetail(session));
    }

    [HttpPost("{id}/print-pre-receipt")]
    public async Task<IActionResult> PrintPreReceipt(Guid id)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var session = await _db.TableSessions
            .Include(s => s.DiningTable)
            .Include(s => s.Orders).ThenInclude(o => o.OrderLines)
            .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId.Value);

        if (session == null) return NotFound();

        var branch = await _db.Branches.FindAsync(branchId.Value);
        if (branch == null) return NotFound();

        var cashierPrinter = await _db.Printers
            .FirstOrDefaultAsync(p => p.TenantId == tenantId.Value && p.BranchId == branchId.Value && p.KitchenStationId == null && p.IsActive)
            ?? await _db.Printers.FirstOrDefaultAsync(p => p.TenantId == tenantId.Value && p.BranchId == branchId.Value && p.IsActive);

        if (cashierPrinter == null)
        {
            return BadRequest("Yazdırma için aktif yazıcı bulunamadı.");
        }

        var activeLines = session.Orders.SelectMany(o => o.OrderLines).Where(l => l.Status != OrderLineStatus.Voided).ToList();
        var rawEscPos = _escPos.GeneratePreReceipt(session, activeLines, branch, isReprint: false);

        var printJob = new PrintJob
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            PrinterId = cashierPrinter.Id,
            JobType = PrintJobType.PreReceipt,
            Title = $"Ön Hesap: {session.SessionNumber}",
            RawContentEscPos = rawEscPos,
            Status = PrintJobStatus.Queued,
            IsReprint = false
        };

        _db.PrintJobs.Add(printJob);

        if (session.DiningTable != null)
        {
            session.DiningTable.Status = TableStatus.BillRequested;
            await _orderHub.Clients.Group($"branch_{branchId.Value}").SendAsync("TableStatusChanged", new { tableId = session.DiningTable.Id, status = session.DiningTable.Status });
        }

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException ex)
        {
            var details = string.Join(", ", ex.Entries.Select(e => $"{e.Entity.GetType().Name}: {e.State} (Id={e.Property("Id").CurrentValue})"));
            throw new Exception($"Concurrency failure on entries: {details}", ex);
        }

        return Ok(new { success = true, jobId = printJob.Id, message = "Ön hesap dökümü yazıcı kuyruğuna eklendi." });
    }

    [HttpPost("{id}/payments")]
    public async Task<ActionResult<SessionDetailDto>> AddPayment(Guid id, [FromBody] CreatePaymentRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        var userId = _tenantService.UserId;
        if (!tenantId.HasValue || !branchId.HasValue || !userId.HasValue) return BadRequest();

        if (request.Amount <= 0)
        {
            return BadRequest("Ödeme tutarı sıfırdan büyük olmalıdır.");
        }

        // Idempotency check: if payment with same key exists, return current session
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existingPayment = await _db.Payments
                .FirstOrDefaultAsync(p => p.TableSessionId == id && p.IdempotencyKey == request.IdempotencyKey);
            if (existingPayment != null)
            {
                var s = await _db.TableSessions
                    .Include(s => s.DiningTable)
                    .Include(s => s.Orders).ThenInclude(o => o.OrderLines)
                    .Include(s => s.Payments).ThenInclude(p => p.PaymentMethod)
                    .FirstAsync(s => s.Id == id);
                return Ok(MapToDetail(s));
            }
        }

        var session = await _db.TableSessions
            .Include(s => s.DiningTable)
            .Include(s => s.Orders).ThenInclude(o => o.OrderLines)
            .Include(s => s.Payments).ThenInclude(p => p.PaymentMethod)
            .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId.Value && s.Status == SessionStatus.Open);

        if (session == null) return NotFound("Açık adisyon bulunamadı.");

        var paymentMethod = await _db.PaymentMethods.FindAsync(request.PaymentMethodId);
        if (paymentMethod == null) return NotFound("Ödeme yöntemi bulunamadı.");

        var payment = new Payment
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            TableSessionId = session.Id,
            PaymentMethodId = paymentMethod.Id,
            Amount = request.Amount,
            TipAmount = request.TipAmount,
            ProcessedByUserId = userId.Value,
            ProcessedAtUtc = DateTime.UtcNow,
            IdempotencyKey = request.IdempotencyKey,
            Status = PaymentStatus.Completed,
            Notes = request.Notes
        };

        _db.Payments.Add(payment);
        session.Payments.Add(payment);
        session.PaidTotal += request.Amount;
        session.RemainingTotal = Math.Max(0m, session.GrandTotal - session.PaidTotal);

        // Mark individual order lines as paid if specified
        if (request.PaidLineIds != null && request.PaidLineIds.Any())
        {
            var linesToMarkPaid = session.Orders
                .SelectMany(o => o.OrderLines)
                .Where(l => request.PaidLineIds.Contains(l.Id) && !l.IsPaid && l.Status != OrderLineStatus.Voided)
                .ToList();

            foreach (var line in linesToMarkPaid)
            {
                line.IsPaid = true;
                line.PaymentId = payment.Id;
            }
        }

        // Auto close session if remaining balance is settled
        if (session.RemainingTotal <= 0.00m)
        {
            session.Status = SessionStatus.Closed;
            session.ClosedAtUtc = DateTime.UtcNow;

            if (session.DiningTable != null)
            {
                session.DiningTable.Status = TableStatus.Empty;
                await _orderHub.Clients.Group($"branch_{branchId.Value}").SendAsync("TableStatusChanged", new { tableId = session.DiningTable.Id, status = TableStatus.Empty, sessionId = (Guid?)null });
            }
        }

        // Outbox event for cloud sync
        _db.OutboxEvents.Add(new OutboxEvent
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            AggregateType = "Payment",
            AggregateId = payment.Id,
            EventType = "PaymentReceived",
            PayloadJson = JsonSerializer.Serialize(new { PaymentId = payment.Id, SessionId = session.Id, Amount = payment.Amount, Method = paymentMethod.Name, Closed = session.Status == SessionStatus.Closed })
        });

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException ex)
        {
            var details = string.Join(", ", ex.Entries.Select(e => $"{e.Entity.GetType().Name}: {e.State} (Id={e.Property("Id").CurrentValue})"));
            throw new Exception($"Concurrency failure on entries: {details}", ex);
        }

        await _orderHub.Clients.Group($"branch_{branchId.Value}").SendAsync("PaymentReceived", new { sessionId = session.Id, remaining = session.RemainingTotal, isClosed = session.Status == SessionStatus.Closed });

        return Ok(MapToDetail(session));
    }

    [HttpPost("{id}/transfer")]
    public async Task<ActionResult<SessionDetailDto>> TransferSession(Guid id, [FromBody] TransferTableRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        var userId = _tenantService.UserId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var session = await _db.TableSessions
            .Include(s => s.DiningTable)
            .Include(s => s.Orders).ThenInclude(o => o.OrderLines)
            .Include(s => s.Payments).ThenInclude(p => p.PaymentMethod)
            .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId.Value && s.Status == SessionStatus.Open);

        if (session == null) return NotFound("Açık adisyon bulunamadı.");

        var sourceTable = session.DiningTable;
        if (sourceTable == null) return BadRequest("Adisyonun bağlı olduğu masa bulunamadı.");

        if (sourceTable.Id == request.TargetTableId)
        {
            return BadRequest("Zaten bu masadasınız.");
        }

        var targetTable = await _db.DiningTables
            .FirstOrDefaultAsync(t => t.Id == request.TargetTableId && t.TenantId == tenantId.Value && t.BranchId == branchId.Value);

        if (targetTable == null) return NotFound("Hedef masa bulunamadı.");

        var targetSession = await _db.TableSessions
            .FirstOrDefaultAsync(s => s.DiningTableId == targetTable.Id && s.Status == SessionStatus.Open);

        if (targetSession != null)
        {
            return BadRequest($"Hedef masada ({targetTable.TableNumber}) zaten açık bir adisyon ({targetSession.SessionNumber}) bulunuyor. Lütfen boş bir masa seçin.");
        }

        var oldTableNumber = sourceTable.TableNumber;
        sourceTable.Status = TableStatus.Empty;
        targetTable.Status = TableStatus.Occupied;

        session.DiningTableId = targetTable.Id;
        session.DiningTable = targetTable;

        _db.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            UserId = userId ?? Guid.Empty,
            Action = "TableTransfer",
            EntityName = "TableSession",
            EntityId = session.Id,
            DetailsJson = JsonSerializer.Serialize(new { fromTable = oldTableNumber, toTable = targetTable.TableNumber, sessionNumber = session.SessionNumber }),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "local"
        });

        await _db.SaveChangesAsync();

        await _orderHub.Clients.Group($"branch_{branchId.Value}").SendAsync("TableStatusChanged", new { tableId = sourceTable.Id, status = sourceTable.Status, sessionId = (Guid?)null });
        await _orderHub.Clients.Group($"branch_{branchId.Value}").SendAsync("TableStatusChanged", new { tableId = targetTable.Id, status = targetTable.Status, sessionId = session.Id });

        return Ok(MapToDetail(session));
    }

    [HttpPost("{id}/merge")]
    public async Task<ActionResult<SessionDetailDto>> MergeSession(Guid id, [FromBody] MergeTableRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        var userId = _tenantService.UserId;
        if (!tenantId.HasValue || !branchId.HasValue || !userId.HasValue) return BadRequest();

        var sourceSession = await _db.TableSessions
            .Include(s => s.DiningTable)
            .Include(s => s.Orders).ThenInclude(o => o.OrderLines)
            .Include(s => s.Payments).ThenInclude(p => p.PaymentMethod)
            .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId.Value && s.Status == SessionStatus.Open);

        if (sourceSession == null) return NotFound("Kaynak açık adisyon bulunamadı.");

        if (sourceSession.DiningTableId == request.TargetTableId)
        {
            return BadRequest("Aynı masayı kendisiyle birleştiremezsiniz.");
        }

        var targetTable = await _db.DiningTables
            .FirstOrDefaultAsync(t => t.Id == request.TargetTableId && t.TenantId == tenantId.Value && t.BranchId == branchId.Value);

        if (targetTable == null) return NotFound("Hedef masa bulunamadı.");

        var targetSession = await _db.TableSessions
            .Include(s => s.DiningTable)
            .Include(s => s.Orders).ThenInclude(o => o.OrderLines)
            .Include(s => s.Payments).ThenInclude(p => p.PaymentMethod)
            .FirstOrDefaultAsync(s => s.DiningTableId == targetTable.Id && s.TenantId == tenantId.Value && s.Status == SessionStatus.Open);

        if (targetSession == null)
        {
            return BadRequest($"Hedef masada ({targetTable.TableNumber}) açık bir adisyon bulunamadı. Birleştirme için hedef masanın dolu olması gerekir.");
        }

        var sourceTable = sourceSession.DiningTable;
        var fromTableNum = sourceTable?.TableNumber ?? "Bilinmeyen";

        // Move orders from source to target
        foreach (var order in sourceSession.Orders.ToList())
        {
            order.TableSessionId = targetSession.Id;
            order.TableSession = targetSession;
            targetSession.Orders.Add(order);
        }

        // Move payments from source to target
        foreach (var payment in sourceSession.Payments.ToList())
        {
            payment.TableSessionId = targetSession.Id;
            payment.TableSession = targetSession;
            targetSession.Payments.Add(payment);
        }

        // Mark source session as Merged & free source table
        sourceSession.Status = SessionStatus.Merged;
        sourceSession.ClosedAtUtc = DateTime.UtcNow;
        if (sourceTable != null)
        {
            sourceTable.Status = TableStatus.Empty;
        }

        // Target table remains Occupied
        targetTable.Status = TableStatus.Occupied;

        // Recalculate target session totals
        RecalculateSessionTotals(targetSession);

        _db.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            UserId = userId.Value,
            Action = "TablesMerged",
            EntityName = "TableSession",
            EntityId = targetSession.Id,
            DetailsJson = JsonSerializer.Serialize(new
            {
                fromTable = fromTableNum,
                toTable = targetTable.TableNumber,
                sourceSessionId = sourceSession.Id,
                targetSessionId = targetSession.Id
            }),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "local"
        });

        await _db.SaveChangesAsync();

        if (sourceTable != null)
        {
            await _orderHub.Clients.Group($"branch_{branchId.Value}").SendAsync("TableStatusChanged", new { tableId = sourceTable.Id, status = TableStatus.Empty, sessionId = (Guid?)null });
        }
        await _orderHub.Clients.Group($"branch_{branchId.Value}").SendAsync("TableStatusChanged", new { tableId = targetTable.Id, status = TableStatus.Occupied, sessionId = targetSession.Id });

        return Ok(MapToDetail(targetSession));
    }

    [HttpPost("{id}/discount")]
    public async Task<ActionResult<SessionDetailDto>> ApplyDiscount(Guid id, [FromBody] ApplyDiscountRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        var userId = _tenantService.UserId;
        if (!tenantId.HasValue || !branchId.HasValue || !userId.HasValue) return BadRequest();

        var session = await _db.TableSessions
            .Include(s => s.DiningTable)
            .Include(s => s.Orders).ThenInclude(o => o.OrderLines)
            .Include(s => s.Payments).ThenInclude(p => p.PaymentMethod)
            .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId.Value && s.Status == SessionStatus.Open);

        if (session == null) return NotFound("Açık adisyon bulunamadı.");

        decimal discount = 0m;
        if (request.Percentage.HasValue && request.Percentage.Value > 0)
        {
            var pct = Math.Min(100m, request.Percentage.Value);
            discount = Math.Round(session.SubTotal * (pct / 100m), 2);
        }
        else if (request.FixedAmount.HasValue && request.FixedAmount.Value > 0)
        {
            discount = Math.Min(session.SubTotal, request.FixedAmount.Value);
        }

        session.DiscountTotal = discount;
        RecalculateSessionTotals(session);

        _db.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            UserId = userId.Value,
            Action = "DiscountApplied",
            EntityName = "TableSession",
            EntityId = session.Id,
            DetailsJson = JsonSerializer.Serialize(new { session.DiscountTotal, request.Reason }),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "local"
        });

        await _db.SaveChangesAsync();

        await _orderHub.Clients.Group($"branch_{branchId.Value}").SendAsync("SessionUpdated", new { sessionId = session.Id });

        return Ok(MapToDetail(session));
    }

    private static void RecalculateSessionTotals(TableSession session)
    {
        var allLines = session.Orders
            .SelectMany(o => o.OrderLines)
            .Where(l => l.Status != OrderLineStatus.Voided)
            .ToList();

        session.SubTotal = allLines.Sum(l => l.LineTotal);
        session.TaxTotal = allLines.Sum(l => l.LineTax);
        session.GrandTotal = Math.Max(0m, session.SubTotal - session.DiscountTotal);
        session.RemainingTotal = Math.Max(0m, session.GrandTotal - session.PaidTotal);
    }

    private static SessionDetailDto MapToDetail(TableSession session)
    {
        return new SessionDetailDto(
            session.Id,
            session.DiningTableId,
            session.DiningTable?.TableNumber,
            session.SessionNumber,
            session.OpenedAtUtc,
            session.Status,
            session.SubTotal,
            session.TaxTotal,
            session.DiscountTotal,
            session.GrandTotal,
            session.PaidTotal,
            session.RemainingTotal,
            session.Orders.OrderBy(o => o.CreatedAtUtc).Select(o => new OrderSummaryDto(
                o.Id,
                o.OrderNumber,
                o.CreatedAtUtc,
                o.Status,
                o.OrderLines.Select(l => new OrderLineSummaryDto(
                    l.Id,
                    l.ProductId,
                    l.ProductNameSnapshot,
                    l.Quantity,
                    l.UnitPriceSnapshot,
                    l.VatRateSnapshot,
                    l.LineTotal,
                    l.Notes,
                    l.KitchenStationId,
                    l.KitchenStation?.Name,
                    l.Status,
                    l.VoidReason,
                    l.IsComplimentary,
                    l.ComplimentaryReason,
                    l.PortionName,
                    l.IsPaid,
                    l.PaymentId
                )).ToList(),
                o.Notes
            )).ToList(),
            session.Payments.OrderBy(p => p.ProcessedAtUtc).Select(p => new PaymentSummaryDto(
                p.Id,
                p.PaymentMethodId,
                p.PaymentMethod?.Name ?? "Ödeme",
                p.Amount,
                p.TipAmount,
                p.ProcessedAtUtc,
                p.Status,
                p.Notes
            )).ToList()
        );
    }
}
