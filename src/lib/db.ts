import Dexie, { type Table } from 'dexie';
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
  PaymentStatus,
  Profile,
  StockMovement,
  StockMovementType,
  Technician,
} from '../types/database';

export interface AdminRecord extends Profile {
  password_hash: string;
}

export interface LocalSessionRecord {
  id: 'current';
  admin_id: string;
  logged_in_at: string;
}

export interface JawaraBackupPayload {
  format: 'jawara-ac-backup';
  version: 1;
  exported_at: string;
  tables: {
    admins: AdminRecord[];
    technicians: Technician[];
    customers: Customer[];
    orders: Order[];
    order_items: OrderItem[];
    invoices: Invoice[];
    payments: Payment[];
    expense_categories: ExpenseCategory[];
    expenses: Expense[];
    inventory_items: InventoryItem[];
    stock_movements: StockMovement[];
    order_status_history: OrderStatusHistory[];
    business_settings: BusinessSettings[];
  };
}

export const REQUIRED_BACKUP_TABLES = [
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
] as const;

class JawaraAcDatabase extends Dexie {
  admins!: Table<AdminRecord, string>;
  local_session!: Table<LocalSessionRecord, string>;
  technicians!: Table<Technician, string>;
  customers!: Table<Customer, string>;
  orders!: Table<Order, string>;
  order_items!: Table<OrderItem, string>;
  invoices!: Table<Invoice, string>;
  payments!: Table<Payment, string>;
  expense_categories!: Table<ExpenseCategory, string>;
  expenses!: Table<Expense, string>;
  inventory_items!: Table<InventoryItem, string>;
  stock_movements!: Table<StockMovement, string>;
  order_status_history!: Table<OrderStatusHistory, string>;
  business_settings!: Table<BusinessSettings, string>;

  constructor(name = 'JawaraAcDB') {
    super(name);
    this.version(1).stores({
      admins: 'id, &email',
      local_session: 'id',
      technicians: 'id, name, is_active',
      customers: 'id, name, whatsapp',
      orders:
        'id, &order_number, invoice_number, customer_id, technician_id, service_date, status, payment_status, is_archived, created_at',
      order_items: 'id, order_id, sort_order',
      invoices: 'id, &invoice_number, &order_id, issued_date',
      payments: 'id, order_id, invoice_id, payment_date, payment_method, is_void',
      expense_categories: 'id, &name',
      expenses: 'id, expense_date, category_name',
      inventory_items: 'id, &item_code, name',
      stock_movements: 'id, item_id, order_id, created_at',
      order_status_history: 'id, order_id, changed_at',
      business_settings: 'id',
    });
  }
}

export const db = new JawaraAcDatabase();

// =============================================================================
// UTILITIES (IDs, Dates, Crypto Password Hashing)
// =============================================================================

export function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// Pure JS SHA-256 fallback when crypto.subtle is unavailable (e.g. non-HTTPS LAN IP)
function sha256FallbackBytes(input: Uint8Array): Uint8Array {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLen = input.length * 8;
  const paddedLen = Math.ceil((input.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(input, 0);
  padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);

  const W = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  const digest = new Uint8Array(32);
  const outView = new DataView(digest.buffer);
  for (let i = 0; i < 8; i += 1) {
    outView.setUint32(i * 4, H[i], false);
  }
  return digest;
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function derivePbkdf2Hex(password: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const saltBuffer = new Uint8Array(salt).buffer;
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 10000,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

function deriveSha256IteratedHex(password: string, salt: Uint8Array): string {
  const enc = new TextEncoder();
  const pwdBytes = enc.encode(password);
  let block = new Uint8Array(salt.length + pwdBytes.length);
  block.set(salt, 0);
  block.set(pwdBytes, salt.length);
  for (let i = 0; i < 500; i += 1) {
    block = new Uint8Array(sha256FallbackBytes(block));
  }
  return bytesToHex(block);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(salt);
  } else {
    for (let i = 0; i < salt.length; i += 1) {
      salt[i] = Math.floor(Math.random() * 256);
    }
  }
  const saltHex = bytesToHex(salt);
  if (globalThis.crypto?.subtle) {
    const hashHex = await derivePbkdf2Hex(password, salt);
    return `pbkdf2$${saltHex}$${hashHex}`;
  }
  const hashHex = deriveSha256IteratedHex(password, salt);
  return `sha256$${saltHex}$${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3) return false;
  const [algo, saltHex, expectedHex] = parts;
  if (!saltHex || !expectedHex) return false;
  const salt = hexToBytes(saltHex);

  if (algo === 'pbkdf2' && globalThis.crypto?.subtle) {
    const actualHex = await derivePbkdf2Hex(password, salt);
    return constantTimeEqualHex(actualHex, expectedHex);
  }
  if (algo === 'sha256') {
    const actualHex = deriveSha256IteratedHex(password, salt);
    return constantTimeEqualHex(actualHex, expectedHex);
  }
  return false;
}

// =============================================================================
// DATABASE INITIALIZATION & DEFAULT METADATA SEEDING (NO DUMMY TRANSACTIONS)
// =============================================================================

let initPromise: Promise<void> | null = null;

const DEFAULT_EXPENSE_CATEGORIES: [string, string][] = [
  ['Pembelian sparepart', 'Freon, kapasitor, pipa, bracket, dan komponen AC'],
  ['Transportasi', 'BBM, parkir, tol, dan operasional kendaraan teknisi'],
  ['Operasional', 'Listrik, air, pulsa/kuota, ATK, dan kebutuhan kantor'],
  ['Gaji teknisi', 'Upah, komisi, dan insentif teknisi lapangan'],
  ['Peralatan', 'Pembelian atau servis mesin steam, manifold, vacuum pump'],
  ['Lain-lain', 'Pengeluaran operasional lainnya'],
];

async function seedDefaults(): Promise<void> {
  await db.open();
  await db.transaction('rw', db.expense_categories, db.business_settings, async () => {
    const ts = nowIso();
    const existingCats = await db.expense_categories.toArray();
    const catNames = new Set(existingCats.map((c) => c.name.trim().toLowerCase()));

    for (const [name, description] of DEFAULT_EXPENSE_CATEGORIES) {
      if (!catNames.has(name.toLowerCase())) {
        await db.expense_categories.add({
          id: generateId(),
          name,
          description,
          is_default: true,
          created_at: ts,
          updated_at: ts,
        });
      }
    }

    const bizCount = await db.business_settings.count();
    if (bizCount === 0) {
      await db.business_settings.add({
        id: generateId(),
        business_name: 'JAWARA AC',
        tagline: 'Service AC Lebih Mudah, Bisnis Lebih Maju',
        phone: '',
        whatsapp: '',
        email: '',
        address: '',
        bank_name: '',
        bank_account_number: '',
        bank_account_name: '',
        order_prefix: 'ORD-JWR',
        invoice_prefix: 'INV-JWR',
        invoice_footer_note:
          'Terima kasih telah mempercayakan perawatan AC Anda kepada JAWARA AC. Garansi servis berlaku sesuai ketentuan.',
        created_at: ts,
        updated_at: ts,
      });
    }
  });
}

export async function ensureDbReady(): Promise<void> {
  if (!initPromise) {
    initPromise = seedDefaults().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

function toPublicProfile(admin: AdminRecord): Profile {
  const { password_hash: _ignored, ...profile } = admin;
  return profile;
}

async function getCurrentAdminOrThrow(): Promise<AdminRecord> {
  await ensureDbReady();
  const session = await db.local_session.get('current');
  if (!session) {
    throw new Error('Sesi Admin tidak ditemukan. Silakan masuk kembali.');
  }
  const admin = await db.admins.get(session.admin_id);
  if (!admin || !admin.is_active) {
    await db.local_session.delete('current');
    throw new Error('Akun Admin tidak aktif atau tidak ditemukan.');
  }
  return admin;
}

// =============================================================================
// AUTHENTICATION (100% LOCAL INDEXEDDB)
// =============================================================================

export async function getAuthStatus(): Promise<{ needsSetup: boolean }> {
  await ensureDbReady();
  const count = await db.admins.count();
  return { needsSetup: count === 0 };
}

export async function setupFirstAdmin(payload: {
  email: string;
  password: string;
  full_name: string;
}): Promise<{ token: string; profile: Profile }> {
  await ensureDbReady();
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const fullName = String(payload.full_name || 'Admin JAWARA AC').trim() || 'Admin JAWARA AC';

  if (!email || !email.includes('@')) {
    throw new Error('Email Admin yang valid wajib diisi.');
  }
  if (password.length < 6) {
    throw new Error('Password Admin minimal 6 karakter.');
  }

  const passwordHash = await hashPassword(password);
  const ts = nowIso();

  const profile = await db.transaction('rw', db.admins, db.local_session, async () => {
    const existingCount = await db.admins.count();
    if (existingCount > 0) {
      throw new Error('Akun Admin sudah aktif. Silakan masuk menggunakan email dan password Anda.');
    }

    const adminRecord: AdminRecord = {
      id: generateId(),
      email,
      password_hash: passwordHash,
      full_name: fullName,
      phone: '',
      role: 'admin',
      is_active: true,
      created_at: ts,
      updated_at: ts,
    };

    await db.admins.add(adminRecord);
    await db.local_session.put({
      id: 'current',
      admin_id: adminRecord.id,
      logged_in_at: ts,
    });
    return toPublicProfile(adminRecord);
  });

  return { token: 'local-session', profile };
}

export async function loginAdmin(payload: {
  email: string;
  password: string;
}): Promise<{ token: string; profile: Profile }> {
  await ensureDbReady();
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');

  if (!email || !password) {
    throw new Error('Email dan password wajib diisi.');
  }

  const admin = await db.admins.where('email').equals(email).first();
  if (!admin || !(await verifyPassword(password, admin.password_hash))) {
    throw new Error('Email atau password Admin salah.');
  }
  if (!admin.is_active) {
    throw new Error('Akun Admin ini sedang dinonaktifkan.');
  }

  await db.local_session.put({
    id: 'current',
    admin_id: admin.id,
    logged_in_at: nowIso(),
  });

  return { token: 'local-session', profile: toPublicProfile(admin) };
}

export async function logoutAdmin(): Promise<{ ok: boolean }> {
  await ensureDbReady();
  await db.local_session.delete('current');
  return { ok: true };
}

export async function getMe(): Promise<{ profile: Profile }> {
  const admin = await getCurrentAdminOrThrow();
  return { profile: toPublicProfile(admin) };
}

export async function updateAdminProfile(payload: {
  email?: string;
  full_name: string;
  phone: string;
}): Promise<{ profile: Profile }> {
  const admin = await getCurrentAdminOrThrow();
  const fullName = String(payload.full_name || '').trim() || 'Admin JAWARA AC';
  const phone = String(payload.phone || '').trim();
  const nextEmail = payload.email !== undefined ? String(payload.email || '').trim().toLowerCase() : admin.email;
  if (!nextEmail || !nextEmail.includes('@')) {
    throw new Error('Email Admin yang valid wajib diisi.');
  }
  const dup = await db.admins.where('email').equals(nextEmail).first();
  if (dup && dup.id !== admin.id) {
    throw new Error('Email Admin sudah digunakan.');
  }
  const ts = nowIso();

  await db.admins.update(admin.id, {
    email: nextEmail,
    full_name: fullName,
    phone,
    updated_at: ts,
  });

  const updated = await db.admins.get(admin.id);
  if (!updated) throw new Error('Profil Admin tidak ditemukan.');
  return { profile: toPublicProfile(updated) };
}

export async function changeAdminPassword(password: string): Promise<{ ok: boolean }> {
  const admin = await getCurrentAdminOrThrow();
  const clean = String(password || '');
  if (clean.length < 6) {
    throw new Error('Password baru minimal 6 karakter.');
  }
  const hash = await hashPassword(clean);
  await db.admins.update(admin.id, {
    password_hash: hash,
    updated_at: nowIso(),
  });
  return { ok: true };
}

// =============================================================================
// UNIQUENESS & NUMBER GENERATION HELPERS
// =============================================================================

async function assertUniqueOrderNumber(orderNumber: string, excludeOrderId?: string): Promise<void> {
  const existing = await db.orders.where('order_number').equals(orderNumber).first();
  if (existing && existing.id !== excludeOrderId) {
    throw new Error('Nomor order sudah digunakan. Silakan buat nomor baru.');
  }
}

async function assertUniqueInvoiceNumber(
  invoiceNumber: string,
  excludeInvoiceId?: string,
  excludeOrderId?: string
): Promise<void> {
  const inv = await db.invoices.where('invoice_number').equals(invoiceNumber).first();
  if (inv && inv.id !== excludeInvoiceId && inv.order_id !== excludeOrderId) {
    throw new Error('Nomor invoice sudah digunakan. Gunakan nomor invoice lain yang unik.');
  }
  const ord = await db.orders.where('invoice_number').equals(invoiceNumber).first();
  if (ord && ord.id !== excludeOrderId) {
    throw new Error('Nomor invoice sudah digunakan pada order lain. Gunakan nomor invoice yang unik.');
  }
}

export async function generateNextOrderNumber(): Promise<string> {
  await ensureDbReady();
  const biz = (await db.business_settings.toArray())[0];
  const prefix = biz?.order_prefix?.trim() || 'ORD-JWR';
  const ym = yearMonthJakarta();
  const base = `${prefix}-${ym}-`;

  const allOrders = await db.orders.toArray();
  let maxSeq = 0;
  for (const r of allOrders) {
    if (r.order_number.startsWith(base)) {
      const tail = r.order_number.slice(base.length);
      if (/^\d+$/.test(tail)) {
        maxSeq = Math.max(maxSeq, Number(tail));
      }
    }
  }
  return `${base}${String(maxSeq + 1).padStart(4, '0')}`;
}

export async function generateNextInvoiceNumber(): Promise<string> {
  await ensureDbReady();
  const biz = (await db.business_settings.toArray())[0];
  const prefix = biz?.invoice_prefix?.trim() || 'INV-JWR';
  const ym = yearMonthJakarta();
  const base = `${prefix}-${ym}-`;

  const [invs, ords] = await Promise.all([db.invoices.toArray(), db.orders.toArray()]);
  let maxSeq = 0;
  for (const r of invs) {
    if (r.invoice_number.startsWith(base)) {
      const tail = r.invoice_number.slice(base.length);
      if (/^\d+$/.test(tail)) {
        maxSeq = Math.max(maxSeq, Number(tail));
      }
    }
  }
  for (const r of ords) {
    if (r.invoice_number && r.invoice_number.startsWith(base)) {
      const tail = r.invoice_number.slice(base.length);
      if (/^\d+$/.test(tail)) {
        maxSeq = Math.max(maxSeq, Number(tail));
      }
    }
  }
  return `${base}${String(maxSeq + 1).padStart(4, '0')}`;
}

async function generateNextInvoiceNumberInTx(): Promise<string> {
  const biz = (await db.business_settings.toArray())[0];
  const prefix = biz?.invoice_prefix?.trim() || 'INV-JWR';
  const ym = yearMonthJakarta();
  const base = `${prefix}-${ym}-`;

  const invs = await db.invoices.toArray();
  const ords = await db.orders.toArray();
  let maxSeq = 0;
  for (const r of invs) {
    if (r.invoice_number.startsWith(base)) {
      const tail = r.invoice_number.slice(base.length);
      if (/^\d+$/.test(tail)) maxSeq = Math.max(maxSeq, Number(tail));
    }
  }
  for (const r of ords) {
    if (r.invoice_number && r.invoice_number.startsWith(base)) {
      const tail = r.invoice_number.slice(base.length);
      if (/^\d+$/.test(tail)) maxSeq = Math.max(maxSeq, Number(tail));
    }
  }
  return `${base}${String(maxSeq + 1).padStart(4, '0')}`;
}

// =============================================================================
// BOOTSTRAP DATA
// =============================================================================

export async function getBootstrapData() {
  await getCurrentAdminOrThrow();

  const [
    orders,
    customers,
    technicians,
    payments,
    expenses,
    expenseCategories,
    inventoryItems,
    rawMovements,
    invoices,
    settingsList,
  ] = await Promise.all([
    db.orders.toArray(),
    db.customers.toArray(),
    db.technicians.toArray(),
    db.payments.toArray(),
    db.expenses.toArray(),
    db.expense_categories.toArray(),
    db.inventory_items.toArray(),
    db.stock_movements.toArray(),
    db.invoices.toArray(),
    db.business_settings.toArray(),
  ]);

  orders.sort((a, b) => b.created_at.localeCompare(a.created_at));
  customers.sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
  technicians.sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
  payments.sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  expenses.sort((a, b) => {
    const cmp = b.expense_date.localeCompare(a.expense_date);
    return cmp !== 0 ? cmp : b.created_at.localeCompare(a.created_at);
  });
  expenseCategories.sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
  inventoryItems.sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
  invoices.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const itemMap = new Map(inventoryItems.map((it) => [it.id, it]));
  rawMovements.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const stockMovements: StockMovement[] = rawMovements.slice(0, 200).map((m) => {
    const it = itemMap.get(m.item_id);
    return {
      ...m,
      inventory_items: it
        ? {
            name: it.name,
            item_code: it.item_code,
            unit: it.unit,
          }
        : null,
    };
  });

  return {
    orders,
    customers,
    technicians,
    payments,
    expenses,
    expenseCategories,
    inventoryItems,
    stockMovements,
    invoices,
    businessSettings: settingsList[0] || null,
  };
}

// =============================================================================
// RECALCULATION HELPER
// =============================================================================

async function recalculateOrderTotalsInTx(orderId: string, fromItems: boolean) {
  const order = await db.orders.get(orderId);
  if (!order) {
    throw new Error('Order tidak ditemukan.');
  }

  const items = await db.order_items.where('order_id').equals(orderId).toArray();
  const itemsSubtotal = items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);

  const labor = fromItems
    ? itemsSubtotal
    : items.length > 0
    ? itemsSubtotal
    : Number(order.labor_cost) || 0;

  const additional = Number(order.additional_cost) || 0;
  const material = Number(order.material_cost) || 0;
  const discount = Number(order.discount) || 0;
  const total = Math.max(0, labor + additional + material - discount);

  const orderPayments = await db.payments.where('order_id').equals(orderId).toArray();
  const paid = orderPayments
    .filter((p) => !p.is_void)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  let payStatus: PaymentStatus = 'BELUM BAYAR';
  if (total > 0 && paid >= total) {
    payStatus = 'LUNAS';
  } else if (paid > 0 && total === 0) {
    payStatus = 'LUNAS';
  } else if (paid > 0) {
    payStatus = 'DP';
  }

  const ts = nowIso();
  await db.orders.update(orderId, {
    labor_cost: labor,
    total_amount: total,
    paid_amount: paid,
    payment_status: payStatus,
    updated_at: ts,
  });

  const remaining = Math.max(0, total - paid);
  const existingInv = await db.invoices.where('order_id').equals(orderId).first();
  if (existingInv) {
    await db.invoices.update(existingInv.id, {
      customer_name: order.customer_name,
      customer_whatsapp: order.customer_whatsapp,
      customer_address: order.service_address,
      service_name: order.service_name,
      technician_name: order.technician_name,
      subtotal_amount: labor,
      additional_cost: additional,
      material_cost: material,
      discount,
      total_amount: total,
      paid_amount: paid,
      remaining_amount: remaining,
      payment_status: payStatus,
      updated_at: ts,
    });
  }

  return {
    order_id: orderId,
    labor_cost: labor,
    total_amount: total,
    paid_amount: paid,
    remaining_amount: remaining,
    payment_status: payStatus,
  };
}

// =============================================================================
// ORDERS & ORDER ITEMS
// =============================================================================

export async function getOrderDetails(orderId: string) {
  await getCurrentAdminOrThrow();
  const order = await db.orders.get(orderId);
  if (!order) {
    throw new Error('Order tidak ditemukan.');
  }

  const [items, payments, history, invoice] = await Promise.all([
    db.order_items.where('order_id').equals(orderId).toArray(),
    db.payments.where('order_id').equals(orderId).toArray(),
    db.order_status_history.where('order_id').equals(orderId).toArray(),
    db.invoices.where('order_id').equals(orderId).first(),
  ]);

  items.sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
  payments.sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  history.sort((a, b) => b.changed_at.localeCompare(a.changed_at));

  return {
    order,
    items,
    payments,
    history,
    invoice: invoice || null,
  };
}

export async function createOrder(body: Record<string, unknown>) {
  const admin = await getCurrentAdminOrThrow();
  const orderNumber = String(body.order_number || '').trim();
  const serviceName = String(body.service_name || '').trim();

  if (!orderNumber || !serviceName) {
    throw new Error('Nomor order dan nama pelayanan wajib diisi.');
  }

  return db.transaction(
    'rw',
    [db.orders, db.invoices, db.customers, db.technicians, db.order_status_history],
    async () => {
      await assertUniqueOrderNumber(orderNumber);

      const invoiceNumber = body.invoice_number ? String(body.invoice_number).trim() : null;
      if (invoiceNumber) {
        await assertUniqueInvoiceNumber(invoiceNumber);
      }

      const ts = nowIso();
      let customerId = String(body.customer_id || '').trim();
      let customerName = String(body.customer_name || '').trim();
      let customerWhatsapp = String(body.customer_whatsapp || '').trim();
      let serviceAddress = String(body.service_address || '').trim();
      let newCustomer: Customer | undefined;

      if (body.new_customer && typeof body.new_customer === 'object') {
        const nc = body.new_customer as Record<string, unknown>;
        const ncName = String(nc.name || '').trim();
        const ncWa = String(nc.whatsapp || '').trim();
        if (!ncName || !ncWa) {
          throw new Error('Nama pelanggan baru dan nomor WhatsApp wajib diisi.');
        }
        const ncAddr = String(nc.address || '').trim();
        const ncEmail = String(nc.email || '').trim();
        customerId = generateId();
        newCustomer = {
          id: customerId,
          name: ncName,
          whatsapp: ncWa,
          address: ncAddr,
          email: ncEmail,
          notes: '',
          created_at: ts,
          updated_at: ts,
        };
        await db.customers.add(newCustomer);

        customerName = ncName;
        if (!customerWhatsapp) customerWhatsapp = ncWa;
        if (!serviceAddress) serviceAddress = ncAddr;
      } else {
        const cust = await db.customers.get(customerId);
        if (!cust) {
          throw new Error('Pelanggan tidak ditemukan.');
        }
        customerName = cust.name;
      }

      const techId = body.technician_id ? String(body.technician_id).trim() : null;
      let techName = '';
      if (techId) {
        const tech = await db.technicians.get(techId);
        if (tech) techName = tech.name;
      }

      const labor = Math.max(0, Number(body.labor_cost) || 0);
      const additional = Math.max(0, Number(body.additional_cost) || 0);
      const material = Math.max(0, Number(body.material_cost) || 0);
      const discount = Math.max(0, Number(body.discount) || 0);
      const total = Math.max(0, labor + additional + material - discount);
      const status = (String(body.status || 'Baru') as OrderStatus) || 'Baru';

      const order: Order = {
        id: generateId(),
        order_number: orderNumber,
        invoice_number: invoiceNumber,
        customer_id: customerId,
        customer_name: customerName,
        customer_whatsapp: customerWhatsapp,
        service_address: serviceAddress,
        service_name: serviceName,
        service_date: String(body.service_date || todayJakarta()),
        service_time: body.service_time ? String(body.service_time) : null,
        technician_id: techId,
        technician_name: techName,
        complaint: String(body.complaint || '').trim(),
        labor_cost: labor,
        additional_cost: additional,
        material_cost: material,
        discount,
        total_amount: total,
        paid_amount: 0,
        payment_status: 'BELUM BAYAR',
        status,
        internal_notes: String(body.internal_notes || '').trim(),
        is_archived: false,
        created_at: ts,
        updated_at: ts,
      };

      await db.orders.add(order);
      await db.order_status_history.add({
        id: generateId(),
        order_id: order.id,
        previous_status: '',
        new_status: status,
        notes: 'Order baru dibuat',
        changed_by: admin.id,
        changed_at: ts,
      });

      return { order, newCustomer };
    }
  );
}

export async function updateOrder(orderId: string, body: Record<string, unknown>) {
  const admin = await getCurrentAdminOrThrow();

  const updatedOrder = await db.transaction(
    'rw',
    [db.orders, db.order_items, db.invoices, db.payments, db.customers, db.technicians, db.order_status_history],
    async () => {
      const existing = await db.orders.get(orderId);
      if (!existing) {
        throw new Error('Order tidak ditemukan.');
      }

      const nextOrderNumber = String(body.order_number || existing.order_number).trim();
      if (!nextOrderNumber) {
        throw new Error('Nomor order wajib diisi.');
      }
      await assertUniqueOrderNumber(nextOrderNumber, orderId);

      const invoiceNumber = body.invoice_number ? String(body.invoice_number).trim() : null;
      if (invoiceNumber) {
        const existingInv = await db.invoices.where('order_id').equals(orderId).first();
        await assertUniqueInvoiceNumber(invoiceNumber, existingInv?.id, orderId);
      }

      const customerId = String(body.customer_id || existing.customer_id);
      const cust = await db.customers.get(customerId);
      if (!cust) {
        throw new Error('Pelanggan tidak ditemukan.');
      }

      const techId = body.technician_id ? String(body.technician_id).trim() : null;
      let techName = '';
      if (techId) {
        const tech = await db.technicians.get(techId);
        if (tech) techName = tech.name;
      }

      const labor = Math.max(0, Number(body.labor_cost) || 0);
      const additional = Math.max(0, Number(body.additional_cost) || 0);
      const material = Math.max(0, Number(body.material_cost) || 0);
      const discount = Math.max(0, Number(body.discount) || 0);
      const nextStatus = (String(body.status || existing.status) as OrderStatus) || existing.status;
      const ts = nowIso();

      await db.orders.update(orderId, {
        order_number: nextOrderNumber,
        invoice_number: invoiceNumber,
        customer_id: customerId,
        customer_name: cust.name,
        customer_whatsapp: String(body.customer_whatsapp ?? existing.customer_whatsapp).trim(),
        service_address: String(body.service_address ?? existing.service_address).trim(),
        service_name: String(body.service_name || existing.service_name).trim(),
        service_date: String(body.service_date || existing.service_date),
        service_time: body.service_time ? String(body.service_time) : null,
        technician_id: techId,
        technician_name: techName,
        complaint: String(body.complaint ?? existing.complaint).trim(),
        labor_cost: labor,
        additional_cost: additional,
        material_cost: material,
        discount,
        status: nextStatus,
        internal_notes: String(body.internal_notes ?? existing.internal_notes).trim(),
        updated_at: ts,
      });

      if (invoiceNumber) {
        const inv = await db.invoices.where('order_id').equals(orderId).first();
        if (inv) {
          await db.invoices.update(inv.id, { invoice_number: invoiceNumber, updated_at: ts });
        }
        const linkedPayments = await db.payments.where('order_id').equals(orderId).toArray();
        for (const p of linkedPayments) {
          await db.payments.update(p.id, { invoice_number: invoiceNumber, updated_at: ts });
        }
      }

      if (existing.status !== nextStatus) {
        await db.order_status_history.add({
          id: generateId(),
          order_id: orderId,
          previous_status: existing.status,
          new_status: nextStatus,
          notes: 'Diubah melalui form edit order',
          changed_by: admin.id,
          changed_at: ts,
        });
      }

      await recalculateOrderTotalsInTx(orderId, false);
      const fresh = await db.orders.get(orderId);
      if (!fresh) throw new Error('Order tidak ditemukan.');
      return fresh;
    }
  );

  return { order: updatedOrder };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, notes: string) {
  const admin = await getCurrentAdminOrThrow();
  const order = await db.transaction('rw', db.orders, db.order_status_history, async () => {
    const existing = await db.orders.get(orderId);
    if (!existing) {
      throw new Error('Order tidak ditemukan.');
    }
    const ts = nowIso();
    await db.orders.update(orderId, {
      status,
      updated_at: ts,
    });
    await db.order_status_history.add({
      id: generateId(),
      order_id: orderId,
      previous_status: existing.status,
      new_status: status,
      notes: notes.trim() || `Status diubah ke ${status}`,
      changed_by: admin.id,
      changed_at: ts,
    });
    const fresh = await db.orders.get(orderId);
    if (!fresh) throw new Error('Order tidak ditemukan.');
    return fresh;
  });

  return { order };
}

export async function toggleArchiveOrder(orderId: string, is_archived: boolean) {
  await getCurrentAdminOrThrow();
  const existing = await db.orders.get(orderId);
  if (!existing) {
    throw new Error('Order tidak ditemukan.');
  }
  await db.orders.update(orderId, {
    is_archived: Boolean(is_archived),
    updated_at: nowIso(),
  });
  const fresh = await db.orders.get(orderId);
  if (!fresh) throw new Error('Order tidak ditemukan.');
  return { order: fresh };
}

export async function deleteOrder(orderId: string) {
  await getCurrentAdminOrThrow();
  await db.transaction(
    'rw',
    [db.orders, db.order_items, db.invoices, db.payments, db.order_status_history, db.stock_movements],
    async () => {
      const existing = await db.orders.get(orderId);
      if (!existing) {
        throw new Error('Order tidak ditemukan.');
      }
      await db.order_items.where('order_id').equals(orderId).delete();
      await db.payments.where('order_id').equals(orderId).delete();
      await db.invoices.where('order_id').equals(orderId).delete();
      await db.order_status_history.where('order_id').equals(orderId).delete();

      const linkedMovements = await db.stock_movements.where('order_id').equals(orderId).toArray();
      for (const mv of linkedMovements) {
        await db.stock_movements.update(mv.id, { order_id: null });
      }
      await db.orders.delete(orderId);
    }
  );
  return { ok: true };
}

export async function addOrderItem(
  orderId: string,
  payload: {
    work_name: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    sort_order: number;
  }
) {
  await getCurrentAdminOrThrow();
  const workName = String(payload.work_name || '').trim();
  const description = String(payload.description || '').trim();
  const quantity = Number(payload.quantity);
  const unit = String(payload.unit || 'Unit').trim() || 'Unit';
  const unitPrice = Number(payload.unit_price);
  const sortOrder = Number(payload.sort_order || 1);

  if (
    !workName ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(unitPrice) ||
    unitPrice < 0
  ) {
    throw new Error('Nama pekerjaan, jumlah (> 0), dan harga satuan wajib valid.');
  }

  const itemId = generateId();
  const ts = nowIso();
  const subtotal = quantity * unitPrice;

  await db.transaction('rw', [db.orders, db.order_items, db.invoices, db.payments], async () => {
    const order = await db.orders.get(orderId);
    if (!order) throw new Error('Order tidak ditemukan.');

    await db.order_items.add({
      id: itemId,
      order_id: orderId,
      work_name: workName,
      description,
      quantity,
      unit,
      unit_price: unitPrice,
      subtotal,
      sort_order: sortOrder,
      created_at: ts,
      updated_at: ts,
    });
    await recalculateOrderTotalsInTx(orderId, true);
  });

  return { id: itemId };
}

export async function updateOrderItem(
  itemId: string,
  payload: {
    work_name: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
  }
) {
  await getCurrentAdminOrThrow();
  const workName = String(payload.work_name || '').trim();
  const description = String(payload.description || '').trim();
  const quantity = Number(payload.quantity);
  const unit = String(payload.unit || 'Unit').trim() || 'Unit';
  const unitPrice = Number(payload.unit_price);

  if (
    !workName ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(unitPrice) ||
    unitPrice < 0
  ) {
    throw new Error('Data item pekerjaan tidak valid.');
  }

  await db.transaction('rw', [db.orders, db.order_items, db.invoices, db.payments], async () => {
    const existing = await db.order_items.get(itemId);
    if (!existing) throw new Error('Item pekerjaan tidak ditemukan.');

    await db.order_items.update(itemId, {
      work_name: workName,
      description,
      quantity,
      unit,
      unit_price: unitPrice,
      subtotal: quantity * unitPrice,
      updated_at: nowIso(),
    });
    await recalculateOrderTotalsInTx(existing.order_id, true);
  });

  return { ok: true };
}

export async function deleteOrderItem(itemId: string) {
  await getCurrentAdminOrThrow();
  await db.transaction('rw', [db.orders, db.order_items, db.invoices, db.payments], async () => {
    const existing = await db.order_items.get(itemId);
    if (!existing) throw new Error('Item pekerjaan tidak ditemukan.');
    await db.order_items.delete(itemId);
    await recalculateOrderTotalsInTx(existing.order_id, true);
  });
  return { ok: true };
}

// =============================================================================
// PAYMENTS
// =============================================================================

export async function recordPayment(payload: {
  order_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  notes: string;
  invoice_number?: string | null;
}) {
  const admin = await getCurrentAdminOrThrow();
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal pembayaran harus lebih besar dari 0.');
  }
  if (payload.payment_method !== 'CASH' && payload.payment_method !== 'TRANSFER') {
    throw new Error('Metode pembayaran harus CASH atau TRANSFER.');
  }

  return db.transaction(
    'rw',
    [db.orders, db.invoices, db.payments, db.business_settings],
    async () => {
      const order = await db.orders.get(payload.order_id);
      if (!order) {
        throw new Error('Order tidak ditemukan.');
      }

      const ts = nowIso();
      const existingInvoice = await db.invoices.where('order_id').equals(order.id).first();
      let invId = existingInvoice?.id || null;
      const invNumber =
        existingInvoice?.invoice_number ||
        (order.invoice_number ? order.invoice_number.trim() : '') ||
        (payload.invoice_number ? payload.invoice_number.trim() : '') ||
        (await generateNextInvoiceNumberInTx());

      if (!invId) {
        await assertUniqueInvoiceNumber(invNumber, undefined, order.id);
        invId = generateId();
        const total = Number(order.total_amount) || 0;
        const paid = Number(order.paid_amount) || 0;
        await db.invoices.add({
          id: invId,
          invoice_number: invNumber,
          order_id: order.id,
          issued_date: todayJakarta(),
          due_date: null,
          customer_name: order.customer_name,
          customer_whatsapp: order.customer_whatsapp,
          customer_address: order.service_address,
          service_name: order.service_name,
          technician_name: order.technician_name,
          subtotal_amount: order.labor_cost,
          additional_cost: order.additional_cost,
          material_cost: order.material_cost,
          discount: order.discount,
          total_amount: total,
          paid_amount: paid,
          remaining_amount: Math.max(0, total - paid),
          payment_status: order.payment_status,
          notes: '',
          created_at: ts,
          updated_at: ts,
        });
      }

      const paymentId = generateId();
      await db.payments.add({
        id: paymentId,
        order_id: order.id,
        invoice_id: invId,
        order_number: order.order_number,
        invoice_number: invNumber,
        customer_name: order.customer_name,
        amount,
        payment_method: payload.payment_method,
        payment_date: payload.payment_date || ts,
        notes: payload.notes?.trim() || '',
        is_void: false,
        created_by: admin.id,
        created_at: ts,
        updated_at: ts,
      });

      const allOrderPayments = await db.payments.where('order_id').equals(order.id).toArray();
      const newPaid = allOrderPayments
        .filter((p) => !p.is_void)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalAmount = Number(order.total_amount) || 0;

      let payStatus: PaymentStatus = 'BELUM BAYAR';
      if (totalAmount > 0 && newPaid >= totalAmount) {
        payStatus = 'LUNAS';
      } else if (newPaid > 0 && totalAmount === 0) {
        payStatus = 'LUNAS';
      } else if (newPaid > 0) {
        payStatus = 'DP';
      }

      const remaining = Math.max(0, totalAmount - newPaid);

      await db.orders.update(order.id, {
        invoice_number: invNumber,
        paid_amount: newPaid,
        payment_status: payStatus,
        updated_at: ts,
      });

      await db.invoices.update(invId, {
        paid_amount: newPaid,
        remaining_amount: remaining,
        payment_status: payStatus,
        updated_at: ts,
      });

      return {
        payment_id: paymentId,
        invoice_number: invNumber,
        total_amount: totalAmount,
        paid_amount: newPaid,
        remaining_amount: remaining,
        payment_status: payStatus,
      };
    }
  );
}

export async function voidPayment(paymentId: string) {
  await getCurrentAdminOrThrow();
  return db.transaction('rw', [db.orders, db.order_items, db.invoices, db.payments], async () => {
    const payment = await db.payments.get(paymentId);
    if (!payment) {
      throw new Error('Transaksi pembayaran tidak ditemukan.');
    }
    await db.payments.update(paymentId, {
      is_void: true,
      updated_at: nowIso(),
    });
    return recalculateOrderTotalsInTx(payment.order_id, false);
  });
}

// =============================================================================
// INVOICES
// =============================================================================

export async function upsertInvoice(payload: { order_id: string; invoice_number?: string }) {
  await getCurrentAdminOrThrow();
  const invoice = await db.transaction(
    'rw',
    [db.orders, db.invoices, db.payments, db.business_settings],
    async () => {
      const order = await db.orders.get(payload.order_id);
      if (!order) {
        throw new Error('Order tidak ditemukan.');
      }

      const ts = nowIso();
      const existing = await db.invoices.where('order_id').equals(order.id).first();
      const requestedNo = String(payload.invoice_number || '').trim();
      const invNo =
        requestedNo ||
        (order.invoice_number ? order.invoice_number.trim() : '') ||
        existing?.invoice_number ||
        (await generateNextInvoiceNumberInTx());

      await assertUniqueInvoiceNumber(invNo, existing?.id, order.id);

      const total = Number(order.total_amount) || 0;
      const paid = Number(order.paid_amount) || 0;
      const remaining = Math.max(0, total - paid);

      if (existing) {
        await db.invoices.update(existing.id, {
          invoice_number: invNo,
          issued_date: todayJakarta(),
          customer_name: order.customer_name,
          customer_whatsapp: order.customer_whatsapp,
          customer_address: order.service_address,
          service_name: order.service_name,
          technician_name: order.technician_name,
          subtotal_amount: order.labor_cost,
          additional_cost: order.additional_cost,
          material_cost: order.material_cost,
          discount: order.discount,
          total_amount: total,
          paid_amount: paid,
          remaining_amount: remaining,
          payment_status: order.payment_status,
          updated_at: ts,
        });
      } else {
        await db.invoices.add({
          id: generateId(),
          invoice_number: invNo,
          order_id: order.id,
          issued_date: todayJakarta(),
          due_date: null,
          customer_name: order.customer_name,
          customer_whatsapp: order.customer_whatsapp,
          customer_address: order.service_address,
          service_name: order.service_name,
          technician_name: order.technician_name,
          subtotal_amount: order.labor_cost,
          additional_cost: order.additional_cost,
          material_cost: order.material_cost,
          discount: order.discount,
          total_amount: total,
          paid_amount: paid,
          remaining_amount: remaining,
          payment_status: order.payment_status,
          notes: '',
          created_at: ts,
          updated_at: ts,
        });
      }

      await db.orders.update(order.id, {
        invoice_number: invNo,
        updated_at: ts,
      });

      const linkedPayments = await db.payments.where('order_id').equals(order.id).toArray();
      for (const p of linkedPayments) {
        await db.payments.update(p.id, {
          invoice_number: invNo,
          updated_at: ts,
        });
      }

      const fresh = await db.invoices.where('order_id').equals(order.id).first();
      if (!fresh) throw new Error('Gagal menyimpan invoice.');
      return fresh;
    }
  );

  return { invoice };
}

export async function updateInvoiceNumber(invoiceId: string, invoice_number: string) {
  await getCurrentAdminOrThrow();
  const newNumber = String(invoice_number || '').trim();
  if (!newNumber) {
    throw new Error('Nomor invoice tidak boleh kosong.');
  }

  const invoice = await db.transaction('rw', [db.invoices, db.orders, db.payments], async () => {
    const existing = await db.invoices.get(invoiceId);
    if (!existing) {
      throw new Error('Invoice tidak ditemukan.');
    }
    await assertUniqueInvoiceNumber(newNumber, invoiceId, existing.order_id);

    const ts = nowIso();
    await db.invoices.update(invoiceId, { invoice_number: newNumber, updated_at: ts });
    await db.orders.update(existing.order_id, { invoice_number: newNumber, updated_at: ts });
    const linkedPayments = await db.payments.where('invoice_id').equals(invoiceId).toArray();
    for (const p of linkedPayments) {
      await db.payments.update(p.id, { invoice_number: newNumber, updated_at: ts });
    }
    const fresh = await db.invoices.get(invoiceId);
    if (!fresh) throw new Error('Invoice tidak ditemukan.');
    return fresh;
  });

  return { invoice };
}

// =============================================================================
// TECHNICIANS
// =============================================================================

export async function createTechnician(
  payload: Omit<Technician, 'id' | 'created_at' | 'updated_at'>
) {
  await getCurrentAdminOrThrow();
  const name = String(payload.name || '').trim();
  const whatsapp = String(payload.whatsapp || '').trim();
  if (!name || !whatsapp) {
    throw new Error('Nama teknisi dan nomor WhatsApp wajib diisi.');
  }
  const ts = nowIso();
  const technician: Technician = {
    id: generateId(),
    name,
    whatsapp,
    address: String(payload.address || '').trim(),
    specialty: String(payload.specialty || '').trim(),
    notes: String(payload.notes || '').trim(),
    is_active: payload.is_active !== false,
    created_at: ts,
    updated_at: ts,
  };
  await db.technicians.add(technician);
  return { technician };
}

export async function updateTechnician(
  id: string,
  payload: Omit<Technician, 'id' | 'created_at' | 'updated_at'>
) {
  await getCurrentAdminOrThrow();
  const name = String(payload.name || '').trim();
  const whatsapp = String(payload.whatsapp || '').trim();
  if (!name || !whatsapp) {
    throw new Error('Nama teknisi dan nomor WhatsApp wajib diisi.');
  }
  const existing = await db.technicians.get(id);
  if (!existing) {
    throw new Error('Teknisi tidak ditemukan.');
  }
  await db.technicians.update(id, {
    name,
    whatsapp,
    address: String(payload.address || '').trim(),
    specialty: String(payload.specialty || '').trim(),
    notes: String(payload.notes || '').trim(),
    is_active: payload.is_active !== false,
    updated_at: nowIso(),
  });
  const technician = await db.technicians.get(id);
  if (!technician) throw new Error('Teknisi tidak ditemukan.');
  return { technician };
}

export async function toggleTechnician(id: string, is_active: boolean) {
  await getCurrentAdminOrThrow();
  const existing = await db.technicians.get(id);
  if (!existing) {
    throw new Error('Teknisi tidak ditemukan.');
  }
  await db.technicians.update(id, {
    is_active: Boolean(is_active),
    updated_at: nowIso(),
  });
  const technician = await db.technicians.get(id);
  if (!technician) throw new Error('Teknisi tidak ditemukan.');
  return { technician };
}

export async function deleteTechnician(id: string) {
  await getCurrentAdminOrThrow();
  await db.transaction('rw', [db.technicians, db.orders], async () => {
    const existing = await db.technicians.get(id);
    if (!existing) {
      throw new Error('Teknisi tidak ditemukan.');
    }
    const linkedOrders = await db.orders.where('technician_id').equals(id).toArray();
    for (const o of linkedOrders) {
      await db.orders.update(o.id, { technician_id: null });
    }
    await db.technicians.delete(id);
  });
  return { ok: true };
}

// =============================================================================
// CUSTOMERS
// =============================================================================

export async function createCustomer(
  payload: Omit<Customer, 'id' | 'created_at' | 'updated_at'>
) {
  await getCurrentAdminOrThrow();
  const name = String(payload.name || '').trim();
  const whatsapp = String(payload.whatsapp || '').trim();
  if (!name || !whatsapp) {
    throw new Error('Nama pelanggan dan nomor WhatsApp wajib diisi.');
  }
  const ts = nowIso();
  const customer: Customer = {
    id: generateId(),
    name,
    whatsapp,
    address: String(payload.address || '').trim(),
    email: String(payload.email || '').trim(),
    notes: String(payload.notes || '').trim(),
    created_at: ts,
    updated_at: ts,
  };
  await db.customers.add(customer);
  return { customer };
}

export async function updateCustomer(
  id: string,
  payload: Omit<Customer, 'id' | 'created_at' | 'updated_at'>
) {
  await getCurrentAdminOrThrow();
  const name = String(payload.name || '').trim();
  const whatsapp = String(payload.whatsapp || '').trim();
  if (!name || !whatsapp) {
    throw new Error('Nama pelanggan dan nomor WhatsApp wajib diisi.');
  }
  const existing = await db.customers.get(id);
  if (!existing) {
    throw new Error('Pelanggan tidak ditemukan.');
  }
  await db.customers.update(id, {
    name,
    whatsapp,
    address: String(payload.address || '').trim(),
    email: String(payload.email || '').trim(),
    notes: String(payload.notes || '').trim(),
    updated_at: nowIso(),
  });
  const customer = await db.customers.get(id);
  if (!customer) throw new Error('Pelanggan tidak ditemukan.');
  return { customer };
}

export async function deleteCustomer(id: string) {
  await getCurrentAdminOrThrow();
  const existing = await db.customers.get(id);
  if (!existing) {
    throw new Error('Pelanggan tidak ditemukan.');
  }
  const orderCount = await db.orders.where('customer_id').equals(id).count();
  if (orderCount > 0) {
    throw new Error(
      `Pelanggan tidak dapat dihapus karena memiliki ${orderCount} transaksi order terkait.`
    );
  }
  await db.customers.delete(id);
  return { ok: true };
}

// =============================================================================
// EXPENSES
// =============================================================================

export async function createExpense(payload: {
  expense_date: string;
  title: string;
  category_name: string;
  amount: number;
  payment_method: PaymentMethod;
  notes: string;
}) {
  const admin = await getCurrentAdminOrThrow();
  const title = String(payload.title || '').trim();
  const categoryName = String(payload.category_name || '').trim();
  const amount = Number(payload.amount);
  const paymentMethod = payload.payment_method;

  if (!title || !categoryName || !Number.isFinite(amount) || amount < 0) {
    throw new Error('Judul, kategori, dan nominal pengeluaran wajib diisi dengan benar.');
  }
  if (paymentMethod !== 'CASH' && paymentMethod !== 'TRANSFER') {
    throw new Error('Metode pembayaran harus CASH atau TRANSFER.');
  }

  const cat = await db.expense_categories.where('name').equals(categoryName).first();
  const ts = nowIso();
  const expense: Expense = {
    id: generateId(),
    expense_date: String(payload.expense_date || todayJakarta()),
    title,
    category_id: cat?.id || null,
    category_name: categoryName,
    amount,
    payment_method: paymentMethod,
    notes: String(payload.notes || '').trim(),
    created_by: admin.id,
    created_at: ts,
    updated_at: ts,
  };
  await db.expenses.add(expense);
  return { expense };
}

export async function updateExpense(
  id: string,
  payload: {
    expense_date: string;
    title: string;
    category_name: string;
    amount: number;
    payment_method: PaymentMethod;
    notes: string;
  }
) {
  await getCurrentAdminOrThrow();
  const existing = await db.expenses.get(id);
  if (!existing) {
    throw new Error('Pengeluaran tidak ditemukan.');
  }
  const title = String(payload.title || '').trim();
  const categoryName = String(payload.category_name || '').trim();
  const amount = Number(payload.amount);
  const paymentMethod = payload.payment_method;

  if (!title || !categoryName || !Number.isFinite(amount) || amount < 0) {
    throw new Error('Judul, kategori, dan nominal pengeluaran wajib diisi dengan benar.');
  }
  if (paymentMethod !== 'CASH' && paymentMethod !== 'TRANSFER') {
    throw new Error('Metode pembayaran harus CASH atau TRANSFER.');
  }

  const cat = await db.expense_categories.where('name').equals(categoryName).first();
  await db.expenses.update(id, {
    expense_date: String(payload.expense_date || todayJakarta()),
    title,
    category_id: cat?.id || null,
    category_name: categoryName,
    amount,
    payment_method: paymentMethod,
    notes: String(payload.notes || '').trim(),
    updated_at: nowIso(),
  });
  const expense = await db.expenses.get(id);
  if (!expense) throw new Error('Pengeluaran tidak ditemukan.');
  return { expense };
}

export async function deleteExpense(id: string) {
  await getCurrentAdminOrThrow();
  const existing = await db.expenses.get(id);
  if (!existing) {
    throw new Error('Pengeluaran tidak ditemukan.');
  }
  await db.expenses.delete(id);
  return { ok: true };
}

// =============================================================================
// INVENTORY & STOCK MOVEMENTS
// =============================================================================

export async function createInventoryItem(payload: {
  item_code: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  min_stock: number;
  buy_price: number;
  sell_price: number;
}) {
  await getCurrentAdminOrThrow();
  const itemCode = String(payload.item_code || '').trim().toUpperCase();
  const name = String(payload.name || '').trim();
  if (!itemCode || !name) {
    throw new Error('Kode barang dan nama barang wajib diisi.');
  }

  const dup = await db.inventory_items.where('item_code').equals(itemCode).first();
  if (dup) {
    throw new Error('Kode barang sudah terdaftar. Gunakan kode unik.');
  }

  const ts = nowIso();
  const item: InventoryItem = {
    id: generateId(),
    item_code: itemCode,
    name,
    category: String(payload.category || 'Sparepart').trim() || 'Sparepart',
    unit: String(payload.unit || 'Pcs').trim() || 'Pcs',
    stock: Math.max(0, Number(payload.stock) || 0),
    min_stock: Math.max(0, Number(payload.min_stock) || 0),
    buy_price: Math.max(0, Number(payload.buy_price) || 0),
    sell_price: Math.max(0, Number(payload.sell_price) || 0),
    is_active: true,
    created_at: ts,
    updated_at: ts,
  };
  await db.inventory_items.add(item);
  return { item };
}

export async function updateInventoryItem(
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
) {
  await getCurrentAdminOrThrow();
  const existing = await db.inventory_items.get(id);
  if (!existing) {
    throw new Error('Barang inventaris tidak ditemukan.');
  }
  const itemCode = String(payload.item_code || '').trim().toUpperCase();
  const name = String(payload.name || '').trim();
  if (!itemCode || !name) {
    throw new Error('Kode barang dan nama barang wajib diisi.');
  }
  const dup = await db.inventory_items.where('item_code').equals(itemCode).first();
  if (dup && dup.id !== id) {
    throw new Error('Kode barang sudah terdaftar. Gunakan kode unik.');
  }

  await db.inventory_items.update(id, {
    item_code: itemCode,
    name,
    category: String(payload.category || 'Sparepart').trim() || 'Sparepart',
    unit: String(payload.unit || 'Pcs').trim() || 'Pcs',
    min_stock: Math.max(0, Number(payload.min_stock) || 0),
    buy_price: Math.max(0, Number(payload.buy_price) || 0),
    sell_price: Math.max(0, Number(payload.sell_price) || 0),
    updated_at: nowIso(),
  });
  const item = await db.inventory_items.get(id);
  if (!item) throw new Error('Barang inventaris tidak ditemukan.');
  return { item };
}

export async function deleteInventoryItem(id: string) {
  await getCurrentAdminOrThrow();
  await db.transaction('rw', [db.inventory_items, db.stock_movements], async () => {
    const existing = await db.inventory_items.get(id);
    if (!existing) {
      throw new Error('Barang inventaris tidak ditemukan.');
    }
    await db.stock_movements.where('item_id').equals(id).delete();
    await db.inventory_items.delete(id);
  });
  return { ok: true };
}

export async function recordStockMovement(
  itemId: string,
  payload: {
    movement_type: StockMovementType;
    quantity: number;
    reference_note: string;
    order_id?: string | null;
  }
) {
  const admin = await getCurrentAdminOrThrow();
  const quantity = Number(payload.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Jumlah stok harus lebih besar dari 0.');
  }
  if (!['MASUK', 'KELUAR', 'PENYESUAIAN'].includes(payload.movement_type)) {
    throw new Error('Tipe pergerakan stok tidak valid.');
  }

  return db.transaction('rw', [db.inventory_items, db.stock_movements], async () => {
    const item = await db.inventory_items.get(itemId);
    if (!item) {
      throw new Error('Barang inventaris tidak ditemukan.');
    }

    const prevStock = Number(item.stock) || 0;
    let newStock = prevStock;
    if (payload.movement_type === 'MASUK') {
      newStock = prevStock + quantity;
    } else if (payload.movement_type === 'KELUAR') {
      if (prevStock < quantity) {
        throw new Error(`Stok tidak mencukupi (Stok saat ini: ${prevStock} ${item.unit}).`);
      }
      newStock = prevStock - quantity;
    } else {
      newStock = quantity;
    }

    const ts = nowIso();
    await db.inventory_items.update(itemId, {
      stock: newStock,
      updated_at: ts,
    });

    const movementId = generateId();
    await db.stock_movements.add({
      id: movementId,
      item_id: itemId,
      movement_type: payload.movement_type,
      quantity,
      previous_stock: prevStock,
      new_stock: newStock,
      reference_note: String(payload.reference_note || '').trim(),
      order_id: payload.order_id || null,
      created_by: admin.id,
      created_at: ts,
    });

    return {
      movement_id: movementId,
      item_id: itemId,
      previous_stock: prevStock,
      new_stock: newStock,
    };
  });
}

// =============================================================================
// BUSINESS SETTINGS
// =============================================================================

export async function updateBusinessSettings(payload: Partial<BusinessSettings>) {
  await getCurrentAdminOrThrow();
  const ts = nowIso();
  const existingList = await db.business_settings.toArray();
  const existing = existingList[0];

  const data = {
    business_name: String(payload.business_name || 'JAWARA AC').trim() || 'JAWARA AC',
    tagline:
      String(payload.tagline || 'Service AC Lebih Mudah, Bisnis Lebih Maju').trim() ||
      'Service AC Lebih Mudah, Bisnis Lebih Maju',
    phone: String(payload.phone || '').trim(),
    whatsapp: String(payload.whatsapp || '').trim(),
    email: String(payload.email || '').trim(),
    address: String(payload.address || '').trim(),
    bank_name: String(payload.bank_name || '').trim(),
    bank_account_number: String(payload.bank_account_number || '').trim(),
    bank_account_name: String(payload.bank_account_name || '').trim(),
    order_prefix: String(payload.order_prefix || 'ORD-JWR').trim() || 'ORD-JWR',
    invoice_prefix: String(payload.invoice_prefix || 'INV-JWR').trim() || 'INV-JWR',
    invoice_footer_note: String(payload.invoice_footer_note || '').trim(),
    updated_at: ts,
  };

  if (existing) {
    await db.business_settings.update(existing.id, data);
    const updated = await db.business_settings.get(existing.id);
    if (!updated) throw new Error('Pengaturan bisnis tidak ditemukan.');
    return { settings: updated };
  }

  const created: BusinessSettings = {
    id: generateId(),
    ...data,
    created_at: ts,
  };
  await db.business_settings.add(created);
  return { settings: created };
}

// =============================================================================
// JSON BACKUP & RESTORE (INDEXEDDB)
// =============================================================================

export async function exportDatabaseJson(): Promise<{ filename: string; content: string }> {
  await getCurrentAdminOrThrow();

  const tables = await db.transaction(
    'r',
    [
      db.admins,
      db.technicians,
      db.customers,
      db.orders,
      db.order_items,
      db.invoices,
      db.payments,
      db.expense_categories,
      db.expenses,
      db.inventory_items,
      db.stock_movements,
      db.order_status_history,
      db.business_settings,
    ],
    async () => {
      const [
        admins,
        technicians,
        customers,
        orders,
        order_items,
        invoices,
        payments,
        expense_categories,
        expenses,
        inventory_items,
        stock_movements,
        order_status_history,
        business_settings,
      ] = await Promise.all([
        db.admins.toArray(),
        db.technicians.toArray(),
        db.customers.toArray(),
        db.orders.toArray(),
        db.order_items.toArray(),
        db.invoices.toArray(),
        db.payments.toArray(),
        db.expense_categories.toArray(),
        db.expenses.toArray(),
        db.inventory_items.toArray(),
        db.stock_movements.toArray(),
        db.order_status_history.toArray(),
        db.business_settings.toArray(),
      ]);

      return {
        admins,
        technicians,
        customers,
        orders,
        order_items,
        invoices,
        payments,
        expense_categories,
        expenses,
        inventory_items,
        stock_movements,
        order_status_history,
        business_settings,
      };
    }
  );

  const payload: JawaraBackupPayload = {
    format: 'jawara-ac-backup',
    version: 1,
    exported_at: nowIso(),
    tables,
  };

  return {
    filename: `jawara_ac_backup_${todayJakarta()}.json`,
    content: JSON.stringify(payload, null, 2),
  };
}

function assertRecordArray(val: unknown, tableName: string): Record<string, unknown>[] {
  if (!Array.isArray(val)) {
    throw new Error(`Struktur backup tidak valid: tabel "${tableName}" harus berupa array.`);
  }
  for (const row of val) {
    if (!row || typeof row !== 'object' || typeof (row as { id?: unknown }).id !== 'string' || !(row as { id: string }).id.trim()) {
      throw new Error(`Data tidak valid pada tabel "${tableName}" (setiap baris wajib memiliki id unik).`);
    }
  }
  return val as Record<string, unknown>[];
}

export async function importDatabaseJson(jsonText: string): Promise<{ ok: boolean; message: string }> {
  const currentAdmin = await getCurrentAdminOrThrow();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('File JSON tidak dapat dibaca atau format JSON tidak valid.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Format file backup JAWARA AC tidak valid.');
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.format !== 'jawara-ac-backup' || !obj.tables || typeof obj.tables !== 'object') {
    throw new Error('File yang diunggah bukan file backup JAWARA AC (.json) yang valid.');
  }

  const rawTables = obj.tables as Record<string, unknown>;
  for (const key of REQUIRED_BACKUP_TABLES) {
    assertRecordArray(rawTables[key], key);
  }

  const admins = (rawTables.admins as AdminRecord[]).map((a) => ({
    ...a,
    email: String(a.email || '').trim().toLowerCase(),
    role: 'admin' as const,
    is_active: a.is_active !== false,
  }));

  const activeAdmins = admins.filter((a) => a.is_active && a.email && a.password_hash);
  if (activeAdmins.length === 0) {
    throw new Error('File backup tidak memiliki akun Admin aktif yang valid.');
  }

  // Validate unique constraints before mutating database
  const emailSet = new Set<string>();
  for (const a of admins) {
    if (!a.email || emailSet.has(a.email)) {
      throw new Error(`Duplikasi atau email Admin kosong ditemukan dalam file backup (${a.email || '-'}).`);
    }
    emailSet.add(a.email);
  }

  const orders = (rawTables.orders as Order[]).map((o) => ({
    ...o,
    is_archived: Boolean(o.is_archived),
    labor_cost: Number(o.labor_cost) || 0,
    additional_cost: Number(o.additional_cost) || 0,
    material_cost: Number(o.material_cost) || 0,
    discount: Number(o.discount) || 0,
    total_amount: Number(o.total_amount) || 0,
    paid_amount: Number(o.paid_amount) || 0,
  }));

  const orderNumSet = new Set<string>();
  for (const o of orders) {
    if (!o.order_number || orderNumSet.has(o.order_number)) {
      throw new Error(`Nomor order duplikat atau kosong ditemukan pada backup (${o.order_number || '-'}).`);
    }
    orderNumSet.add(o.order_number);
  }

  const invoices = (rawTables.invoices as Invoice[]).map((inv) => ({
    ...inv,
    subtotal_amount: Number(inv.subtotal_amount) || 0,
    additional_cost: Number(inv.additional_cost) || 0,
    material_cost: Number(inv.material_cost) || 0,
    discount: Number(inv.discount) || 0,
    total_amount: Number(inv.total_amount) || 0,
    paid_amount: Number(inv.paid_amount) || 0,
    remaining_amount: Number(inv.remaining_amount) || 0,
  }));

  const invNumSet = new Set<string>();
  const invOrderSet = new Set<string>();
  for (const inv of invoices) {
    if (!inv.invoice_number || invNumSet.has(inv.invoice_number)) {
      throw new Error(`Nomor invoice duplikat atau kosong pada backup (${inv.invoice_number || '-'}).`);
    }
    if (!inv.order_id || invOrderSet.has(inv.order_id)) {
      throw new Error(`Relasi order pada invoice duplikat pada backup (${inv.invoice_number}).`);
    }
    invNumSet.add(inv.invoice_number);
    invOrderSet.add(inv.order_id);
  }

  const inventoryItems = (rawTables.inventory_items as InventoryItem[]).map((it) => ({
    ...it,
    item_code: String(it.item_code || '').trim().toUpperCase(),
    stock: Number(it.stock) || 0,
    min_stock: Number(it.min_stock) || 0,
    buy_price: Number(it.buy_price) || 0,
    sell_price: Number(it.sell_price) || 0,
    is_active: it.is_active !== false,
  }));

  const itemCodeSet = new Set<string>();
  for (const it of inventoryItems) {
    if (!it.item_code || itemCodeSet.has(it.item_code)) {
      throw new Error(`Kode barang inventaris duplikat atau kosong pada backup (${it.item_code || '-'}).`);
    }
    itemCodeSet.add(it.item_code);
  }

  const technicians = (rawTables.technicians as Technician[]).map((t) => ({
    ...t,
    is_active: t.is_active !== false,
  }));

  const customers = rawTables.customers as Customer[];
  const orderItems = (rawTables.order_items as OrderItem[]).map((item) => ({
    ...item,
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    subtotal: Number(item.subtotal) || 0,
    sort_order: Number(item.sort_order) || 0,
  }));
  const payments = (rawTables.payments as Payment[]).map((p) => ({
    ...p,
    amount: Number(p.amount) || 0,
    is_void: Boolean(p.is_void),
  }));
  const expenseCategories = (rawTables.expense_categories as ExpenseCategory[]).map((c) => ({
    ...c,
    is_default: Boolean(c.is_default),
  }));
  const expenses = (rawTables.expenses as Expense[]).map((e) => ({
    ...e,
    amount: Number(e.amount) || 0,
  }));
  const stockMovements = (rawTables.stock_movements as StockMovement[]).map((m) => ({
    ...m,
    quantity: Number(m.quantity) || 0,
    previous_stock: Number(m.previous_stock) || 0,
    new_stock: Number(m.new_stock) || 0,
  }));
  const orderStatusHistory = rawTables.order_status_history as OrderStatusHistory[];
  const businessSettings = rawTables.business_settings as BusinessSettings[];

  await db.transaction(
    'rw',
    [
      db.admins,
      db.local_session,
      db.technicians,
      db.customers,
      db.orders,
      db.order_items,
      db.invoices,
      db.payments,
      db.expense_categories,
      db.expenses,
      db.inventory_items,
      db.stock_movements,
      db.order_status_history,
      db.business_settings,
    ],
    async () => {
      await Promise.all([
        db.admins.clear(),
        db.technicians.clear(),
        db.customers.clear(),
        db.orders.clear(),
        db.order_items.clear(),
        db.invoices.clear(),
        db.payments.clear(),
        db.expense_categories.clear(),
        db.expenses.clear(),
        db.inventory_items.clear(),
        db.stock_movements.clear(),
        db.order_status_history.clear(),
        db.business_settings.clear(),
      ]);

      await Promise.all([
        db.admins.bulkPut(admins),
        db.technicians.bulkPut(technicians),
        db.customers.bulkPut(customers),
        db.orders.bulkPut(orders),
        db.order_items.bulkPut(orderItems),
        db.invoices.bulkPut(invoices),
        db.payments.bulkPut(payments),
        db.expense_categories.bulkPut(expenseCategories),
        db.expenses.bulkPut(expenses),
        db.inventory_items.bulkPut(inventoryItems),
        db.stock_movements.bulkPut(stockMovements),
        db.order_status_history.bulkPut(orderStatusHistory),
        db.business_settings.bulkPut(businessSettings),
      ]);

      const matchingAdmin =
        activeAdmins.find((a) => a.id === currentAdmin.id || a.email === currentAdmin.email) ||
        activeAdmins[0];

      await db.local_session.put({
        id: 'current',
        admin_id: matchingAdmin.id,
        logged_in_at: nowIso(),
      });
    }
  );

  initPromise = null;
  await ensureDbReady();

  return {
    ok: true,
    message: `Database berhasil dipulihkan (${orders.length} order, ${customers.length} pelanggan).`,
  };
}
