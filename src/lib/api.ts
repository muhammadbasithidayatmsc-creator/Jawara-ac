import type {
  BusinessSettings,
  Customer,
  Expense,
  ExpenseCategory,
  InventoryItem,
  Invoice,
  Order,
  OrderStatus,
  Payment,
  PaymentMethod,
  StockMovement,
  StockMovementType,
  Technician,
} from '../types/database';
import {
  addOrderItem,
  changeAdminPassword,
  createCustomer,
  createExpense,
  createInventoryItem,
  createOrder,
  createTechnician,
  deleteCustomer,
  deleteExpense,
  deleteInventoryItem,
  deleteOrder,
  deleteOrderItem,
  deleteTechnician,
  exportDatabaseJson,
  generateNextInvoiceNumber,
  generateNextOrderNumber,
  getAuthStatus,
  getBootstrapData,
  getMe,
  getOrderDetails,
  importDatabaseJson,
  loginAdmin,
  logoutAdmin,
  recordPayment,
  recordStockMovement,
  setupFirstAdmin,
  toggleArchiveOrder,
  toggleTechnician,
  updateAdminProfile,
  updateBusinessSettings,
  updateCustomer,
  updateExpense,
  updateInventoryItem,
  updateInvoiceNumber,
  updateOrder,
  updateOrderItem,
  updateOrderStatus,
  updateTechnician,
  upsertInvoice,
  voidPayment,
} from './db';

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

export function formatApiError(err: unknown, fallback = 'Terjadi kesalahan saat memproses data.'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message || fallback);
  }
  return fallback;
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

async function runLocal<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Error && err.message.includes('Sesi Admin tidak ditemukan')) {
      clearAuthToken();
      onUnauthorizedHandler?.();
    }
    throw err;
  }
}

export const api = {
  // Auth (Local IndexedDB)
  authStatus: () => getAuthStatus(),
  setupFirstAdmin: (payload: { email: string; password: string; full_name: string }) =>
    setupFirstAdmin(payload),
  login: (payload: { email: string; password: string }) => loginAdmin(payload),
  logout: () => logoutAdmin(),
  getMe: () => getMe(),
  updateProfile: (payload: { email?: string; full_name: string; phone: string }) =>
    runLocal(() => updateAdminProfile(payload)),
  changePassword: (password: string) => runLocal(() => changeAdminPassword(password)),

  // Bootstrap
  bootstrap: (): Promise<BootstrapPayload> => runLocal(() => getBootstrapData()),

  // Orders & Items
  nextOrderNumber: async () => ({ order_number: await generateNextOrderNumber() }),
  nextInvoiceNumber: async () => ({ invoice_number: await generateNextInvoiceNumber() }),
  getOrderDetails: (orderId: string) => runLocal(() => getOrderDetails(orderId)),

  createOrder: (payload: Record<string, unknown>) => runLocal(() => createOrder(payload)),
  updateOrder: (orderId: string, payload: Record<string, unknown>) =>
    runLocal(() => updateOrder(orderId, payload)),
  updateOrderStatus: (orderId: string, status: OrderStatus, notes: string) =>
    runLocal(() => updateOrderStatus(orderId, status, notes)),
  toggleArchiveOrder: (orderId: string, is_archived: boolean) =>
    runLocal(() => toggleArchiveOrder(orderId, is_archived)),
  deleteOrder: (orderId: string) => runLocal(() => deleteOrder(orderId)),

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
  ) => runLocal(() => addOrderItem(orderId, payload)),
  updateOrderItem: (
    itemId: string,
    payload: {
      work_name: string;
      description: string;
      quantity: number;
      unit: string;
      unit_price: number;
    }
  ) => runLocal(() => updateOrderItem(itemId, payload)),
  deleteOrderItem: (itemId: string) => runLocal(() => deleteOrderItem(itemId)),

  // Payments
  recordPayment: (payload: {
    order_id: string;
    amount: number;
    payment_method: PaymentMethod;
    payment_date: string;
    notes: string;
    invoice_number?: string | null;
  }) => runLocal(() => recordPayment(payload)),
  voidPayment: (paymentId: string) => runLocal(() => voidPayment(paymentId)),

  // Invoices
  upsertInvoice: (payload: { order_id: string; invoice_number?: string }) =>
    runLocal(() => upsertInvoice(payload)),
  updateInvoiceNumber: (invoiceId: string, invoice_number: string) =>
    runLocal(() => updateInvoiceNumber(invoiceId, invoice_number)),

  // Technicians
  createTechnician: (payload: Omit<Technician, 'id' | 'created_at' | 'updated_at'>) =>
    runLocal(() => createTechnician(payload)),
  updateTechnician: (id: string, payload: Omit<Technician, 'id' | 'created_at' | 'updated_at'>) =>
    runLocal(() => updateTechnician(id, payload)),
  toggleTechnician: (id: string, is_active: boolean) =>
    runLocal(() => toggleTechnician(id, is_active)),
  deleteTechnician: (id: string) => runLocal(() => deleteTechnician(id)),

  // Customers
  createCustomer: (payload: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) =>
    runLocal(() => createCustomer(payload)),
  updateCustomer: (id: string, payload: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) =>
    runLocal(() => updateCustomer(id, payload)),
  deleteCustomer: (id: string) => runLocal(() => deleteCustomer(id)),

  // Expenses
  createExpense: (payload: {
    expense_date: string;
    title: string;
    category_name: string;
    amount: number;
    payment_method: PaymentMethod;
    notes: string;
  }) => runLocal(() => createExpense(payload)),
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
  ) => runLocal(() => updateExpense(id, payload)),
  deleteExpense: (id: string) => runLocal(() => deleteExpense(id)),

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
  }) => runLocal(() => createInventoryItem(payload)),
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
  ) => runLocal(() => updateInventoryItem(id, payload)),
  deleteInventoryItem: (id: string) => runLocal(() => deleteInventoryItem(id)),
  recordStockMovement: (
    itemId: string,
    payload: {
      movement_type: StockMovementType;
      quantity: number;
      reference_note: string;
      order_id?: string | null;
    }
  ) => runLocal(() => recordStockMovement(itemId, payload)),

  // Settings
  updateSettings: (payload: Partial<BusinessSettings>) =>
    runLocal(() => updateBusinessSettings(payload)),

  // Database Backup & Restore (JSON)
  downloadBackup: async () => {
    const { filename, content } = await runLocal(() => exportDatabaseJson());
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
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
    const text = await file.text();
    return runLocal(() => importDatabaseJson(text));
  },
};
