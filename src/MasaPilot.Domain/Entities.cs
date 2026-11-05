using System;
using System.Collections.Generic;
using MasaPilot.Domain.Enums;

namespace MasaPilot.Domain.Entities;

public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public abstract class TenantScopedEntity : BaseEntity
{
    public Guid TenantId { get; set; }
}

public abstract class BranchScopedEntity : TenantScopedEntity
{
    public Guid BranchId { get; set; }
}

public class Tenant : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string TaxNumber { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    public ICollection<Branch> Branches { get; set; } = new List<Branch>();
    public ICollection<User> Users { get; set; } = new List<User>();
}

public class Branch : TenantScopedEntity
{
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string CurrencyCode { get; set; } = "TRY";
    public string TimeZone { get; set; } = "Europe/Istanbul";
    public bool IsActive { get; set; } = true;

    public Tenant? Tenant { get; set; }
    public ICollection<AreaFloor> AreaFloors { get; set; } = new List<AreaFloor>();
    public ICollection<DiningTable> DiningTables { get; set; } = new List<DiningTable>();
    public ICollection<KitchenStation> KitchenStations { get; set; } = new List<KitchenStation>();
    public ICollection<Printer> Printers { get; set; } = new List<Printer>();
    public ICollection<Category> Categories { get; set; } = new List<Category>();
    public ICollection<PaymentMethod> PaymentMethods { get; set; } = new List<PaymentMethod>();
}

public class User : TenantScopedEntity
{
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string PinCodeHash { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Waiter;
    public Guid? DefaultBranchId { get; set; }
    public bool IsActive { get; set; } = true;

    public Tenant? Tenant { get; set; }
}

public class AreaFloor : BranchScopedEntity
{
    public string Name { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }

    public ICollection<DiningTable> DiningTables { get; set; } = new List<DiningTable>();
}

public class DiningTable : BranchScopedEntity
{
    public Guid AreaFloorId { get; set; }
    public string TableNumber { get; set; } = string.Empty;
    public int Capacity { get; set; } = 4;
    public TableStatus Status { get; set; } = TableStatus.Empty;
    public int DisplayOrder { get; set; }

    public AreaFloor? AreaFloor { get; set; }
    public ICollection<TableSession> TableSessions { get; set; } = new List<TableSession>();
}

public class TableSession : BranchScopedEntity
{
    public Guid? DiningTableId { get; set; }
    public string SessionNumber { get; set; } = string.Empty;
    public Guid OpenedByUserId { get; set; }
    public DateTime OpenedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAtUtc { get; set; }
    public SessionStatus Status { get; set; } = SessionStatus.Open;
    public string? Notes { get; set; }

    // Snapshot financial totals (Calculated authoritatively on server)
    public decimal SubTotal { get; set; } = 0.00m;
    public decimal TaxTotal { get; set; } = 0.00m;
    public decimal DiscountTotal { get; set; } = 0.00m;
    public decimal GrandTotal { get; set; } = 0.00m;
    public decimal PaidTotal { get; set; } = 0.00m;
    public decimal RemainingTotal { get; set; } = 0.00m;

    public DiningTable? DiningTable { get; set; }
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}

public class Category : BranchScopedEntity
{
    public string Name { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public string ColorHex { get; set; } = "#3B82F6";
    public bool IsActive { get; set; } = true;

    public ICollection<Product> Products { get; set; } = new List<Product>();
}

public class Product : BranchScopedEntity
{
    public Guid CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Sku { get; set; }
    public string? Barcode { get; set; }
    public decimal UnitPrice { get; set; } = 0.00m;
    public decimal VatRate { get; set; } = 10.00m; // Default %10 Food VAT in TR
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsAvailable { get; set; } = true; // In-stock toggle
    public string? PortionsJson { get; set; }

    public Category? Category { get; set; }
    public ICollection<ProductStationRoute> StationRoutes { get; set; } = new List<ProductStationRoute>();
}

public class KitchenStation : BranchScopedEntity
{
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class ProductStationRoute : BranchScopedEntity
{
    public Guid ProductId { get; set; }
    public Guid KitchenStationId { get; set; }

    public Product? Product { get; set; }
    public KitchenStation? KitchenStation { get; set; }
}

public class Order : BranchScopedEntity
{
    public Guid TableSessionId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public Guid CreatedByUserId { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Submitted;
    public string? IdempotencyKey { get; set; }
    public string? Notes { get; set; }

    public TableSession? TableSession { get; set; }
    public ICollection<OrderLine> OrderLines { get; set; } = new List<OrderLine>();
}

public class OrderLine : BranchScopedEntity
{
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }
    public decimal Quantity { get; set; } = 1.00m;

    // Snapshot fields to freeze price and details at order time
    public string ProductNameSnapshot { get; set; } = string.Empty;
    public decimal UnitPriceSnapshot { get; set; } = 0.00m;
    public decimal VatRateSnapshot { get; set; } = 0.00m;
    public decimal LineTotal { get; set; } = 0.00m;
    public decimal LineTax { get; set; } = 0.00m;

    public string? Notes { get; set; }
    public bool IsComplimentary { get; set; } = false;
    public string? ComplimentaryReason { get; set; }
    public string? PortionName { get; set; }
    public Guid? KitchenStationId { get; set; }
    public OrderLineStatus Status { get; set; } = OrderLineStatus.New;
    public string? VoidReason { get; set; }
    public Guid? VoidByUserId { get; set; }

    public Order? Order { get; set; }
    public Product? Product { get; set; }
    public KitchenStation? KitchenStation { get; set; }
}

public class PaymentMethod : BranchScopedEntity
{
    public string Name { get; set; } = string.Empty;
    public PaymentType Type { get; set; } = PaymentType.Cash;
    public bool IsActive { get; set; } = true;
}

public class Payment : BranchScopedEntity
{
    public Guid TableSessionId { get; set; }
    public Guid PaymentMethodId { get; set; }
    public decimal Amount { get; set; } = 0.00m;
    public decimal TipAmount { get; set; } = 0.00m;
    public Guid ProcessedByUserId { get; set; }
    public DateTime ProcessedAtUtc { get; set; } = DateTime.UtcNow;
    public string? IdempotencyKey { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Completed;
    public string? Notes { get; set; }

    public TableSession? TableSession { get; set; }
    public PaymentMethod? PaymentMethod { get; set; }
}

public class Shift : BranchScopedEntity
{
    public Guid OpenedByUserId { get; set; }
    public DateTime OpenedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAtUtc { get; set; }
    public decimal StartingCash { get; set; } = 0.00m;
    public decimal ExpectedCash { get; set; } = 0.00m;
    public decimal ActualCash { get; set; } = 0.00m;
    public decimal Difference { get; set; } = 0.00m;
    public string? Notes { get; set; }
}

public class Printer : BranchScopedEntity
{
    public string Name { get; set; } = string.Empty;
    public PrinterConnectionType ConnectionType { get; set; } = PrinterConnectionType.VirtualFake;
    public string? IpAddress { get; set; }
    public int Port { get; set; } = 9100;
    public string? WindowsDriverName { get; set; }
    public string PaperWidth { get; set; } = "80mm";
    public Guid? KitchenStationId { get; set; }
    public bool IsActive { get; set; } = true;
}

public class PrintJob : BranchScopedEntity
{
    public Guid PrinterId { get; set; }
    public PrintJobType JobType { get; set; } = PrintJobType.KitchenTicket;
    public string Title { get; set; } = string.Empty;
    public string RawContentEscPos { get; set; } = string.Empty;
    public PrintJobStatus Status { get; set; } = PrintJobStatus.Queued;
    public int AttemptsCount { get; set; } = 0;
    public DateTime? LastAttemptAtUtc { get; set; }
    public string? LastError { get; set; }
    public bool IsReprint { get; set; } = false;

    public Printer? Printer { get; set; }
}

public class OutboxEvent : BranchScopedEntity
{
    public string AggregateType { get; set; } = string.Empty;
    public Guid AggregateId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;
    public bool IsDispatched { get; set; } = false;
    public DateTime? DispatchedAtUtc { get; set; }
    public int RetryCount { get; set; } = 0;
}

public class InboxEvent : BranchScopedEntity
{
    public Guid EventId { get; set; }
    public string AggregateType { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public DateTime ProcessedAtUtc { get; set; } = DateTime.UtcNow;
}

public class AuditLog : BranchScopedEntity
{
    public Guid UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityName { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string DetailsJson { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
}

public class NoteTemplate : BranchScopedEntity
{
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public int DisplayOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
}
