namespace MasaPilot.Domain.Enums;

public enum UserRole
{
    PlatformAdmin = 1,
    TenantOwner = 2,
    BranchManager = 3,
    Cashier = 4,
    Waiter = 5,
    KitchenStaff = 6
}

public enum TableStatus
{
    Empty = 1,
    Occupied = 2,
    BillRequested = 3,
    Reserved = 4
}

public enum SessionStatus
{
    Open = 1,
    Closed = 2,
    Merged = 3,
    Cancelled = 4
}

public enum OrderStatus
{
    Submitted = 1,
    Preparing = 2,
    Ready = 3,
    Delivered = 4,
    Cancelled = 5
}

public enum OrderLineStatus
{
    New = 1,
    SentToKitchen = 2,
    Preparing = 3,
    Ready = 4,
    Served = 5,
    Voided = 6
}

public enum PaymentType
{
    Cash = 1,
    CardExternalTerminal = 2,
    MealVoucher = 3,
    Custom = 4
}

public enum PaymentStatus
{
    Completed = 1,
    Voided = 2,
    Refunded = 3
}

public enum PrinterConnectionType
{
    NetworkEthernet = 1,
    WindowsDriverUsb = 2,
    VirtualFake = 3
}

public enum PrintJobStatus
{
    Queued = 1,
    Claimed = 2,
    Printing = 3,
    Printed = 4,
    RetryableFailed = 5,
    ManualReview = 6,
    Cancelled = 7
}

public enum PrintJobType
{
    KitchenTicket = 1,
    BarTicket = 2,
    PreReceipt = 3,
    VoidTicket = 4,
    TestPage = 5
}
