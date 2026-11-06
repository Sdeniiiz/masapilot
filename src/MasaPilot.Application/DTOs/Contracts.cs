using System;
using System.Collections.Generic;
using MasaPilot.Domain.Enums;

namespace MasaPilot.Application.DTOs;

public record RegisterTenantRequest(
    string TenantName, 
    string? Slug = null, 
    string? BranchName = "Merkez Şube", 
    string AdminFullName = "Yönetici", 
    string AdminEmail = "", 
    string AdminPassword = "", 
    string CurrencyCode = "TRY", 
    string TimeZone = "Europe/Istanbul"
);

public record LoginRequest(string Email, string Password);
public record PinLoginRequest(Guid BranchId, string Pin);

public record AuthResponse(string Token, Guid TenantId, Guid? BranchId, Guid UserId, string FullName, string Email, UserRole Role);

public record AreaDto(Guid Id, string Name, int DisplayOrder, List<TableDto> Tables);
public record TableDto(Guid Id, Guid AreaFloorId, string AreaName, string TableNumber, int Capacity, TableStatus Status, int DisplayOrder, Guid? ActiveSessionId, decimal? ActiveSessionTotal, DateTime? ActiveSessionOpenedAt);

public record CreateAreaRequest(string Name, int DisplayOrder = 0);
public record CreateTableRequest(Guid AreaFloorId, string TableNumber, int Capacity = 4, int DisplayOrder = 0);

public record CategoryDto(Guid Id, string Name, int DisplayOrder, string ColorHex, bool IsActive, int ProductCount);
public record CreateCategoryRequest(string Name, int DisplayOrder = 0, string ColorHex = "#3B82F6");

public record ProductPortionDto(string Name, decimal Price, bool IsDefault = false);

public record ProductDto(Guid Id, Guid CategoryId, string CategoryName, string Name, string Description, string? Sku, string? Barcode, decimal UnitPrice, decimal VatRate, string? ImageUrl, bool IsActive, bool IsAvailable, List<Guid> StationRouteIds, List<ProductPortionDto>? Portions = null);
public record CreateProductRequest(Guid CategoryId, string Name, string Description, decimal UnitPrice, decimal VatRate = 10m, string? Sku = null, string? Barcode = null, string? ImageUrl = null, List<Guid>? StationRouteIds = null, List<ProductPortionDto>? Portions = null);
public record UpdateProductRequest(Guid CategoryId, string Name, string Description, decimal UnitPrice, decimal VatRate, bool IsActive, bool IsAvailable, string? Sku = null, string? Barcode = null, string? ImageUrl = null, List<Guid>? StationRouteIds = null, List<ProductPortionDto>? Portions = null);

public record OpenSessionRequest(Guid DiningTableId, string? Notes = null);
public record TransferTableRequest(Guid TargetTableId);
public record MergeTableRequest(Guid TargetTableId);
public record ApplyDiscountRequest(decimal? Percentage = null, decimal? FixedAmount = null, string? Reason = null);

public record SessionDetailDto(Guid Id, Guid? DiningTableId, string? TableNumber, string SessionNumber, DateTime OpenedAtUtc, SessionStatus Status, decimal SubTotal, decimal TaxTotal, decimal DiscountTotal, decimal GrandTotal, decimal PaidTotal, decimal RemainingTotal, List<OrderSummaryDto> Orders, List<PaymentSummaryDto> Payments);

public record AddOrderRequest(Guid TableSessionId, List<OrderLineInput> Lines, string? IdempotencyKey = null, string? OrderNotes = null);
public record OrderLineInput(Guid ProductId, decimal Quantity, string? Notes = null, bool IsComplimentary = false, string? ComplimentaryReason = null, string? PortionName = null, decimal? CustomUnitPrice = null);

public record OrderSummaryDto(Guid Id, string OrderNumber, DateTime CreatedAtUtc, OrderStatus Status, List<OrderLineSummaryDto> Lines, string? Notes = null);
public record OrderLineSummaryDto(Guid Id, Guid ProductId, string ProductName, decimal Quantity, decimal UnitPrice, decimal VatRate, decimal LineTotal, string? Notes, Guid? KitchenStationId, string? StationName, OrderLineStatus Status, string? VoidReason, bool IsComplimentary = false, string? ComplimentaryReason = null, string? PortionName = null, bool IsPaid = false, Guid? PaymentId = null);

public record VoidLineRequest(string Reason, string? SupervisorPin = null);

public record PaymentMethodDto(Guid Id, string Name, PaymentType Type, bool IsActive);
public record CreatePaymentRequest(Guid TableSessionId, Guid PaymentMethodId, decimal Amount, decimal TipAmount = 0.00m, string? Notes = null, string? IdempotencyKey = null, List<Guid>? PaidLineIds = null);
public record PaymentSummaryDto(Guid Id, Guid PaymentMethodId, string PaymentMethodName, decimal Amount, decimal TipAmount, DateTime ProcessedAtUtc, PaymentStatus Status, string? Notes);

public record KitchenStationDto(Guid Id, string Name, bool IsActive);
public record CreateStationRequest(string Name);

public record PrinterDto(Guid Id, string Name, PrinterConnectionType ConnectionType, string? IpAddress, int Port, string? WindowsDriverName, string PaperWidth, Guid? KitchenStationId, string? StationName, bool IsActive);
public record CreatePrinterRequest(string Name, PrinterConnectionType ConnectionType, string? IpAddress = null, int Port = 9100, string? WindowsDriverName = null, string PaperWidth = "80mm", Guid? KitchenStationId = null);

public record PrintJobDto(Guid Id, Guid PrinterId, string PrinterName, PrintJobType JobType, string Title, PrintJobStatus Status, int AttemptsCount, DateTime? LastAttemptAtUtc, string? LastError, bool IsReprint, DateTime CreatedAtUtc, string RawContentEscPos);

public record ShiftDto(Guid Id, Guid OpenedByUserId, string OpenedByUserName, DateTime OpenedAtUtc, DateTime? ClosedAtUtc, decimal StartingCash, decimal ExpectedCash, decimal ActualCash, decimal Difference, string? Notes, bool IsOpen);
public record OpenShiftRequest(decimal StartingCash, string? Notes = null);
public record CloseShiftRequest(decimal ActualCash, string? Notes = null);

public record DailySalesReport(DateTime Date, decimal GrossSales, decimal NetSales, decimal TotalTax, decimal TotalDiscounts, int TotalOrders, int TotalGuests, List<PaymentMethodTotalDto> PaymentBreakdown, List<CategorySalesDto> CategoryBreakdown, List<ProductSalesDto> TopProducts);
public record PaymentMethodTotalDto(string PaymentMethodName, decimal TotalAmount, int TransactionCount);
public record CategorySalesDto(string CategoryName, decimal TotalAmount, decimal Quantity);
public record ProductSalesDto(string ProductName, decimal TotalAmount, decimal Quantity);

public record SystemHealthDto(string RuntimeMode, string DatabaseProvider, bool DatabaseConnected, long DatabaseSizeBytes, int PendingOutboxCount, int QueuedPrintJobsCount, int FailedPrintJobsCount, DateTime LastSyncUtc, DateTime ServerTimeUtc);

public record SyncEventDto(Guid EventId, Guid TenantId, Guid BranchId, string AggregateType, Guid AggregateId, string EventType, string PayloadJson, DateTime OccurredAtUtc);
public record SyncPushResponse(int ReceivedCount, int ProcessedCount, int DuplicateIgnoredCount);
