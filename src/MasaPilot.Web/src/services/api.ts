import { Area, Category, Product, SessionDetail, PaymentMethod, KitchenStation, Printer, PrintJob, Shift, DailyReport, AuditLog, SystemHealth, AuthUser, UserItem, NoteTemplate } from '../types';

const API_BASE = '/api/v1';

class ApiClient {
  private token: string | null = null;
  private onToastListener: ((type: 'success' | 'error' | 'info' | 'warning', message: string) => void) | null = null;

  constructor() {
    this.token = localStorage.getItem('masapilot_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('masapilot_token', token);
    } else {
      localStorage.removeItem('masapilot_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  setToastListener(listener: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void) {
    this.onToastListener = listener;
  }

  private notify(type: 'success' | 'error' | 'info' | 'warning', message: string) {
    if (this.onToastListener) {
      this.onToastListener(type, message);
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorMsg = `İşlem başarısız (${response.status})`;
        try {
          const errData = await response.json();
          if (errData.errors && typeof errData.errors === 'object') {
            const fieldErrors = Object.values(errData.errors).flat().join(' ');
            errorMsg = fieldErrors || errData.title || errData.message;
          } else {
            errorMsg = errData.message || errData.title || JSON.stringify(errData);
          }
        } catch {
          errorMsg = await response.text() || errorMsg;
        }

        this.notify('error', errorMsg);
        throw new Error(errorMsg);
      }

      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        this.notify('error', 'Yerel sunucuya bağlanılamadı. Lütfen LAN ağını kontrol edin.');
      }
      throw err;
    }
  }

  // Auth
  async register(data: any) {
    const res = await this.request<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) });
    this.setToken(res.token);
    this.notify('success', 'İşletme ve kurulum başarıyla oluşturuldu!');
    return res;
  }

  async login(data: any) {
    const res = await this.request<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) });
    this.setToken(res.token);
    this.notify('success', `Hoş geldiniz, ${res.fullName}!`);
    return res;
  }

  async pinLogin(branchId: string, pin: string) {
    const res = await this.request<any>('/auth/pin-login', { method: 'POST', body: JSON.stringify({ branchId, pin }) });
    this.setToken(res.token);
    this.notify('success', `Giriş başarılı: ${res.fullName}`);
    return res;
  }

  async getMe(): Promise<AuthUser> {
    return this.request<AuthUser>('/auth/me');
  }

  // Areas & Tables
  async getAreas(): Promise<Area[]> {
    return this.request<Area[]>('/areas');
  }

  async createTable(areaFloorId: string, tableNumber: string, capacity = 4) {
    const res = await this.request<any>('/tables', {
      method: 'POST',
      body: JSON.stringify({ areaFloorId, tableNumber, capacity }),
    });
    this.notify('success', `Masa ${tableNumber} eklendi.`);
    return res;
  }

  async updateTableStatus(tableId: string, status: string) {
    return this.request(`/tables/${tableId}/status`, { method: 'POST', body: JSON.stringify(status) });
  }

  // Menu
  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/categories');
  }

  async createCategory(data: { name: string; displayOrder: number; colorHex: string }) {
    const res = await this.request<Category>('/categories', { method: 'POST', body: JSON.stringify(data) });
    this.notify('success', 'Kategori eklendi.');
    return res;
  }

  async updateCategory(id: string, data: { name: string; displayOrder: number; colorHex: string }) {
    const res = await this.request<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    this.notify('success', 'Kategori güncellendi.');
    return res;
  }

  async deleteCategory(id: string) {
    await this.request(`/categories/${id}`, { method: 'DELETE' });
    this.notify('info', 'Kategori silindi.');
  }

  async getProducts(categoryId?: string): Promise<Product[]> {
    const q = categoryId ? `?categoryId=${categoryId}` : '';
    return this.request<Product[]>(`/products${q}`);
  }

  async createProduct(data: any) {
    const res = await this.request<Product>('/products', { method: 'POST', body: JSON.stringify(data) });
    this.notify('success', 'Ürün eklendi.');
    return res;
  }

  async updateProduct(id: string, data: any) {
    const res = await this.request<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    this.notify('success', 'Ürün güncellendi.');
    return res;
  }

  async deleteProduct(id: string) {
    await this.request(`/products/${id}`, { method: 'DELETE' });
    this.notify('info', 'Ürün silindi.');
  }

  // Users
  async getUsers(): Promise<UserItem[]> {
    return this.request<UserItem[]>('/users');
  }

  async createUser(data: { fullName: string; email: string; password?: string; pin?: string; role: string }) {
    const res = await this.request<UserItem>('/users', { method: 'POST', body: JSON.stringify(data) });
    this.notify('success', 'Kullanıcı eklendi.');
    return res;
  }

  async deleteUser(id: string) {
    await this.request(`/users/${id}`, { method: 'DELETE' });
    this.notify('info', 'Kullanıcı silindi.');
  }

  // Note Templates
  async getNoteTemplates(): Promise<NoteTemplate[]> {
    return this.request<NoteTemplate[]>('/note-templates');
  }

  async createNoteTemplate(data: { title: string; content: string; displayOrder: number }) {
    const res = await this.request<NoteTemplate>('/note-templates', { method: 'POST', body: JSON.stringify(data) });
    this.notify('success', 'Sipariş notu şablonu eklendi.');
    return res;
  }

  async deleteNoteTemplate(id: string) {
    await this.request(`/note-templates/${id}`, { method: 'DELETE' });
    this.notify('info', 'Şablon silindi.');
  }

  // Sessions & Orders
  async openSession(tableId: string): Promise<SessionDetail> {
    return this.request<SessionDetail>('/sessions/open', { method: 'POST', body: JSON.stringify({ diningTableId: tableId }) });
  }

  async transferSession(sessionId: string, targetTableId: string): Promise<SessionDetail> {
    const res = await this.request<SessionDetail>(`/sessions/${sessionId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ targetTableId }),
    });
    this.notify('success', 'Masa başarıyla taşındı.');
    return res;
  }

  async mergeSessions(sessionId: string, targetTableId: string): Promise<SessionDetail> {
    const res = await this.request<SessionDetail>(`/sessions/${sessionId}/merge`, {
      method: 'POST',
      body: JSON.stringify({ targetTableId }),
    });
    this.notify('success', 'Masalar başarıyla birleştirildi.');
    return res;
  }

  async applyDiscount(sessionId: string, data: { percentage?: number; fixedAmount?: number; reason?: string }): Promise<SessionDetail> {
    const res = await this.request<SessionDetail>(`/sessions/${sessionId}/discount`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.notify('success', 'İndirim uygulandı.');
    return res;
  }

  async getSession(sessionId: string): Promise<SessionDetail> {
    return this.request<SessionDetail>(`/sessions/${sessionId}`);
  }

  async addOrder(
    sessionId: string,
    lines: {
      productId: string;
      quantity: number;
      notes?: string;
      isComplimentary?: boolean;
      complimentaryReason?: string;
      portionName?: string;
      customUnitPrice?: number;
    }[],
    idempotencyKey?: string,
    orderNotes?: string
  ): Promise<SessionDetail> {
    const res = await this.request<SessionDetail>(`/sessions/${sessionId}/orders`, {
      method: 'POST',
      body: JSON.stringify({ tableSessionId: sessionId, lines, idempotencyKey, orderNotes }),
    });
    this.notify('success', 'Sipariş mutfağa ve bara iletildi.');
    return res;
  }

  async voidLine(sessionId: string, lineId: string, reason: string, supervisorPin?: string): Promise<SessionDetail> {
    const res = await this.request<SessionDetail>(`/sessions/${sessionId}/void-line/${lineId}`, {
      method: 'POST',
      body: JSON.stringify({ reason, supervisorPin }),
    });
    this.notify('info', 'Satır iptal edildi.');
    return res;
  }

  async printPreReceipt(sessionId: string) {
    const res = await this.request<any>(`/sessions/${sessionId}/print-pre-receipt`, { method: 'POST' });
    this.notify('info', 'Ön hesap fişi yazıcı kuyruğuna gönderildi.');
    return res;
  }

  async addPayment(sessionId: string, paymentMethodId: string, amount: number, tipAmount = 0, idempotencyKey?: string): Promise<SessionDetail> {
    const res = await this.request<SessionDetail>(`/sessions/${sessionId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ tableSessionId: sessionId, paymentMethodId, amount, tipAmount, idempotencyKey }),
    });
    this.notify('success', `${amount.toFixed(2)} TL tahsilat kaydedildi.`);
    return res;
  }

  // Payment Methods
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return this.request<PaymentMethod[]>('/payment-methods');
  }

  // KDS
  async getKdsStations(): Promise<KitchenStation[]> {
    return this.request<KitchenStation[]>('/kds/stations');
  }

  async getKdsOrders(stationId?: string): Promise<any[]> {
    const q = stationId ? `?stationId=${stationId}` : '';
    return this.request<any[]>(`/kds/orders${q}`);
  }

  async updateKdsLineStatus(lineId: string, newStatus: string) {
    return this.request(`/kds/lines/${lineId}/status`, { method: 'POST', body: JSON.stringify(newStatus) });
  }

  // Printers
  async getPrinters(): Promise<Printer[]> {
    return this.request<Printer[]>('/printers');
  }

  async getPrintJobs(): Promise<PrintJob[]> {
    return this.request<PrintJob[]>('/printers/jobs');
  }

  async reprintJob(jobId: string) {
    const res = await this.request<any>(`/printers/jobs/${jobId}/reprint`, { method: 'POST' });
    this.notify('info', 'Tekrar basım emri gönderildi.');
    return res;
  }

  async confirmJobPrinted(jobId: string) {
    const res = await this.request<any>(`/printers/jobs/${jobId}/confirm-printed`, { method: 'POST' });
    this.notify('success', 'Fiş basıldı olarak doğrulandı.');
    return res;
  }

  // Shifts
  async getCurrentShift(): Promise<Shift | null> {
    return this.request<Shift | null>('/shifts/current');
  }

  async openShift(startingCash: number, notes?: string): Promise<Shift> {
    const res = await this.request<Shift>('/shifts/open', { method: 'POST', body: JSON.stringify({ startingCash, notes }) });
    this.notify('success', 'Vardiya ve kasa açıldı.');
    return res;
  }

  async closeShift(actualCash: number, notes?: string): Promise<Shift> {
    const res = await this.request<Shift>('/shifts/close', { method: 'POST', body: JSON.stringify({ actualCash, notes }) });
    this.notify('success', 'Vardiya ve kasa kapatıldı.');
    return res;
  }

  // Reports
  async getDailyReport(date?: string): Promise<DailyReport> {
    const q = date ? `?date=${date}` : '';
    return this.request<DailyReport>(`/reports/daily${q}`);
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    return this.request<AuditLog[]>('/reports/audit-logs');
  }

  // System & Network
  async getNetworkInfo(): Promise<{
    primaryIp: string;
    allLocalIps: string[];
    port: number;
    serverUrl: string;
    machineName: string;
  }> {
    return this.request<any>('/system/network-info');
  }

  // Health
  async getHealth(): Promise<SystemHealth> {
    return this.request<SystemHealth>('/health');
  }

  async createBackup(): Promise<any> {
    const res = await this.request<any>('/backup/create', { method: 'POST' });
    this.notify('success', 'Şifreli tam yedek oluşturuldu ve doğrulandı.');
    return res;
  }
}

export const api = new ApiClient();
