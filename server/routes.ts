import crypto from 'node:crypto';
import fs from 'node:fs';
import express, { type Request, type Response, type Router } from 'express';
import {
  hashPassword,
  requireAdmin,
  signSessionToken,
  verifyPassword,
  type AdminRequest,
} from './auth.ts';
import {
  createBackupSnapshot,
  generateNextInvoiceNumber,
  generateNextOrderNumber,
  getDb,
  mapExpenseCategory,
  mapInventoryItem,
  mapOrder,
  mapPayment,
  mapTechnician,
  nowIso,
  recalculateOrderTotals,
  recordOrderPayment,
  recordStockMovement,
  restoreFromBackupBuffer,
  todayJakarta,
  voidOrderPayment,
} from './db.ts';

function handleSqlError(res: Response, err: unknown, fallback: string): void {
  const msg = err instanceof Error ? err.message : String(err || fallback);
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';

  if (code === 'SQLITE_CONSTRAINT_UNIQUE' || msg.includes('UNIQUE constraint failed')) {
    if (msg.includes('invoice_number')) {
      res.status(409).json({ error: 'Nomor invoice sudah digunakan. Gunakan nomor invoice lain yang unik.' });
      return;
    }
    if (msg.includes('order_number')) {
      res.status(409).json({ error: 'Nomor order sudah digunakan. Silakan buat nomor baru.' });
      return;
    }
    if (msg.includes('item_code')) {
      res.status(409).json({ error: 'Kode barang sudah terdaftar. Gunakan kode unik.' });
      return;
    }
    if (msg.includes('email')) {
      res.status(409).json({ error: 'Email sudah terdaftar.' });
      return;
    }
    res.status(409).json({ error: 'Data duplikat terdeteksi. Pastikan nilai unik tidak bentrok.' });
    return;
  }

  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || msg.includes('FOREIGN KEY constraint failed')) {
    res.status(409).json({ error: 'Data tidak dapat dihapus karena masih terhubung dengan transaksi lain.' });
    return;
  }

  res.status(400).json({ error: msg || fallback });
}

export function createApiRouter(): Router {
  const router = express.Router();

  // ===========================================================================
  // HEALTH & AUTH ROUTES
  // ===========================================================================

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  router.get('/auth/status', (_req: Request, res: Response) => {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) AS cnt FROM admins').get() as { cnt: number };
    res.json({ needsSetup: row.cnt === 0 });
  });

  router.post('/auth/setup', (req: Request, res: Response) => {
    try {
      const db = getDb();
      const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM admins').get() as { cnt: number };
      if (countRow.cnt > 0) {
        res.status(403).json({
          error: 'Akun Admin sudah aktif. Silakan masuk menggunakan email dan password Anda.',
        });
        return;
      }

      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const fullName = String(req.body?.full_name || 'Admin JAWARA AC').trim() || 'Admin JAWARA AC';

      if (!email || !email.includes('@')) {
        res.status(400).json({ error: 'Email Admin yang valid wajib diisi.' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'Password Admin minimal 6 karakter.' });
        return;
      }

      const id = crypto.randomUUID();
      const ts = nowIso();
      db.prepare(`
        INSERT INTO admins (id, email, password_hash, full_name, phone, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, '', 'admin', 1, ?, ?)
      `).run(id, email, hashPassword(password), fullName, ts, ts);

      const token = signSessionToken(id, email);
      res.status(201).json({
        token,
        profile: {
          id,
          email,
          full_name: fullName,
          phone: '',
          role: 'admin',
          is_active: true,
          created_at: ts,
          updated_at: ts,
        },
      });
    } catch (err) {
      handleSqlError(res, err, 'Gagal mengaktifkan akun Admin pertama.');
    }
  });

  router.post('/auth/login', (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');

      if (!email || !password) {
        res.status(400).json({ error: 'Email dan password wajib diisi.' });
        return;
      }

      const db = getDb();
      const admin = db
        .prepare('SELECT * FROM admins WHERE LOWER(email) = ?')
        .get(email) as
        | {
            id: string;
            email: string;
            password_hash: string;
            full_name: string;
            phone: string;
            role: 'admin';
            is_active: number;
            created_at: string;
            updated_at: string;
          }
        | undefined;

      if (!admin || !verifyPassword(password, admin.password_hash)) {
        res.status(401).json({ error: 'Email atau password Admin salah.' });
        return;
      }

      if (!admin.is_active) {
        res.status(403).json({ error: 'Akun Admin ini sedang dinonaktifkan.' });
        return;
      }

      const token = signSessionToken(admin.id, admin.email);
      res.json({
        token,
        profile: {
          id: admin.id,
          email: admin.email,
          full_name: admin.full_name,
          phone: admin.phone,
          role: admin.role,
          is_active: Boolean(admin.is_active),
          created_at: admin.created_at,
          updated_at: admin.updated_at,
        },
      });
    } catch (err) {
      handleSqlError(res, err, 'Gagal memproses login Admin.');
    }
  });

  // ===========================================================================
  // PROTECTED ADMIN ROUTES
  // ===========================================================================

  router.get('/auth/me', requireAdmin, (req: AdminRequest, res: Response) => {
    res.json({ profile: req.admin });
  });

  router.put('/auth/profile', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const fullName = String(req.body?.full_name || '').trim() || 'Admin JAWARA AC';
      const phone = String(req.body?.phone || '').trim();
      const ts = nowIso();

      db.prepare('UPDATE admins SET full_name = ?, phone = ?, updated_at = ? WHERE id = ?').run(
        fullName,
        phone,
        ts,
        req.admin!.id
      );

      const updated = db
        .prepare(
          'SELECT id, email, full_name, phone, role, is_active, created_at, updated_at FROM admins WHERE id = ?'
        )
        .get(req.admin!.id) as Record<string, unknown>;

      res.json({
        profile: {
          ...updated,
          is_active: Boolean(updated.is_active),
        },
      });
    } catch (err) {
      handleSqlError(res, err, 'Gagal memperbarui profil Admin.');
    }
  });

  router.put('/auth/password', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const newPassword = String(req.body?.password || '');
      if (newPassword.length < 6) {
        res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
        return;
      }

      const db = getDb();
      db.prepare('UPDATE admins SET password_hash = ?, updated_at = ? WHERE id = ?').run(
        hashPassword(newPassword),
        nowIso(),
        req.admin!.id
      );

      res.json({ ok: true });
    } catch (err) {
      handleSqlError(res, err, 'Gagal memperbarui password Admin.');
    }
  });

  // ===========================================================================
  // BOOTSTRAP ALL DATA
  // ===========================================================================

  router.get('/bootstrap', requireAdmin, (_req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const orders = (
        db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as Record<string, unknown>[]
      ).map(mapOrder);
      const customers = db
        .prepare('SELECT * FROM customers ORDER BY name COLLATE NOCASE ASC')
        .all() as Record<string, unknown>[];
      const technicians = (
        db
          .prepare('SELECT * FROM technicians ORDER BY name COLLATE NOCASE ASC')
          .all() as Record<string, unknown>[]
      ).map(mapTechnician);
      const payments = (
        db
          .prepare('SELECT * FROM payments ORDER BY payment_date DESC')
          .all() as Record<string, unknown>[]
      ).map(mapPayment);
      const expenses = db
        .prepare('SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC')
        .all() as Record<string, unknown>[];
      const expenseCategories = (
        db
          .prepare('SELECT * FROM expense_categories ORDER BY name COLLATE NOCASE ASC')
          .all() as Record<string, unknown>[]
      ).map(mapExpenseCategory);
      const inventoryItems = (
        db
          .prepare('SELECT * FROM inventory_items ORDER BY name COLLATE NOCASE ASC')
          .all() as Record<string, unknown>[]
      ).map(mapInventoryItem);
      const movementRows = db
        .prepare(`
          SELECT sm.*, ii.name AS item_name, ii.item_code AS item_code, ii.unit AS item_unit
          FROM stock_movements sm
          LEFT JOIN inventory_items ii ON ii.id = sm.item_id
          ORDER BY sm.created_at DESC
          LIMIT 200
        `)
        .all() as Record<string, unknown>[];

      const stockMovements = movementRows.map((row) => {
        const { item_name, item_code, item_unit, ...rest } = row;
        return {
          ...rest,
          inventory_items: item_name
            ? {
                name: String(item_name),
                item_code: String(item_code || ''),
                unit: String(item_unit || ''),
              }
            : null,
        };
      });

      const invoices = db
        .prepare('SELECT * FROM invoices ORDER BY created_at DESC')
        .all() as Record<string, unknown>[];
      const businessSettings = db.prepare('SELECT * FROM business_settings LIMIT 1').get() || null;

      res.json({
        orders,
        customers,
        technicians,
        payments,
        expenses,
        expenseCategories,
        inventoryItems,
        stockMovements,
        invoices,
        businessSettings,
      });
    } catch (err) {
      handleSqlError(res, err, 'Gagal memuat data aplikasi.');
    }
  });

  // ===========================================================================
  // ORDERS & ORDER ITEMS
  // ===========================================================================

  router.get('/orders/next-number', requireAdmin, (_req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      res.json({ order_number: generateNextOrderNumber(db) });
    } catch (err) {
      handleSqlError(res, err, 'Gagal membuat nomor order otomatis.');
    }
  });

  router.get('/invoices/next-number', requireAdmin, (_req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      res.json({ invoice_number: generateNextInvoiceNumber(db) });
    } catch (err) {
      handleSqlError(res, err, 'Gagal membuat nomor invoice otomatis.');
    }
  });

  router.get('/orders/:id/details', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const orderId = String(req.params.id);
      const orderRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
        | Record<string, unknown>
        | undefined;
      if (!orderRow) {
        res.status(404).json({ error: 'Order tidak ditemukan.' });
        return;
      }

      const items = db
        .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order ASC, created_at ASC')
        .all(orderId);
      const payments = (
        db
          .prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY payment_date DESC')
          .all(orderId) as Record<string, unknown>[]
      ).map(mapPayment);
      const history = db
        .prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY changed_at DESC')
        .all(orderId);
      const invoice = db.prepare('SELECT * FROM invoices WHERE order_id = ?').get(orderId) || null;

      res.json({
        order: mapOrder(orderRow),
        items,
        payments,
        history,
        invoice,
      });
    } catch (err) {
      handleSqlError(res, err, 'Gagal memuat detail order.');
    }
  });

  router.post('/orders', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const body = req.body || {};
      const orderNumber = String(body.order_number || '').trim();
      const serviceName = String(body.service_name || '').trim();

      if (!orderNumber || !serviceName) {
        res.status(400).json({ error: 'Nomor order dan nama pelayanan wajib diisi.' });
        return;
      }

      const result = db.transaction(() => {
        const ts = nowIso();
        let customerId = String(body.customer_id || '').trim();
        let customerName = String(body.customer_name || '').trim();
        let customerWhatsapp = String(body.customer_whatsapp || '').trim();
        let serviceAddress = String(body.service_address || '').trim();
        let newCustomer: Record<string, unknown> | undefined;

        if (body.new_customer) {
          const nc = body.new_customer;
          const ncName = String(nc.name || '').trim();
          const ncWa = String(nc.whatsapp || '').trim();
          if (!ncName || !ncWa) {
            throw new Error('Nama pelanggan baru dan nomor WhatsApp wajib diisi.');
          }
          customerId = crypto.randomUUID();
          const ncAddr = String(nc.address || '').trim();
          const ncEmail = String(nc.email || '').trim();
          db.prepare(`
            INSERT INTO customers (id, name, whatsapp, address, email, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, '', ?, ?)
          `).run(customerId, ncName, ncWa, ncAddr, ncEmail, ts, ts);

          customerName = ncName;
          if (!customerWhatsapp) customerWhatsapp = ncWa;
          if (!serviceAddress) serviceAddress = ncAddr;
          newCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as Record<
            string,
            unknown
          >;
        } else {
          const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as
            | { id: string; name: string }
            | undefined;
          if (!cust) {
            throw new Error('Pelanggan tidak ditemukan.');
          }
          customerName = cust.name;
        }

        const techId = body.technician_id ? String(body.technician_id).trim() : null;
        let techName = '';
        if (techId) {
          const tech = db.prepare('SELECT id, name FROM technicians WHERE id = ?').get(techId) as
            | { id: string; name: string }
            | undefined;
          if (tech) techName = tech.name;
        }

        const labor = Math.max(0, Number(body.labor_cost) || 0);
        const additional = Math.max(0, Number(body.additional_cost) || 0);
        const material = Math.max(0, Number(body.material_cost) || 0);
        const discount = Math.max(0, Number(body.discount) || 0);
        const total = Math.max(0, labor + additional + material - discount);
        const invoiceNumber = body.invoice_number ? String(body.invoice_number).trim() : null;
        const status = String(body.status || 'Baru');

        const orderId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO orders (
            id, order_number, invoice_number, customer_id, customer_name,
            customer_whatsapp, service_address, service_name, service_date, service_time,
            technician_id, technician_name, complaint,
            labor_cost, additional_cost, material_cost, discount, total_amount,
            paid_amount, payment_status, status, internal_notes, is_archived, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'BELUM BAYAR', ?, ?, 0, ?, ?)
        `).run(
          orderId,
          orderNumber,
          invoiceNumber,
          customerId,
          customerName,
          customerWhatsapp,
          serviceAddress,
          serviceName,
          String(body.service_date || todayJakarta()),
          body.service_time ? String(body.service_time) : null,
          techId,
          techName,
          String(body.complaint || '').trim(),
          labor,
          additional,
          material,
          discount,
          total,
          status,
          String(body.internal_notes || '').trim(),
          ts,
          ts
        );

        db.prepare(`
          INSERT INTO order_status_history (id, order_id, previous_status, new_status, notes, changed_by, changed_at)
          VALUES (?, ?, '', ?, 'Order baru dibuat', ?, ?)
        `).run(crypto.randomUUID(), orderId, status, req.admin!.id, ts);

        const orderRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<
          string,
          unknown
        >;
        return { order: mapOrder(orderRow), newCustomer };
      })();

      res.status(201).json(result);
    } catch (err) {
      handleSqlError(res, err, 'Gagal membuat order baru.');
    }
  });

  router.put('/orders/:id', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const orderId = String(req.params.id);
      const body = req.body || {};

      const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
        | Record<string, unknown>
        | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Order tidak ditemukan.' });
        return;
      }

      const updatedOrder = db.transaction(() => {
        const ts = nowIso();
        const customerId = String(body.customer_id || existing.customer_id);
        const cust = db.prepare('SELECT id, name FROM customers WHERE id = ?').get(customerId) as
          | { id: string; name: string }
          | undefined;
        if (!cust) throw new Error('Pelanggan tidak ditemukan.');

        const techId = body.technician_id ? String(body.technician_id).trim() : null;
        let techName = '';
        if (techId) {
          const tech = db.prepare('SELECT id, name FROM technicians WHERE id = ?').get(techId) as
            | { id: string; name: string }
            | undefined;
          if (tech) techName = tech.name;
        }

        const labor = Math.max(0, Number(body.labor_cost) || 0);
        const additional = Math.max(0, Number(body.additional_cost) || 0);
        const material = Math.max(0, Number(body.material_cost) || 0);
        const discount = Math.max(0, Number(body.discount) || 0);
        const nextStatus = String(body.status || existing.status);
        const invoiceNumber = body.invoice_number ? String(body.invoice_number).trim() : null;

        db.prepare(`
          UPDATE orders
          SET order_number = ?, invoice_number = ?, customer_id = ?, customer_name = ?,
              customer_whatsapp = ?, service_address = ?, service_name = ?, service_date = ?,
              service_time = ?, technician_id = ?, technician_name = ?, complaint = ?,
              labor_cost = ?, additional_cost = ?, material_cost = ?, discount = ?,
              status = ?, internal_notes = ?, updated_at = ?
          WHERE id = ?
        `).run(
          String(body.order_number || existing.order_number).trim(),
          invoiceNumber,
          customerId,
          cust.name,
          String(body.customer_whatsapp ?? existing.customer_whatsapp).trim(),
          String(body.service_address ?? existing.service_address).trim(),
          String(body.service_name || existing.service_name).trim(),
          String(body.service_date || existing.service_date),
          body.service_time ? String(body.service_time) : null,
          techId,
          techName,
          String(body.complaint ?? existing.complaint).trim(),
          labor,
          additional,
          material,
          discount,
          nextStatus,
          String(body.internal_notes ?? existing.internal_notes).trim(),
          ts,
          orderId
        );

        if (invoiceNumber) {
          db.prepare('UPDATE invoices SET invoice_number = ?, updated_at = ? WHERE order_id = ?').run(
            invoiceNumber,
            ts,
            orderId
          );
          db.prepare('UPDATE payments SET invoice_number = ?, updated_at = ? WHERE order_id = ?').run(
            invoiceNumber,
            ts,
            orderId
          );
        }

        if (existing.status !== nextStatus) {
          db.prepare(`
            INSERT INTO order_status_history (id, order_id, previous_status, new_status, notes, changed_by, changed_at)
            VALUES (?, ?, ?, ?, 'Diubah melalui form edit order', ?, ?)
          `).run(crypto.randomUUID(), orderId, String(existing.status), nextStatus, req.admin!.id, ts);
        }

        recalculateOrderTotals(db, orderId, false);
        const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<
          string,
          unknown
        >;
        return mapOrder(fresh);
      })();

      res.json({ order: updatedOrder });
    } catch (err) {
      handleSqlError(res, err, 'Gagal memperbarui order.');
    }
  });

  router.patch('/orders/:id/status', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const orderId = String(req.params.id);
      const nextStatus = String(req.body?.status || '').trim();
      const notes = String(req.body?.notes || '').trim();

      const existing = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(orderId) as
        | { id: string; status: string }
        | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Order tidak ditemukan.' });
        return;
      }

      const ts = nowIso();
      db.transaction(() => {
        db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(
          nextStatus,
          ts,
          orderId
        );
        db.prepare(`
          INSERT INTO order_status_history (id, order_id, previous_status, new_status, notes, changed_by, changed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          orderId,
          existing.status,
          nextStatus,
          notes || `Status diubah ke ${nextStatus}`,
          req.admin!.id,
          ts
        );
      })();

      const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<
        string,
        unknown
      >;
      res.json({ order: mapOrder(fresh) });
    } catch (err) {
      handleSqlError(res, err, 'Gagal mengubah status order.');
    }
  });

  router.patch('/orders/:id/archive', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const orderId = String(req.params.id);
      const isArchived = req.body?.is_archived ? 1 : 0;
      const result = db
        .prepare('UPDATE orders SET is_archived = ?, updated_at = ? WHERE id = ?')
        .run(isArchived, nowIso(), orderId);
      if (result.changes === 0) {
        res.status(404).json({ error: 'Order tidak ditemukan.' });
        return;
      }
      const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<
        string,
        unknown
      >;
      res.json({ order: mapOrder(fresh) });
    } catch (err) {
      handleSqlError(res, err, 'Gagal mengubah status arsip order.');
    }
  });

  router.delete('/orders/:id', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const result = db.prepare('DELETE FROM orders WHERE id = ?').run(String(req.params.id));
      if (result.changes === 0) {
        res.status(404).json({ error: 'Order tidak ditemukan.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      handleSqlError(res, err, 'Gagal menghapus order.');
    }
  });

  // Order Items CRUD
  router.post('/orders/:id/items', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const orderId = String(req.params.id);
      const workName = String(req.body?.work_name || '').trim();
      const description = String(req.body?.description || '').trim();
      const quantity = Number(req.body?.quantity);
      const unit = String(req.body?.unit || 'Unit').trim() || 'Unit';
      const unitPrice = Number(req.body?.unit_price);
      const sortOrder = Number(req.body?.sort_order || 1);

      if (!workName || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
        res.status(400).json({ error: 'Nama pekerjaan, jumlah (> 0), dan harga satuan wajib valid.' });
        return;
      }

      const subtotal = quantity * unitPrice;
      const ts = nowIso();
      const itemId = crypto.randomUUID();

      db.transaction(() => {
        db.prepare(`
          INSERT INTO order_items (id, order_id, work_name, description, quantity, unit, unit_price, subtotal, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(itemId, orderId, workName, description, quantity, unit, unitPrice, subtotal, sortOrder, ts, ts);
        recalculateOrderTotals(db, orderId, true);
      })();

      res.status(201).json({ id: itemId });
    } catch (err) {
      handleSqlError(res, err, 'Gagal menambahkan rincian pekerjaan.');
    }
  });

  router.put('/order-items/:itemId', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const itemId = String(req.params.itemId);
      const existing = db.prepare('SELECT order_id FROM order_items WHERE id = ?').get(itemId) as
        | { order_id: string }
        | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Item pekerjaan tidak ditemukan.' });
        return;
      }

      const workName = String(req.body?.work_name || '').trim();
      const description = String(req.body?.description || '').trim();
      const quantity = Number(req.body?.quantity);
      const unit = String(req.body?.unit || 'Unit').trim() || 'Unit';
      const unitPrice = Number(req.body?.unit_price);

      if (!workName || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
        res.status(400).json({ error: 'Data item pekerjaan tidak valid.' });
        return;
      }

      const subtotal = quantity * unitPrice;
      db.transaction(() => {
        db.prepare(`
          UPDATE order_items
          SET work_name = ?, description = ?, quantity = ?, unit = ?, unit_price = ?, subtotal = ?, updated_at = ?
          WHERE id = ?
        `).run(workName, description, quantity, unit, unitPrice, subtotal, nowIso(), itemId);
        recalculateOrderTotals(db, existing.order_id, true);
      })();

      res.json({ ok: true });
    } catch (err) {
      handleSqlError(res, err, 'Gagal memperbarui item pekerjaan.');
    }
  });

  router.delete('/order-items/:itemId', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const itemId = String(req.params.itemId);
      const existing = db.prepare('SELECT order_id FROM order_items WHERE id = ?').get(itemId) as
        | { order_id: string }
        | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Item pekerjaan tidak ditemukan.' });
        return;
      }

      db.transaction(() => {
        db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId);
        recalculateOrderTotals(db, existing.order_id, true);
      })();

      res.json({ ok: true });
    } catch (err) {
      handleSqlError(res, err, 'Gagal menghapus item pekerjaan.');
    }
  });

  // ===========================================================================
  // PAYMENTS
  // ===========================================================================

  router.post('/payments', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const result = recordOrderPayment(db, {
        orderId: String(req.body?.order_id || ''),
        amount: Number(req.body?.amount),
        paymentMethod: req.body?.payment_method,
        paymentDate: req.body?.payment_date ? String(req.body.payment_date) : undefined,
        notes: req.body?.notes ? String(req.body.notes) : '',
        invoiceNumber: req.body?.invoice_number ? String(req.body.invoice_number) : null,
        adminId: req.admin!.id,
      });
      res.status(201).json(result);
    } catch (err) {
      handleSqlError(res, err, 'Gagal mencatat pembayaran.');
    }
  });

  router.post('/payments/:id/void', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const result = voidOrderPayment(db, String(req.params.id));
      res.json(result);
    } catch (err) {
      handleSqlError(res, err, 'Gagal membatalkan transaksi pembayaran.');
    }
  });

  // ===========================================================================
  // INVOICES
  // ===========================================================================

  router.post('/invoices', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const orderId = String(req.body?.order_id || '').trim();
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
        | Record<string, unknown>
        | undefined;
      if (!order) {
        res.status(404).json({ error: 'Order tidak ditemukan.' });
        return;
      }

      const invoice = db.transaction(() => {
        const ts = nowIso();
        const existing = db.prepare('SELECT * FROM invoices WHERE order_id = ?').get(orderId) as
          | { id: string; invoice_number: string }
          | undefined;

        const requestedNo = String(req.body?.invoice_number || '').trim();
        const invNo =
          requestedNo ||
          (order.invoice_number ? String(order.invoice_number).trim() : '') ||
          existing?.invoice_number ||
          generateNextInvoiceNumber(db);

        const total = Number(order.total_amount) || 0;
        const paid = Number(order.paid_amount) || 0;
        const remaining = Math.max(0, total - paid);

        if (existing) {
          db.prepare(`
            UPDATE invoices
            SET invoice_number = ?, issued_date = ?, customer_name = ?, customer_whatsapp = ?,
                customer_address = ?, service_name = ?, technician_name = ?,
                subtotal_amount = ?, additional_cost = ?, material_cost = ?, discount = ?,
                total_amount = ?, paid_amount = ?, remaining_amount = ?, payment_status = ?, updated_at = ?
            WHERE id = ?
          `).run(
            invNo,
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
            remaining,
            order.payment_status,
            ts,
            existing.id
          );
        } else {
          db.prepare(`
            INSERT INTO invoices (
              id, invoice_number, order_id, issued_date,
              customer_name, customer_whatsapp, customer_address,
              service_name, technician_name,
              subtotal_amount, additional_cost, material_cost, discount,
              total_amount, paid_amount, remaining_amount, payment_status, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)
          `).run(
            crypto.randomUUID(),
            invNo,
            orderId,
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
            remaining,
            order.payment_status,
            ts,
            ts
          );
        }

        db.prepare('UPDATE orders SET invoice_number = ?, updated_at = ? WHERE id = ?').run(
          invNo,
          ts,
          orderId
        );
        db.prepare('UPDATE payments SET invoice_number = ?, updated_at = ? WHERE order_id = ?').run(
          invNo,
          ts,
          orderId
        );

        return db.prepare('SELECT * FROM invoices WHERE order_id = ?').get(orderId);
      })();

      res.status(201).json({ invoice });
    } catch (err) {
      handleSqlError(res, err, 'Gagal menerbitkan invoice.');
    }
  });

  router.patch('/invoices/:id/number', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const invId = String(req.params.id);
      const newNumber = String(req.body?.invoice_number || '').trim();
      if (!newNumber) {
        res.status(400).json({ error: 'Nomor invoice tidak boleh kosong.' });
        return;
      }

      const existing = db.prepare('SELECT id, order_id FROM invoices WHERE id = ?').get(invId) as
        | { id: string; order_id: string }
        | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Invoice tidak ditemukan.' });
        return;
      }

      const updated = db.transaction(() => {
        const ts = nowIso();
        db.prepare('UPDATE invoices SET invoice_number = ?, updated_at = ? WHERE id = ?').run(
          newNumber,
          ts,
          invId
        );
        db.prepare('UPDATE orders SET invoice_number = ?, updated_at = ? WHERE id = ?').run(
          newNumber,
          ts,
          existing.order_id
        );
        db.prepare('UPDATE payments SET invoice_number = ?, updated_at = ? WHERE invoice_id = ?').run(
          newNumber,
          ts,
          invId
        );
        return db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
      })();

      res.json({ invoice: updated });
    } catch (err) {
      handleSqlError(res, err, 'Gagal mengubah nomor invoice.');
    }
  });

  // ===========================================================================
  // TECHNICIANS
  // ===========================================================================

  router.post('/technicians', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const name = String(req.body?.name || '').trim();
      const whatsapp = String(req.body?.whatsapp || '').trim();
      if (!name || !whatsapp) {
        res.status(400).json({ error: 'Nama teknisi dan nomor WhatsApp wajib diisi.' });
        return;
      }
      const id = crypto.randomUUID();
      const ts = nowIso();
      db.prepare(`
        INSERT INTO technicians (id, name, whatsapp, address, specialty, notes, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        name,
        whatsapp,
        String(req.body?.address || '').trim(),
        String(req.body?.specialty || '').trim(),
        String(req.body?.notes || '').trim(),
        req.body?.is_active === false ? 0 : 1,
        ts,
        ts
      );
      const row = db.prepare('SELECT * FROM technicians WHERE id = ?').get(id) as Record<
        string,
        unknown
      >;
      res.status(201).json({ technician: mapTechnician(row) });
    } catch (err) {
      handleSqlError(res, err, 'Gagal menambah teknisi.');
    }
  });

  router.put('/technicians/:id', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const id = String(req.params.id);
      const name = String(req.body?.name || '').trim();
      const whatsapp = String(req.body?.whatsapp || '').trim();
      if (!name || !whatsapp) {
        res.status(400).json({ error: 'Nama teknisi dan nomor WhatsApp wajib diisi.' });
        return;
      }
      const result = db
        .prepare(`
          UPDATE technicians
          SET name = ?, whatsapp = ?, address = ?, specialty = ?, notes = ?, is_active = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(
          name,
          whatsapp,
          String(req.body?.address || '').trim(),
          String(req.body?.specialty || '').trim(),
          String(req.body?.notes || '').trim(),
          req.body?.is_active === false ? 0 : 1,
          nowIso(),
          id
        );
      if (result.changes === 0) {
        res.status(404).json({ error: 'Teknisi tidak ditemukan.' });
        return;
      }
      const row = db.prepare('SELECT * FROM technicians WHERE id = ?').get(id) as Record<
        string,
        unknown
      >;
      res.json({ technician: mapTechnician(row) });
    } catch (err) {
      handleSqlError(res, err, 'Gagal memperbarui teknisi.');
    }
  });

  router.patch('/technicians/:id/toggle', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const id = String(req.params.id);
      const isActive = req.body?.is_active ? 1 : 0;
      const result = db
        .prepare('UPDATE technicians SET is_active = ?, updated_at = ? WHERE id = ?')
        .run(isActive, nowIso(), id);
      if (result.changes === 0) {
        res.status(404).json({ error: 'Teknisi tidak ditemukan.' });
        return;
      }
      const row = db.prepare('SELECT * FROM technicians WHERE id = ?').get(id) as Record<
        string,
        unknown
      >;
      res.json({ technician: mapTechnician(row) });
    } catch (err) {
      handleSqlError(res, err, 'Gagal mengubah status teknisi.');
    }
  });

  router.delete('/technicians/:id', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const result = db.prepare('DELETE FROM technicians WHERE id = ?').run(String(req.params.id));
      if (result.changes === 0) {
        res.status(404).json({ error: 'Teknisi tidak ditemukan.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      handleSqlError(res, err, 'Gagal menghapus teknisi.');
    }
  });

  // ===========================================================================
  // CUSTOMERS
  // ===========================================================================

  router.post('/customers', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const name = String(req.body?.name || '').trim();
      const whatsapp = String(req.body?.whatsapp || '').trim();
      if (!name || !whatsapp) {
        res.status(400).json({ error: 'Nama pelanggan dan nomor WhatsApp wajib diisi.' });
        return;
      }
      const id = crypto.randomUUID();
      const ts = nowIso();
      db.prepare(`
        INSERT INTO customers (id, name, whatsapp, address, email, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        name,
        whatsapp,
        String(req.body?.address || '').trim(),
        String(req.body?.email || '').trim(),
        String(req.body?.notes || '').trim(),
        ts,
        ts
      );
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      res.status(201).json({ customer });
    } catch (err) {
      handleSqlError(res, err, 'Gagal menambah pelanggan.');
    }
  });

  router.put('/customers/:id', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const id = String(req.params.id);
      const name = String(req.body?.name || '').trim();
      const whatsapp = String(req.body?.whatsapp || '').trim();
      if (!name || !whatsapp) {
        res.status(400).json({ error: 'Nama pelanggan dan nomor WhatsApp wajib diisi.' });
        return;
      }
      const result = db
        .prepare(`
          UPDATE customers
          SET name = ?, whatsapp = ?, address = ?, email = ?, notes = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(
          name,
          whatsapp,
          String(req.body?.address || '').trim(),
          String(req.body?.email || '').trim(),
          String(req.body?.notes || '').trim(),
          nowIso(),
          id
        );
      if (result.changes === 0) {
        res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
        return;
      }
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      res.json({ customer });
    } catch (err) {
      handleSqlError(res, err, 'Gagal memperbarui pelanggan.');
    }
  });

  router.delete('/customers/:id', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const id = String(req.params.id);
      const orderCount = (
        db.prepare('SELECT COUNT(*) AS cnt FROM orders WHERE customer_id = ?').get(id) as {
          cnt: number;
        }
      ).cnt;
      if (orderCount > 0) {
        res.status(409).json({
          error: `Pelanggan tidak dapat dihapus karena memiliki ${orderCount} transaksi order terkait.`,
        });
        return;
      }
      const result = db.prepare('DELETE FROM customers WHERE id = ?').run(id);
      if (result.changes === 0) {
        res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      handleSqlError(res, err, 'Gagal menghapus pelanggan.');
    }
  });

  // ===========================================================================
  // EXPENSES
  // ===========================================================================

  router.post('/expenses', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const title = String(req.body?.title || '').trim();
      const amount = Number(req.body?.amount);
      const categoryName = String(req.body?.category_name || 'Operasional').trim();
      const paymentMethod = req.body?.payment_method === 'TRANSFER' ? 'TRANSFER' : 'CASH';

      if (!title || !Number.isFinite(amount) || amount < 0) {
        res.status(400).json({ error: 'Nama pengeluaran dan nominal valid wajib diisi.' });
        return;
      }

      const cat = db.prepare('SELECT id FROM expense_categories WHERE name = ?').get(categoryName) as
        | { id: string }
        | undefined;
      const id = crypto.randomUUID();
      const ts = nowIso();
      db.prepare(`
        INSERT INTO expenses (id, expense_date, title, category_id, category_name, amount, payment_method, notes, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        String(req.body?.expense_date || todayJakarta()),
        title,
        cat?.id || null,
        categoryName,
        amount,
        paymentMethod,
        String(req.body?.notes || '').trim(),
        req.admin!.id,
        ts,
        ts
      );

      const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
      res.status(201).json({ expense });
    } catch (err) {
      handleSqlError(res, err, 'Gagal mencatat pengeluaran.');
    }
  });

  router.put('/expenses/:id', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const id = String(req.params.id);
      const title = String(req.body?.title || '').trim();
      const amount = Number(req.body?.amount);
      const categoryName = String(req.body?.category_name || 'Operasional').trim();
      const paymentMethod = req.body?.payment_method === 'TRANSFER' ? 'TRANSFER' : 'CASH';

      if (!title || !Number.isFinite(amount) || amount < 0) {
        res.status(400).json({ error: 'Nama pengeluaran dan nominal valid wajib diisi.' });
        return;
      }

      const cat = db.prepare('SELECT id FROM expense_categories WHERE name = ?').get(categoryName) as
        | { id: string }
        | undefined;
      const result = db
        .prepare(`
          UPDATE expenses
          SET expense_date = ?, title = ?, category_id = ?, category_name = ?, amount = ?, payment_method = ?, notes = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(
          String(req.body?.expense_date || todayJakarta()),
          title,
          cat?.id || null,
          categoryName,
          amount,
          paymentMethod,
          String(req.body?.notes || '').trim(),
          nowIso(),
          id
        );

      if (result.changes === 0) {
        res.status(404).json({ error: 'Data pengeluaran tidak ditemukan.' });
        return;
      }
      const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
      res.json({ expense });
    } catch (err) {
      handleSqlError(res, err, 'Gagal memperbarui pengeluaran.');
    }
  });

  router.delete('/expenses/:id', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const result = db.prepare('DELETE FROM expenses WHERE id = ?').run(String(req.params.id));
      if (result.changes === 0) {
        res.status(404).json({ error: 'Data pengeluaran tidak ditemukan.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      handleSqlError(res, err, 'Gagal menghapus pengeluaran.');
    }
  });

  // ===========================================================================
  // INVENTORY & STOCK MOVEMENTS
  // ===========================================================================

  router.post('/inventory', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const itemCode = String(req.body?.item_code || '').trim().toUpperCase();
      const name = String(req.body?.name || '').trim();
      if (!itemCode || !name) {
        res.status(400).json({ error: 'Kode barang dan nama barang wajib diisi.' });
        return;
      }
      const id = crypto.randomUUID();
      const ts = nowIso();
      db.prepare(`
        INSERT INTO inventory_items (id, item_code, name, category, unit, stock, min_stock, buy_price, sell_price, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        id,
        itemCode,
        name,
        String(req.body?.category || 'Sparepart').trim() || 'Sparepart',
        String(req.body?.unit || 'Pcs').trim() || 'Pcs',
        Math.max(0, Number(req.body?.stock) || 0),
        Math.max(0, Number(req.body?.min_stock) || 0),
        Math.max(0, Number(req.body?.buy_price) || 0),
        Math.max(0, Number(req.body?.sell_price) || 0),
        ts,
        ts
      );
      const row = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id) as Record<
        string,
        unknown
      >;
      res.status(201).json({ item: mapInventoryItem(row) });
    } catch (err) {
      handleSqlError(res, err, 'Gagal menambah barang inventaris.');
    }
  });

  router.put('/inventory/:id', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const id = String(req.params.id);
      const itemCode = String(req.body?.item_code || '').trim().toUpperCase();
      const name = String(req.body?.name || '').trim();
      if (!itemCode || !name) {
        res.status(400).json({ error: 'Kode barang dan nama barang wajib diisi.' });
        return;
      }
      const result = db
        .prepare(`
          UPDATE inventory_items
          SET item_code = ?, name = ?, category = ?, unit = ?, min_stock = ?, buy_price = ?, sell_price = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(
          itemCode,
          name,
          String(req.body?.category || 'Sparepart').trim() || 'Sparepart',
          String(req.body?.unit || 'Pcs').trim() || 'Pcs',
          Math.max(0, Number(req.body?.min_stock) || 0),
          Math.max(0, Number(req.body?.buy_price) || 0),
          Math.max(0, Number(req.body?.sell_price) || 0),
          nowIso(),
          id
        );
      if (result.changes === 0) {
        res.status(404).json({ error: 'Barang inventaris tidak ditemukan.' });
        return;
      }
      const row = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id) as Record<
        string,
        unknown
      >;
      res.json({ item: mapInventoryItem(row) });
    } catch (err) {
      handleSqlError(res, err, 'Gagal memperbarui barang inventaris.');
    }
  });

  router.delete('/inventory/:id', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const result = db
        .prepare('DELETE FROM inventory_items WHERE id = ?')
        .run(String(req.params.id));
      if (result.changes === 0) {
        res.status(404).json({ error: 'Barang inventaris tidak ditemukan.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      handleSqlError(res, err, 'Gagal menghapus barang inventaris.');
    }
  });

  router.post('/inventory/:id/movements', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const result = recordStockMovement(db, {
        itemId: String(req.params.id),
        movementType: req.body?.movement_type,
        quantity: Number(req.body?.quantity),
        referenceNote: req.body?.reference_note ? String(req.body.reference_note) : '',
        orderId: req.body?.order_id ? String(req.body.order_id) : null,
        adminId: req.admin!.id,
      });
      res.status(201).json(result);
    } catch (err) {
      handleSqlError(res, err, 'Gagal mencatat pergerakan stok.');
    }
  });

  // ===========================================================================
  // BUSINESS SETTINGS
  // ===========================================================================

  router.put('/settings', requireAdmin, (req: AdminRequest, res: Response) => {
    try {
      const db = getDb();
      const body = req.body || {};
      const existing = db.prepare('SELECT id FROM business_settings LIMIT 1').get() as
        | { id: string }
        | undefined;
      const ts = nowIso();

      const fields = [
        String(body.business_name || 'JAWARA AC').trim() || 'JAWARA AC',
        String(body.tagline || 'Service AC Lebih Mudah, Bisnis Lebih Maju').trim(),
        String(body.phone || '').trim(),
        String(body.whatsapp || '').trim(),
        String(body.email || '').trim(),
        String(body.address || '').trim(),
        String(body.bank_name || '').trim(),
        String(body.bank_account_number || '').trim(),
        String(body.bank_account_name || '').trim(),
        String(body.order_prefix || 'ORD-JWR').trim() || 'ORD-JWR',
        String(body.invoice_prefix || 'INV-JWR').trim() || 'INV-JWR',
        String(body.invoice_footer_note || '').trim(),
      ];

      if (existing) {
        db.prepare(`
          UPDATE business_settings
          SET business_name = ?, tagline = ?, phone = ?, whatsapp = ?, email = ?, address = ?,
              bank_name = ?, bank_account_number = ?, bank_account_name = ?,
              order_prefix = ?, invoice_prefix = ?, invoice_footer_note = ?, updated_at = ?
          WHERE id = ?
        `).run(...fields, ts, existing.id);
      } else {
        db.prepare(`
          INSERT INTO business_settings (
            id, business_name, tagline, phone, whatsapp, email, address,
            bank_name, bank_account_number, bank_account_name,
            order_prefix, invoice_prefix, invoice_footer_note, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), ...fields, ts, ts);
      }

      const settings = db.prepare('SELECT * FROM business_settings LIMIT 1').get();
      res.json({ settings });
    } catch (err) {
      handleSqlError(res, err, 'Gagal menyimpan pengaturan bisnis.');
    }
  });

  // ===========================================================================
  // DATABASE BACKUP & RESTORE
  // ===========================================================================

  router.get('/database/backup', requireAdmin, async (_req: AdminRequest, res: Response) => {
    let snapshotPath = '';
    try {
      snapshotPath = await createBackupSnapshot();
      const dateStamp = todayJakarta();
      const filename = `jawara_ac_backup_${dateStamp}.db`;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      const stream = fs.createReadStream(snapshotPath);
      stream.on('close', () => {
        if (snapshotPath && fs.existsSync(snapshotPath)) {
          fs.unlinkSync(snapshotPath);
        }
      });
      stream.pipe(res);
    } catch (err) {
      if (snapshotPath && fs.existsSync(snapshotPath)) {
        fs.unlinkSync(snapshotPath);
      }
      handleSqlError(res, err, 'Gagal membuat file backup database.');
    }
  });

  router.post(
    '/database/restore',
    requireAdmin,
    express.raw({ type: 'application/octet-stream', limit: '100mb' }),
    (req: AdminRequest, res: Response) => {
      try {
        const buffer = req.body as Buffer;
        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
          res.status(400).json({ error: 'File backup tidak diterima oleh server.' });
          return;
        }
        restoreFromBackupBuffer(buffer);
        res.json({ ok: true, message: 'Database SQLite berhasil dipulihkan.' });
      } catch (err) {
        handleSqlError(res, err, 'Gagal memulihkan database dari file backup.');
      }
    }
  );

  return router;
}
