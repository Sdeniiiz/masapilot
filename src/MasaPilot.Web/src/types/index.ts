export type UserRole = 'PlatformAdmin' | 'TenantOwner' | 'BranchManager' | 'Cashier' | 'Waiter' | 'KitchenStaff';
export type TableStatus = 'Empty' | 'Occupied' | 'BillRequested' | 'Reserved';
export type SessionStatus = 'Open' | 'Closed' | 'Merged' | 'Cancelled';
export type OrderStatus = 'Submitted' | 'Preparing' | 'Ready' | 'Delivered' | 'Cancelled';
export type OrderLineStatus = 'New' | 'SentToKitchen' | 'Preparing' | 'Ready' | 'Served' | 'Voided';
export type PaymentType = 'Cash' | 'CardExternalTerminal' | 'MealVoucher' | 'Custom';
export type PaymentStatus = 'Completed' | 'Voided' | 'Refunded';
export type PrinterConnectionType = 'NetworkEthernet' | 'WindowsDriverUsb' | 'VirtualFake';
export type PrintJobStatus = 'Queued' | 'Claimed' | 'Printing' | 'Printed' | 'RetryableFailed' | 'ManualReview' | 'Cancelled';

export interface AuthUser {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  tenantId: string;
  branchId?: string;
  branchName?: string;
  currencyCode: string;
}

export interface Area {
  id: string;
  name: string;
  displayOrder: number;
  tables: DiningTable[];
}

export interface DiningTable {
  id: string;
  areaFloorId: string;
  areaName: string;
  tableNumber: string;
  capacity: number;
  status: TableStatus;
  displayOrder: number;
  activeSessionId?: string;
  activeSessionTotal?: number;
  activeSessionOpenedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  displayOrder: number;
  colorHex: string;
  isActive: boolean;
  productCount: number;
}

export interface Product {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  sku?: string;
  barcode?: string;
  unitPrice: number;
  vatRate: number;
  imageUrl?: string;
  isActive: boolean;
  isAvailable: boolean;
  stationRouteIds: string[];
}

export interface CartLine {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
}

export interface SessionDetail {
  id: string;
  diningTableId?: string;
  tableNumber?: string;
  sessionNumber: string;
  openedAtUtc: string;
  status: SessionStatus;
  subTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  paidTotal: number;
  remainingTotal: number;
  orders: OrderSummary[];
  payments: PaymentSummary[];
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  createdAtUtc: string;
  status: OrderStatus;
  lines: OrderLineSummary[];
}

export interface OrderLineSummary {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  lineTotal: number;
  notes?: string;
  kitchenStationId?: string;
  stationName?: string;
  status: OrderLineStatus;
  voidReason?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentType;
  isActive: boolean;
}

export interface PaymentSummary {
  id: string;
  paymentMethodId: string;
  paymentMethodName: string;
  amount: number;
  tipAmount: number;
  processedAtUtc: string;
  status: PaymentStatus;
  notes?: string;
}

export interface KitchenStation {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Printer {
  id: string;
  name: string;
  connectionType: PrinterConnectionType;
  ipAddress?: string;
  port: number;
  windowsDriverName?: string;
  paperWidth: string;
  kitchenStationId?: string;
  stationName?: string;
  isActive: boolean;
}

export interface PrintJob {
  id: string;
  printerId: string;
  printerName: string;
  jobType: string;
  title: string;
  status: PrintJobStatus;
  attemptsCount: number;
  lastAttemptAtUtc?: string;
  lastError?: string;
  isReprint: boolean;
  createdAtUtc: string;
  rawContentEscPos: string;
}

export interface Shift {
  id: string;
  openedByUserId: string;
  openedByUserName: string;
  openedAtUtc: string;
  closedAtUtc?: string;
  startingCash: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  notes?: string;
  isOpen: boolean;
}

export interface DailyReport {
  date: string;
  grossSales: number;
  netSales: number;
  totalTax: number;
  totalDiscounts: number;
  totalOrders: number;
  totalGuests: number;
  paymentBreakdown: { paymentMethodName: string; totalAmount: number; transactionCount: number }[];
  categoryBreakdown: { categoryName: string; totalAmount: number; quantity: number }[];
  topProducts: { productName: string; totalAmount: number; quantity: number }[];
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityName: string;
  entityId: string;
  detailsJson: string;
  ipAddress: string;
  createdAtUtc: string;
}

export interface SystemHealth {
  runtimeMode: string;
  databaseProvider: string;
  databaseConnected: boolean;
  databaseSizeBytes: number;
  pendingOutboxCount: number;
  queuedPrintJobsCount: number;
  failedPrintJobsCount: number;
  lastSyncUtc: string;
  serverTimeUtc: string;
}

export interface UserItem {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAtUtc: string;
}

export interface NoteTemplate {
  id: string;
  title: string;
  content: string;
  displayOrder: number;
  isActive: boolean;
}
