export type OrderStatus =
  | 'Baru'
  | 'Terjadwal'
  | 'Ditugaskan'
  | 'Dikerjakan'
  | 'Selesai'
  | 'Dibatalkan';

export const ORDER_STATUSES: OrderStatus[] = [
  'Baru',
  'Terjadwal',
  'Ditugaskan',
  'Dikerjakan',
  'Selesai',
  'Dibatalkan',
];

export type PaymentStatus = 'BELUM BAYAR' | 'DP' | 'LUNAS';
export type PaymentMethod = 'CASH' | 'TRANSFER';
export type StockMovementType = 'MASUK' | 'KELUAR' | 'PENYESUAIAN';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Technician {
  id: string;
  name: string;
  whatsapp: string;
  address: string;
  specialty: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  whatsapp: string;
  address: string;
  email: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  invoice_number: string | null;
  customer_id: string;
  customer_name: string;
  customer_whatsapp: string;
  service_address: string;
  service_name: string;
  service_date: string;
  service_time: string | null;
  technician_id: string | null;
  technician_name: string;
  complaint: string;
  labor_cost: number;
  additional_cost: number;
  material_cost: number;
  discount: number;
  total_amount: number;
  paid_amount: number;
  payment_status: PaymentStatus;
  status: OrderStatus;
  internal_notes: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  work_name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  invoice_id: string | null;
  order_number: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  notes: string;
  is_void: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  expense_date: string;
  title: string;
  category_id: string | null;
  category_name: string;
  amount: number;
  payment_method: PaymentMethod;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  item_code: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  min_stock: number;
  buy_price: number;
  sell_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  item_id: string;
  movement_type: StockMovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_note: string;
  order_id: string | null;
  created_by: string | null;
  created_at: string;
  inventory_items?: {
    name: string;
    item_code: string;
    unit: string;
  } | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  issued_date: string;
  due_date: string | null;
  customer_name: string;
  customer_whatsapp: string;
  customer_address: string;
  service_name: string;
  technician_name: string;
  subtotal_amount: number;
  additional_cost: number;
  material_cost: number;
  discount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: PaymentStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  previous_status: string;
  new_status: string;
  notes: string;
  changed_by: string | null;
  changed_at: string;
}

export interface BusinessSettings {
  id: string;
  business_name: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  order_prefix: string;
  invoice_prefix: string;
  invoice_footer_note: string;
  created_at: string;
  updated_at: string;
}

export type AppRoute =
  | 'dashboard'
  | 'orders'
  | 'technicians'
  | 'customers'
  | 'payments'
  | 'invoices'
  | 'expenses'
  | 'inventory'
  | 'reports'
  | 'settings';
