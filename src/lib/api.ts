import type {
  BusinessSettings,
  Customer,
  Expense,
  ExpenseCategory,
  InventoryItem,
  Invoice,
  Order,
  OrderItem,
  OrderStatus,
  OrderStatusHistory,
  Payment,
  PaymentMethod,
  Profile,
  StockMovement,
  StockMovementType,
  Technician,
} from '../types/database';

let inMemoryToken = '';
let onUnauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string): void {
  inMemoryToken = token;
}

export function clearAuthToken(): void {
  inMemoryToken = '';
}

export function getAuthToken(): string {
  return inMemoryToken;
}

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorizedHandler = handler;
}

export function formatApiError(err: unknown, fallback = 'Terjadi kesalahan pada server.'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message || fallback);
  }
  return fallback;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }
  if (options.body && !(options.body instanceof ArrayBuffer) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (res.status === 401 && !url.startsWith('/api/auth/login') && !url.startsWith('/api/auth/setup')) {
    clearAuthToken();
    onUnauthorizedHandler?.();
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const errMsg =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error?: unknown }).error || 'Permintaan gagal.')
        : res.status === 404
        ? 'Endpoint server tidak ditemukan (404). Pastikan server backend Node.js berjalan dan muat ulang halaman.'
        : `Permintaan gagal (${res.status}).`;
    throw new Error(errMsg);
  }

  return parsed as T;
}

export interface BootstrapPayload {
  orders: Order[];
  customers: Customer[];
  technicians: Technician[];
  payments: Payment[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  inventoryItems: InventoryItem[];
  stockMovements: StockMovement[];
  invoices: Invoice[];
  businessSettings: BusinessSettings | null;
}

export const api = {
  // Auth
  authStatus: () => apiFetch<{ needsSetup: boolean }>('/api/auth/status'),
  setupFirstAdmin: (payload: { email: string; password: string; full_name: string }) =>
    apiFetch<{ token: string; profile: Profile }>('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    apiFetch<{ token: string; profile: Profile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () =>
    apiFetch<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),
  getMe: () => apiFetch<{ profile: Profile }>('/api/auth/me'),
  updateProfile: (payload: { full_name: string; phone: string }) =>
    apiFetch<{ profile: Profile }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  changePassword: (password: string) =>
    apiFetch<{ ok: boolean }>('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ password }),
    }),

  // Bootstrap
  bootstrap: () => apiFetch<BootstrapPayload>('/api/bootstrap'),

  // Orders & Items
  nextOrderNumber: () => apiFetch<{ order_number: string }>('/api/orders/next-number'),
  nextInvoiceNumber: () => apiFetch<{ invoice_number: string }>('/api/invoices/next-number'),
  getOrderDetails: (orderId: string) =>
    apiFetch<{
      order: Order;
      items: OrderItem[];
      payments: Payment[];
      history: OrderStatusHistory[];
      invoice: Invoice | null;
    }>(`/api/orders/${encodeURIComponent(orderId)}/details`),

  createOrder: (payload: Record<string, unknown>) =>
    apiFetch<{ order: Order; newCustomer?: Customer }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateOrder: (orderId: string, payload: Record<string, unknown>) =>
    apiFetch<{ order: Order }>(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateOrderStatus: (orderId: string, status: OrderStatus, notes: string) =>
    apiFetch<{ order: Order }>(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    }),
  toggleArchiveOrder: (orderId: string, is_archived: boolean) =>
    apiFetch<{ order: Order }>(`/api/orders/${encodeURIComponent(orderId)}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ is_archived }),
    }),
  deleteOrder: (orderId: string) =>
    apiFetch<{ ok: boolean }>(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
    }),

  addOrderItem: (
    orderId: string,
    payload: {
      work_name: string;
      description: string;
      quantity: number;
      unit: string;
      unit_price: number;
      sort_order: number;
    }
  ) =>
    apiFetch<{ id: string }>(`/api/orders/${encodeURIComponent(orderId)}/items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateOrderItem: (
    itemId: string,
    payload: {
      work_name: string;
      description: string;
      quantity: number;
      unit: string;
      unit_price: number;
    }
  ) =>
    apiFetch<{ ok: boolean }>(`/api/order-items/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteOrderItem: (itemId: string) =>
    apiFetch<{ ok: boolean }>(`/api/order-items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
    }),

  // Payments
  recordPayment: (payload: {
    order_id: string;
    amount: number;
    payment_method: PaymentMethod;
    payment_date: string;
    notes: string;
    invoice_number?: string | null;
  }) =>
    apiFetch<Record<string, unknown>>('/api/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  voidPayment: (paymentId: string) =>
    apiFetch<Record<string, unknown>>(`/api/payments/${encodeURIComponent(paymentId)}/void`, {
      method: 'POST',
    }),

  // Invoices
  upsertInvoice: (payload: { order_id: string; invoice_number?: string }) =>
    apiFetch<{ invoice: Invoice }>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateInvoiceNumber: (invoiceId: string, invoice_number: string) =>
    apiFetch<{ invoice: Invoice }>(`/api/invoices/${encodeURIComponent(invoiceId)}/number`, {
      method: 'PATCH',
      body: JSON.stringify({ invoice_number }),
    }),

  // Technicians
  createTechnician: (payload: Omit<Technician, 'id' | 'created_at' | 'updated_at'>) =>
    apiFetch<{ technician: Technician }>('/api/technicians', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTechnician: (id: string, payload: Omit<Technician, 'id' | 'created_at' | 'updated_at'>) =>
    apiFetch<{ technician: Technician }>(`/api/technicians/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  toggleTechnician: (id: string, is_active: boolean) =>
    apiFetch<{ technician: Technician }>(`/api/technicians/${encodeURIComponent(id)}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    }),
  deleteTechnician: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/technicians/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Customers
  createCustomer: (payload: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) =>
    apiFetch<{ customer: Customer }>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCustomer: (id: string, payload: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) =>
    apiFetch<{ customer: Customer }>(`/api/customers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteCustomer: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/customers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Expenses
  createExpense: (payload: {
    expense_date: string;
    title: string;
    category_name: string;
    amount: number;
    payment_method: PaymentMethod;
    notes: string;
  }) =>
    apiFetch<{ expense: Expense }>('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateExpense: (
    id: string,
    payload: {
      expense_date: string;
      title: string;
      category_name: string;
      amount: number;
      payment_method: PaymentMethod;
      notes: string;
    }
  ) =>
    apiFetch<{ expense: Expense }>(`/api/expenses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteExpense: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/expenses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Inventory
  createInventoryItem: (payload: {
    item_code: string;
    name: string;
    category: string;
    unit: string;
    stock: number;
    min_stock: number;
    buy_price: number;
    sell_price: number;
  }) =>
    apiFetch<{ item: InventoryItem }>('/api/inventory', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateInventoryItem: (
    id: string,
    payload: {
      item_code: string;
      name: string;
      category: string;
      unit: string;
      min_stock: number;
      buy_price: number;
      sell_price: number;
    }
  ) =>
    apiFetch<{ item: InventoryItem }>(`/api/inventory/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteInventoryItem: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/inventory/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  recordStockMovement: (
    itemId: string,
    payload: {
      movement_type: StockMovementType;
      quantity: number;
      reference_note: string;
      order_id?: string | null;
    }
  ) =>
    apiFetch<Record<string, unknown>>(`/api/inventory/${encodeURIComponent(itemId)}/movements`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Settings
  updateSettings: (payload: Partial<BusinessSettings>) =>
    apiFetch<{ settings: BusinessSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Database Backup & Restore
  downloadBackup: async () => {
    const res = await fetch('/api/database/backup', {
      credentials: 'include',
      headers: inMemoryToken ? { Authorization: `Bearer ${inMemoryToken}` } : {},
    });
    if (!res.ok) {
      let errMsg = 'Gagal mengunduh backup database.';
      try {
        const data = await res.json();
        if (data?.error) errMsg = String(data.error);
      } catch {
        // ignore parse error
      }
      throw new Error(errMsg);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || `jawara_ac_backup_${new Date().toISOString().slice(0, 10)}.db`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  restoreDatabase: async (file: File) => {
    const buffer = await file.arrayBuffer();
    return apiFetch<{ ok: boolean; message: string }>('/api/database/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    });
  },
};
