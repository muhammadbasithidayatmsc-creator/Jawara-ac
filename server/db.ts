import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { hashPassword } from './auth.ts';

const REQUIRED_TABLES = [
  'admins',
  'technicians',
  'customers',
  'orders',
  'order_items',
  'invoices',
  'payments',
  'expense_categories',
  'expenses',
  'inventory_items',
  'stock_movements',
  'order_status_history',
  'business_settings',
];

let dbInstance: Database.Database | null = null;

export function getDataDir(): string {
  const configured = process.env.DATA_DIR?.trim();
  return path.resolve(configured || path.join(process.cwd(), 'data'));
}

export function getDbPath(): string {
  return path.join(getDataDir(), 'jawara_ac.db');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function yearMonthJakarta(): string {
  return todayJakarta().replace(/-/g, '').slice(0, 6);
}

function configurePragmas(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
}

function applySchemaAndSeed(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL DEFAULT 'Admin JAWARA AC',
      phone TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

    CREATE TABLE IF NOT EXISTS technicians (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      specialty TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_technicians_name ON technicians(name);
    CREATE INDEX IF NOT EXISTS idx_technicians_active ON technicians(is_active);

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
    CREATE INDEX IF NOT EXISTS idx_customers_whatsapp ON customers(whatsapp);

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      invoice_number TEXT UNIQUE,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
      customer_name TEXT NOT NULL,
      customer_whatsapp TEXT NOT NULL,
      service_address TEXT NOT NULL DEFAULT '',
      service_name TEXT NOT NULL,
      service_date TEXT NOT NULL,
      service_time TEXT,
      technician_id TEXT REFERENCES technicians(id) ON DELETE SET NULL,
      technician_name TEXT NOT NULL DEFAULT '',
      complaint TEXT NOT NULL DEFAULT '',
      labor_cost REAL NOT NULL DEFAULT 0 CHECK (labor_cost >= 0),
      additional_cost REAL NOT NULL DEFAULT 0 CHECK (additional_cost >= 0),
      material_cost REAL NOT NULL DEFAULT 0 CHECK (material_cost >= 0),
      discount REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
      total_amount REAL NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
      paid_amount REAL NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
      payment_status TEXT NOT NULL DEFAULT 'BELUM BAYAR' CHECK (payment_status IN ('BELUM BAYAR', 'DP', 'LUNAS')),
      status TEXT NOT NULL DEFAULT 'Baru' CHECK (status IN ('Baru', 'Terjadwal', 'Ditugaskan', 'Dikerjakan', 'Selesai', 'Dibatalkan')),
      internal_notes TEXT NOT NULL DEFAULT '',
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_service_date ON orders(service_date DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
    CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_technician_id ON orders(technician_id);
    CREATE INDEX IF NOT EXISTS idx_orders_archived ON orders(is_archived);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      work_name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      quantity REAL NOT NULL DEFAULT 1 CHECK (quantity > 0),
      unit TEXT NOT NULL DEFAULT 'Unit',
      unit_price REAL NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
      subtotal REAL NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      issued_date TEXT NOT NULL,
      due_date TEXT,
      customer_name TEXT NOT NULL,
      customer_whatsapp TEXT NOT NULL DEFAULT '',
      customer_address TEXT NOT NULL DEFAULT '',
      service_name TEXT NOT NULL DEFAULT '',
      technician_name TEXT NOT NULL DEFAULT '',
      subtotal_amount REAL NOT NULL DEFAULT 0,
      additional_cost REAL NOT NULL DEFAULT 0,
      material_cost REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      remaining_amount REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'BELUM BAYAR' CHECK (payment_status IN ('BELUM BAYAR', 'DP', 'LUNAS')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_issued_date ON invoices(issued_date DESC);

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
      order_number TEXT NOT NULL,
      invoice_number TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'TRANSFER')),
      payment_date TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      is_void INTEGER NOT NULL DEFAULT 0,
      created_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC);
    CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);
    CREATE INDEX IF NOT EXISTS idx_payments_void ON payments(is_void);

    CREATE TABLE IF NOT EXISTS expense_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      expense_date TEXT NOT NULL,
      title TEXT NOT NULL,
      category_id TEXT REFERENCES expense_categories(id) ON DELETE SET NULL,
      category_name TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'TRANSFER')),
      notes TEXT NOT NULL DEFAULT '',
      created_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_name);

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      item_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Sparepart',
      unit TEXT NOT NULL DEFAULT 'Pcs',
      stock REAL NOT NULL DEFAULT 0 CHECK (stock >= 0),
      min_stock REAL NOT NULL DEFAULT 2 CHECK (min_stock >= 0),
      buy_price REAL NOT NULL DEFAULT 0 CHECK (buy_price >= 0),
      sell_price REAL NOT NULL DEFAULT 0 CHECK (sell_price >= 0),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_inventory_code ON inventory_items(item_code);
    CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory_items(name);

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      movement_type TEXT NOT NULL CHECK (movement_type IN ('MASUK', 'KELUAR', 'PENYESUAIAN')),
      quantity REAL NOT NULL CHECK (quantity > 0),
      previous_stock REAL NOT NULL,
      new_stock REAL NOT NULL,
      reference_note TEXT NOT NULL DEFAULT '',
      order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
      created_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON stock_movements(item_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);

    CREATE TABLE IF NOT EXISTS order_status_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      previous_status TEXT NOT NULL DEFAULT '',
      new_status TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      changed_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
      changed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_at ON order_status_history(changed_at DESC);

    CREATE TABLE IF NOT EXISTS business_settings (
      id TEXT PRIMARY KEY,
      business_name TEXT NOT NULL DEFAULT 'JAWARA AC',
      tagline TEXT NOT NULL DEFAULT 'Service AC Lebih Mudah, Bisnis Lebih Maju',
      phone TEXT NOT NULL DEFAULT '',
      whatsapp TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      bank_name TEXT NOT NULL DEFAULT '',
      bank_account_number TEXT NOT NULL DEFAULT '',
      bank_account_name TEXT NOT NULL DEFAULT '',
      order_prefix TEXT NOT NULL DEFAULT 'ORD-JWR',
      invoice_prefix TEXT NOT NULL DEFAULT 'INV-JWR',
      invoice_footer_note TEXT NOT NULL DEFAULT 'Terima kasih telah mempercayakan perawatan AC Anda kepada JAWARA AC. Garansi servis berlaku sesuai ketentuan.',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const ts = nowIso();

  // Seed default expense categories
  const defaultCategories = [
    ['Pembelian sparepart', 'Freon, kapasitor, pipa, bracket, dan komponen AC'],
    ['Transportasi', 'BBM, parkir, tol, dan operasional kendaraan teknisi'],
    ['Operasional', 'Listrik, air, pulsa/kuota, ATK, dan kebutuhan kantor'],
    ['Gaji teknisi', 'Upah, komisi, dan insentif teknisi lapangan'],
    ['Peralatan', 'Pembelian atau servis mesin steam, manifold, vacuum pump'],
    ['Lain-lain', 'Pengeluaran operasional lainnya'],
  ];

  const insertCat = db.prepare(`
    INSERT INTO expense_categories (id, name, description, is_default, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(name) DO NOTHING
  `);
  for (const [name, desc] of defaultCategories) {
    insertCat.run(crypto.randomUUID(), name, desc, ts, ts);
  }

  // Seed default business settings
  const bizCount = (db.prepare('SELECT COUNT(*) AS cnt FROM business_settings').get() as { cnt: number }).cnt;
  if (bizCount === 0) {
    db.prepare(`
      INSERT INTO business_settings (id, business_name, tagline, created_at, updated_at)
      VALUES (?, 'JAWARA AC', 'Service AC Lebih Mudah, Bisnis Lebih Maju', ?, ?)
    `).run(crypto.randomUUID(), ts, ts);
  }

  // Optional environment admin bootstrap
  const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  const envName = process.env.ADMIN_NAME?.trim() || 'Admin JAWARA AC';
  if (envEmail && envPass && envPass.length >= 6) {
    const existing = db.prepare('SELECT id FROM admins WHERE LOWER(email) = ?').get(envEmail);
    if (!existing) {
      db.prepare(`
        INSERT INTO admins (id, email, password_hash, full_name, phone, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, '', 'admin', 1, ?, ?)
      `).run(crypto.randomUUID(), envEmail, hashPassword(envPass), envName, ts, ts);
    }
  }
}

export function initDb(): Database.Database {
  if (dbInstance) return dbInstance;
  fs.mkdirSync(getDataDir(), { recursive: true });
  const db = new Database(getDbPath());
  configurePragmas(db);
  applySchemaAndSeed(db);
  dbInstance = db;
  return dbInstance;
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // ignore checkpoint error on close
    }
    dbInstance.close();
    dbInstance = null;
  }
}

// =============================================================================
// ROW MAPPERS (Convert SQLite 0/1 integers to clean booleans)
// =============================================================================

export function mapTechnician(row: Record<string, unknown>) {
  return {
    ...row,
    is_active: Boolean(row.is_active),
  };
}

export function mapOrder(row: Record<string, unknown>) {
  return {
    ...row,
    is_archived: Boolean(row.is_archived),
  };
}

export function mapPayment(row: Record<string, unknown>) {
  return {
    ...row,
    is_void: Boolean(row.is_void),
  };
}

export function mapExpenseCategory(row: Record<string, unknown>) {
  return {
    ...row,
    is_default: Boolean(row.is_default),
  };
}

export function mapInventoryItem(row: Record<string, unknown>) {
  return {
    ...row,
    is_active: Boolean(row.is_active),
  };
}

// =============================================================================
// ATOMIC BUSINESS TRANSACTIONS (SQLITE TRANSACTIONS)
// =============================================================================

export function generateNextOrderNumber(db: Database.Database): string {
  const biz = db.prepare('SELECT order_prefix FROM business_settings LIMIT 1').get() as
    | { order_prefix?: string }
    | undefined;
  const prefix = biz?.order_prefix?.trim() || 'ORD-JWR';
  const ym = yearMonthJakarta();
  const base = `${prefix}-${ym}-`;

  const rows = db
    .prepare('SELECT order_number FROM orders WHERE order_number LIKE ?')
    .all(`${base}%`) as { order_number: string }[];

  let maxSeq = 0;
  for (const r of rows) {
    const tail = r.order_number.slice(base.length);
    if (/^\d+$/.test(tail)) {
      maxSeq = Math.max(maxSeq, Number(tail));
    }
  }
  return `${base}${String(maxSeq + 1).padStart(4, '0')}`;
}

export function generateNextInvoiceNumber(db: Database.Database): string {
  const biz = db.prepare('SELECT invoice_prefix FROM business_settings LIMIT 1').get() as
    | { invoice_prefix?: string }
    | undefined;
  const prefix = biz?.invoice_prefix?.trim() || 'INV-JWR';
  const ym = yearMonthJakarta();
  const base = `${prefix}-${ym}-`;

  const invRows = db
    .prepare('SELECT invoice_number FROM invoices WHERE invoice_number LIKE ?')
    .all(`${base}%`) as { invoice_number: string }[];
  const ordRows = db
    .prepare('SELECT invoice_number FROM orders WHERE invoice_number LIKE ?')
    .all(`${base}%`) as { invoice_number: string }[];

  let maxSeq = 0;
  for (const r of [...invRows, ...ordRows]) {
    const tail = (r.invoice_number || '').slice(base.length);
    if (/^\d+$/.test(tail)) {
      maxSeq = Math.max(maxSeq, Number(tail));
    }
  }
  return `${base}${String(maxSeq + 1).padStart(4, '0')}`;
}

export function recalculateOrderTotals(
  db: Database.Database,
  orderId: string,
  fromItems: boolean
) {
  const runTx = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
      | Record<string, unknown>
      | undefined;
    if (!order) {
      throw new Error('Order tidak ditemukan.');
    }

    const agg = db
      .prepare('SELECT COUNT(*) AS cnt, COALESCE(SUM(subtotal), 0) AS total FROM order_items WHERE order_id = ?')
      .get(orderId) as { cnt: number; total: number };

    const labor = fromItems
      ? Number(agg.total)
      : agg.cnt > 0
      ? Number(agg.total)
      : Number(order.labor_cost);

    const additional = Number(order.additional_cost) || 0;
    const material = Number(order.material_cost) || 0;
    const discount = Number(order.discount) || 0;
    const total = Math.max(0, labor + additional + material - discount);

    const paidAgg = db
      .prepare('SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE order_id = ? AND is_void = 0')
      .get(orderId) as { paid: number };
    const paid = Number(paidAgg.paid) || 0;

    let payStatus: 'BELUM BAYAR' | 'DP' | 'LUNAS' = 'BELUM BAYAR';
    if (total > 0 && paid >= total) {
      payStatus = 'LUNAS';
    } else if (paid > 0 && total === 0) {
      payStatus = 'LUNAS';
    } else if (paid > 0) {
      payStatus = 'DP';
    }

    const ts = nowIso();
    db.prepare(`
      UPDATE orders
      SET labor_cost = ?, total_amount = ?, paid_amount = ?, payment_status = ?, updated_at = ?
      WHERE id = ?
    `).run(labor, total, paid, payStatus, ts, orderId);

    const remaining = Math.max(0, total - paid);
    db.prepare(`
      UPDATE invoices
      SET customer_name = ?, customer_whatsapp = ?, customer_address = ?,
          service_name = ?, technician_name = ?,
          subtotal_amount = ?, additional_cost = ?, material_cost = ?, discount = ?,
          total_amount = ?, paid_amount = ?, remaining_amount = ?, payment_status = ?, updated_at = ?
      WHERE order_id = ?
    `).run(
      order.customer_name,
      order.customer_whatsapp,
      order.service_address,
      order.service_name,
      order.technician_name,
      labor,
      additional,
      material,
      discount,
      total,
      paid,
      remaining,
      payStatus,
      ts,
      orderId
    );

    return {
      order_id: orderId,
      labor_cost: labor,
      total_amount: total,
      paid_amount: paid,
      remaining_amount: remaining,
      payment_status: payStatus,
    };
  });

  return runTx();
}

export function recordOrderPayment(
  db: Database.Database,
  input: {
    orderId: string;
    amount: number;
    paymentMethod: 'CASH' | 'TRANSFER';
    paymentDate?: string;
    notes?: string;
    invoiceNumber?: string | null;
    adminId: string;
  }
) {
  const runTx = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(input.orderId) as
      | Record<string, unknown>
      | undefined;
    if (!order) {
      throw new Error('Order tidak ditemukan.');
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('Nominal pembayaran harus lebih besar dari 0.');
    }
    if (input.paymentMethod !== 'CASH' && input.paymentMethod !== 'TRANSFER') {
      throw new Error('Metode pembayaran harus CASH atau TRANSFER.');
    }

    const ts = nowIso();
    const existingInvoice = db
      .prepare('SELECT id, invoice_number FROM invoices WHERE order_id = ?')
      .get(input.orderId) as { id: string; invoice_number: string } | undefined;

    let invId = existingInvoice?.id || null;
    let invNumber =
      existingInvoice?.invoice_number ||
      (order.invoice_number ? String(order.invoice_number).trim() : '') ||
      (input.invoiceNumber ? input.invoiceNumber.trim() : '') ||
      generateNextInvoiceNumber(db);

    if (!invId) {
      invId = crypto.randomUUID();
      const total = Number(order.total_amount) || 0;
      const paid = Number(order.paid_amount) || 0;
      db.prepare(`
        INSERT INTO invoices (
          id, invoice_number, order_id, issued_date,
          customer_name, customer_whatsapp, customer_address,
          service_name, technician_name,
          subtotal_amount, additional_cost, material_cost, discount,
          total_amount, paid_amount, remaining_amount, payment_status,
          notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)
      `).run(
        invId,
        invNumber,
        input.orderId,
        todayJakarta(),
        order.customer_name,
        order.customer_whatsapp,
        order.service_address,
        order.service_name,
        order.technician_name,
        order.labor_cost,
        order.additional_cost,
        order.material_cost,
        order.discount,
        total,
        paid,
        Math.max(0, total - paid),
        order.payment_status,
        ts,
        ts
      );
    }

    const paymentId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO payments (
        id, order_id, invoice_id, order_number, invoice_number,
        customer_name, amount, payment_method, payment_date, notes,
        is_void, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(
      paymentId,
      input.orderId,
      invId,
      order.order_number,
      invNumber,
      order.customer_name,
      input.amount,
      input.paymentMethod,
      input.paymentDate || ts,
      input.notes?.trim() || '',
      input.adminId,
      ts,
      ts
    );

    const paidAgg = db
      .prepare('SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE order_id = ? AND is_void = 0')
      .get(input.orderId) as { paid: number };
    const newPaid = Number(paidAgg.paid) || 0;
    const totalAmount = Number(order.total_amount) || 0;

    let payStatus: 'BELUM BAYAR' | 'DP' | 'LUNAS' = 'BELUM BAYAR';
    if (totalAmount > 0 && newPaid >= totalAmount) {
      payStatus = 'LUNAS';
    } else if (newPaid > 0 && totalAmount === 0) {
      payStatus = 'LUNAS';
    } else if (newPaid > 0) {
      payStatus = 'DP';
    }

    db.prepare(`
      UPDATE orders
      SET invoice_number = ?, paid_amount = ?, payment_status = ?, updated_at = ?
      WHERE id = ?
    `).run(invNumber, newPaid, payStatus, ts, input.orderId);

    const remaining = Math.max(0, totalAmount - newPaid);
    db.prepare(`
      UPDATE invoices
      SET paid_amount = ?, remaining_amount = ?, payment_status = ?, updated_at = ?
      WHERE id = ?
    `).run(newPaid, remaining, payStatus, ts, invId);

    return {
      payment_id: paymentId,
      invoice_number: invNumber,
      total_amount: totalAmount,
      paid_amount: newPaid,
      remaining_amount: remaining,
      payment_status: payStatus,
    };
  });

  return runTx();
}

export function voidOrderPayment(db: Database.Database, paymentId: string) {
  const runTx = db.transaction(() => {
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as
      | { id: string; order_id: string }
      | undefined;
    if (!payment) {
      throw new Error('Transaksi pembayaran tidak ditemukan.');
    }

    db.prepare('UPDATE payments SET is_void = 1, updated_at = ? WHERE id = ?').run(
      nowIso(),
      paymentId
    );

    return recalculateOrderTotals(db, payment.order_id, false);
  });

  return runTx();
}

export function recordStockMovement(
  db: Database.Database,
  input: {
    itemId: string;
    movementType: 'MASUK' | 'KELUAR' | 'PENYESUAIAN';
    quantity: number;
    referenceNote?: string;
    orderId?: string | null;
    adminId: string;
  }
) {
  const runTx = db.transaction(() => {
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      throw new Error('Jumlah stok harus lebih besar dari 0.');
    }
    if (!['MASUK', 'KELUAR', 'PENYESUAIAN'].includes(input.movementType)) {
      throw new Error('Tipe pergerakan stok tidak valid.');
    }

    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(input.itemId) as
      | { id: string; stock: number; unit: string }
      | undefined;
    if (!item) {
      throw new Error('Barang inventaris tidak ditemukan.');
    }

    const prevStock = Number(item.stock) || 0;
    let newStock = prevStock;

    if (input.movementType === 'MASUK') {
      newStock = prevStock + input.quantity;
    } else if (input.movementType === 'KELUAR') {
      if (prevStock < input.quantity) {
        throw new Error(`Stok tidak mencukupi (Stok saat ini: ${prevStock} ${item.unit}).`);
      }
      newStock = prevStock - input.quantity;
    } else {
      newStock = input.quantity;
    }

    const ts = nowIso();
    db.prepare('UPDATE inventory_items SET stock = ?, updated_at = ? WHERE id = ?').run(
      newStock,
      ts,
      input.itemId
    );

    const movementId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO stock_movements (
        id, item_id, movement_type, quantity, previous_stock, new_stock, reference_note, order_id, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      movementId,
      input.itemId,
      input.movementType,
      input.quantity,
      prevStock,
      newStock,
      input.referenceNote?.trim() || '',
      input.orderId || null,
      input.adminId,
      ts
    );

    return {
      movement_id: movementId,
      item_id: input.itemId,
      previous_stock: prevStock,
      new_stock: newStock,
    };
  });

  return runTx();
}

// =============================================================================
// BACKUP & RESTORE DATABASE SQLITE
// =============================================================================

export async function createBackupSnapshot(): Promise<string> {
  const db = getDb();
  const tempPath = path.join(os.tmpdir(), `jawara_ac_backup_${Date.now()}.db`);
  await db.backup(tempPath);
  return tempPath;
}

export function restoreFromBackupBuffer(buffer: Buffer): void {
  if (!buffer || buffer.length < 100) {
    throw new Error('File backup tidak valid atau kosong.');
  }

  const magic = buffer.subarray(0, 16).toString('utf8');
  if (magic !== 'SQLite format 3\0') {
    throw new Error('File yang diunggah bukan file database SQLite (.db) yang valid.');
  }

  const tempPath = path.join(os.tmpdir(), `jawara_ac_restore_${Date.now()}.db`);
  fs.writeFileSync(tempPath, buffer);

  try {
    // Verify SQLite integrity & required schema before touching live DB
    const testDb = new Database(tempPath, { readonly: true });
    try {
      const check = testDb.pragma('integrity_check') as { integrity_check: string }[];
      if (!check.length || check[0].integrity_check !== 'ok') {
        throw new Error('Pemeriksaan integritas file backup SQLite gagal.');
      }

      const existingTables = new Set(
        (
          testDb
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .all() as { name: string }[]
        ).map((r) => r.name)
      );

      for (const reqTable of REQUIRED_TABLES) {
        if (!existingTables.has(reqTable)) {
          throw new Error(`File backup tidak sesuai struktur JAWARA AC (tabel "${reqTable}" tidak ditemukan).`);
        }
      }

      const activeAdmins = (
        testDb.prepare('SELECT COUNT(*) AS cnt FROM admins WHERE is_active = 1').get() as {
          cnt: number;
        }
      ).cnt;
      if (activeAdmins === 0) {
        throw new Error('File backup tidak memiliki akun Admin aktif sehingga tidak dapat dipulihkan.');
      }
    } finally {
      testDb.close();
    }

    // Close live DB, keep safety snapshot, replace DB file, and reopen
    const dbPath = getDbPath();
    closeDb();

    if (fs.existsSync(dbPath)) {
      const safetyBackup = path.join(getDataDir(), 'jawara_ac.pre-restore.bak');
      fs.copyFileSync(dbPath, safetyBackup);
    }

    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${dbPath}${suffix}`;
      if (fs.existsSync(sidecar)) {
        fs.unlinkSync(sidecar);
      }
    }

    fs.copyFileSync(tempPath, dbPath);
    initDb();
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}
