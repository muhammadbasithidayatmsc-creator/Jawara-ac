# Panduan Arsitektur, Database SQLite, Backup/Restore & Deployment — JAWARA AC

Aplikasi **JAWARA AC** menggunakan arsitektur **Full-Stack Terintegrasi (Node.js + Express + SQLite)** tanpa bergantung pada database eksternal (tanpa Supabase, Firebase, atau API Key berbayar).

---

## 1. Struktur Backend & Database SQLite

- **Server Internal (`server.ts`, `server/db.ts`, `server/auth.ts`, `server/routes.ts`)**:
  - Menangani seluruh autentikasi Admin, endpoint CRUD `/api/*`, transaksi pembayaran/stok atomik, serta menyajikan antarmuka React SPA.
- **Database Persisten SQLite (`jawara_ac.db`)**:
  - Disimpan di direktori `DATA_DIR` (default: `./data/jawara_ac.db`) dengan mode `WAL (Write-Ahead Logging)` dan `PRAGMA foreign_keys = ON`.
  - Seluruh 13 tabel terhubung dalam satu database yang sama: `admins`, `technicians`, `customers`, `orders`, `order_items`, `invoices`, `payments`, `expense_categories`, `expenses`, `inventory_items`, `stock_movements`, `order_status_history`, dan `business_settings`.

---

## 2. Aktivasi & Pengelolaan Akun Admin (Single Role: ADMIN)

1. Saat aplikasi pertama kali dijalankan dan tabel `admins` masih kosong, halaman login otomatis menampilkan formulir **Aktivasi Akun Admin Pertama**.
2. Isi email, nama lengkap, dan password Admin pertama (minimal 6 karakter). Password di-hash menggunakan `crypto.scrypt` + *salt* acak di server.
3. Setelah akun Admin pertama dibuat, formulir aktivasi otomatis terkunci. Anda juga dapat mengatur `ADMIN_EMAIL` dan `ADMIN_PASSWORD` di environment server jika ingin provisioning otomatis saat startup.

---

## 3. Backup & Restore Database

Di dalam aplikasi, buka menu **Pengaturan** → bagian **Backup & Restore Database SQLite**:
- **Download Backup (`.db`)**: Membuat snapshot konsisten database SQLite menggunakan SQLite Online Backup API dan mengunduh file `jawara_ac_backup_YYYY-MM-DD.db`.
- **Restore Database**: Mengunggah file `.db` hasil backup sebelumnya. Server memvalidasi integritas file SQLite, membuat cadangan pengaman otomatis sebelum menimpa database aktif, lalu memuat ulang seluruh data secara permanen.

---

## 4. Cara Deployment (WAJIB Persistent Volume)

> **PENTING:** Jangan men-deploy aplikasi berbasis SQLite ini ke platform *serverless ephemeral* seperti **Vercel** atau **Cloudflare Pages**, karena filesystem pada platform tersebut bersifat sementara dan file `.db` akan terhapus setiap kali restart/deploy.

Gunakan layanan hosting Node.js yang mendukung **Persistent Volume / Disk**:

### Opsi A: Railway (Direkomendasikan)
1. Push kode ke GitHub dan buat project baru di [Railway](https://railway.app) → **Deploy from GitHub repo**.
2. Buka tab **Variables** dan tambahkan:
   - `NODE_ENV=production`
   - `DATA_DIR=/app/data`
   - `SESSION_SECRET=<isi string acak 32+ karakter>`
3. Klik kanan pada service → **Add Volume** → atur **Mount Path**: `/app/data`.
4. Railway otomatis menjalankan `npm run build` dan `npm start` (`tsx server.ts`).

### Opsi B: Render (Web Service + Persistent Disk)
1. Buat **Web Service** baru di [Render](https://render.com) (Runtime: Node).
2. Konfigurasi:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. Buka menu **Disks** → **Add Disk** → **Mount Path**: `/var/data`.
4. Tambahkan Environment Variables:
   - `NODE_ENV=production`
   - `DATA_DIR=/var/data`
   - `SESSION_SECRET=<isi string acak 32+ karakter>`

### Opsi C: VPS Ubuntu (PM2 / Docker)
1. Clone repository ke VPS, lalu jalankan:
   ```bash
   npm install
   npm run build
   ```
2. Atur `.env` dengan `NODE_ENV=production`, `DATA_DIR=/var/lib/jawara-ac`, dan `SESSION_SECRET`.
3. Jalankan dengan PM2 agar selalu aktif:
   ```bash
   pm2 start "npm start" --name jawara-ac
   pm2 save
   ```
