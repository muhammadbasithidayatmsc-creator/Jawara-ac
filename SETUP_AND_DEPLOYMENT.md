# Panduan Arsitektur, IndexedDB (Dexie.js), Backup JSON & Deployment Vercel — JAWARA AC

Aplikasi **JAWARA AC** berjalan sebagai **WebApp Client-Side Standalone** langsung di browser HP dan laptop tanpa server backend terpisah, tanpa API Key, dan tanpa database eksternal.

---

## 1. Arsitektur Penyimpanan Internal (IndexedDB + Dexie.js)

- **Database Browser Lokal (`JawaraAcDB`)**:
  - Menggunakan **IndexedDB** melalui **Dexie.js** sebagai penyimpanan permanen di browser perangkat.
  - Seluruh modul saling terhubung dalam satu database yang sama: `admins`, `local_session`, `technicians`, `customers`, `orders`, `order_items`, `invoices`, `payments`, `expense_categories`, `expenses`, `inventory_items`, `stock_movements`, `order_status_history`, dan `business_settings`.
  - Seluruh data tetap tersimpan setelah halaman di-refresh maupun setelah logout dan login kembali.
- **Tanpa Data Dummy Operasional**:
  - Database hanya menginisialisasi pengaturan default usaha (`JAWARA AC`) dan 6 kategori pengeluaran standar. Data transaksi, pelanggan, dan teknisi sepenuhnya berasal dari input pengguna.

---

## 2. Akun Admin Lokal (Single Role: ADMIN)

1. Saat pertama kali dibuka di perangkat baru, halaman login menampilkan form **Aktivasi Akun Admin Pertama** (email, nama lengkap, dan password minimal 6 karakter).
2. Password disimpan dalam bentuk *salted hash* di IndexedDB lokal, dan Anda dapat mengubah profil maupun password Admin kapan saja melalui menu **Pengaturan**.
3. **Catatan Penting**: Login lokal ditujukan untuk pembatasan akses antarmuka di perangkat/browser ini, bukan sistem keamanan server multi-perangkat.

---

## 3. Backup & Restore Database (JSON)

Karena data tersimpan secara lokal di browser perangkat, lakukan **Backup JSON** secara berkala melalui menu **Pengaturan → Backup & Restore Database (JSON)**:
- **Download Backup (`.json`)**: Mengekspor seluruh isi database JAWARA AC ke file `jawara_ac_backup_YYYY-MM-DD.json`.
- **Restore dari File (`.json`)**: Mengunggah file `.json` hasil backup sebelumnya untuk memulihkan atau memindahkan seluruh data ke browser/perangkat lain (misalnya dari HP ke laptop atau sebaliknya). Sistem memvalidasi struktur JSON sebelum memperbarui database secara atomik.

---

## 4. Cara Deployment ke Vercel (Static WebApp)

Aplikasi langsung siap di-deploy ke **Vercel** sebagai static Vite React app:
1. Push repository ke GitHub, lalu impor project di [Vercel](https://vercel.com).
2. Pengaturan build otomatis terdeteksi melalui `vercel.json`:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Tidak perlu menambahkan Environment Variable apa pun.
4. Klik **Deploy**. Setelah selesai, aplikasi langsung dapat diakses dari HP Android maupun laptop tanpa error backend/404.
