import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Database,
  Download,
  KeyRound,
  Save,
  ShieldCheck,
  Store,
  Upload,
} from 'lucide-react';
import { api, formatApiError } from '../lib/api';
import type { BusinessSettings, Profile } from '../types/database';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useToast } from '../components/ui/Toast';

interface SettingsPageProps {
  settings: BusinessSettings | null;
  profile: Profile | null;
  onRefresh: () => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, profile, onRefresh }) => {
  const { showToast } = useToast();

  // Business settings state
  const [businessName, setBusinessName] = useState('JAWARA AC');
  const [tagline, setTagline] = useState('Service AC Lebih Mudah, Bisnis Lebih Maju');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [orderPrefix, setOrderPrefix] = useState('ORD-JWR');
  const [invoicePrefix, setInvoicePrefix] = useState('INV-JWR');
  const [invoiceFooterNote, setInvoiceFooterNote] = useState('');
  const [savingBiz, setSavingBiz] = useState(false);

  // Admin profile & password state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Database backup & restore state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoringDb, setRestoringDb] = useState(false);

  useEffect(() => {
    if (settings) {
      setBusinessName(settings.business_name);
      setTagline(settings.tagline);
      setPhone(settings.phone || '');
      setWhatsapp(settings.whatsapp || '');
      setEmail(settings.email || '');
      setAddress(settings.address || '');
      setBankName(settings.bank_name || '');
      setBankAccountNumber(settings.bank_account_number || '');
      setBankAccountName(settings.bank_account_name || '');
      setOrderPrefix(settings.order_prefix || 'ORD-JWR');
      setInvoicePrefix(settings.invoice_prefix || 'INV-JWR');
      setInvoiceFooterNote(settings.invoice_footer_note || '');
    }
  }, [settings]);

  useEffect(() => {
    if (profile) {
      setAdminEmail(profile.email || '');
      setAdminName(profile.full_name || '');
      setAdminPhone(profile.phone || '');
    }
  }, [profile]);

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBiz(true);
    try {
      const payload = {
        business_name: businessName.trim() || 'JAWARA AC',
        tagline: tagline.trim() || 'Service AC Lebih Mudah, Bisnis Lebih Maju',
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        address: address.trim(),
        bank_name: bankName.trim(),
        bank_account_number: bankAccountNumber.trim(),
        bank_account_name: bankAccountName.trim(),
        order_prefix: orderPrefix.trim() || 'ORD-JWR',
        invoice_prefix: invoicePrefix.trim() || 'INV-JWR',
        invoice_footer_note: invoiceFooterNote.trim(),
      };

      await api.updateSettings(payload);
      await onRefresh();
      showToast('success', 'Pengaturan bisnis berhasil disimpan.');
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal menyimpan pengaturan bisnis.'));
    } finally {
      setSavingBiz(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    try {
      await api.updateProfile({
        email: adminEmail.trim().toLowerCase(),
        full_name: adminName.trim() || 'Admin JAWARA AC',
        phone: adminPhone.trim(),
      });

      await onRefresh();
      showToast('success', 'Profil Admin berhasil diperbarui.');
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal memperbarui profil Admin.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('error', 'Password baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('error', 'Konfirmasi password tidak cocok.');
      return;
    }

    setSavingPassword(true);
    try {
      await api.changePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      showToast('success', 'Password Admin berhasil diperbarui.');
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal memperbarui password.'));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDownloadBackup = async () => {
    setDownloadingBackup(true);
    try {
      await api.downloadBackup();
      showToast('success', 'File backup database (.json) berhasil diunduh.');
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal mengunduh backup database.'));
    } finally {
      setDownloadingBackup(false);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) {
      showToast('error', 'Pilih file backup JAWARA AC dengan ekstensi .json.');
      e.target.value = '';
      return;
    }
    setRestoreFile(file);
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!restoreFile) return;
    setRestoringDb(true);
    try {
      const res = await api.restoreDatabase(restoreFile);
      setRestoreFile(null);
      await onRefresh();
      showToast('success', res.message || 'Database berhasil dipulihkan dari file JSON.');
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal memulihkan database.'));
    } finally {
      setRestoringDb(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Business Settings */}
      <form
        onSubmit={handleSaveBusiness}
        className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5"
      >
        <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
          <Store className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">Identitas Bisnis &amp; Invoice</h2>
            <p className="text-xs text-slate-500">
              Informasi ini tampil pada Invoice PDF, pesan WhatsApp, dan penomoran otomatis.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Usaha</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Bisnis</label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="0812xxxxxxxx"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Telepon</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Bisnis</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Kantor</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Bank</label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="BCA / Mandiri / BRI"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">No. Rekening</label>
            <input
              type="text"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Atas Nama Rekening</label>
            <input
              type="text"
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Prefix Nomor Order</label>
            <input
              type="text"
              value={orderPrefix}
              onChange={(e) => setOrderPrefix(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Prefix Nomor Invoice</label>
            <input
              type="text"
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Kaki Invoice
            </label>
            <textarea
              rows={2}
              value={invoiceFooterNote}
              onChange={(e) => setInvoiceFooterNote(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingBiz}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{savingBiz ? 'Menyimpan...' : 'Simpan Pengaturan Bisnis'}</span>
          </button>
        </div>
      </form>

      {/* Admin Account */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <form
          onSubmit={handleSaveProfile}
          className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Profil Akun Admin</h3>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Login</label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Admin</label>
            <input
              type="text"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor HP Admin</label>
            <input
              type="text"
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {savingProfile ? 'Menyimpan...' : 'Update Profil Admin'}
          </button>
        </form>

        <form
          onSubmit={handleChangePassword}
          className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <KeyRound className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Ubah Password Admin</h3>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password Baru</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Konfirmasi Password Baru
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password baru"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="w-full py-2.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold disabled:opacity-60"
          >
            {savingPassword ? 'Memperbarui...' : 'Simpan Password Baru'}
          </button>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Login Admin lokal berfungsi untuk membatasi akses antarmuka di browser perangkat ini dan dapat diubah kapan saja.
          </p>
        </form>
      </div>

      {/* Backup & Restore Database JSON */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
          <Database className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Backup &amp; Restore Database (JSON)</h3>
            <p className="text-xs text-slate-500">
              Simpan salinan permanen seluruh data pelanggan, teknisi, order, invoice, pembayaran, pengeluaran, dan inventaris dalam satu file <span className="font-mono font-semibold">.json</span>.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            Lakukan backup JSON secara berkala sebelum membersihkan data browser atau memindahkan data ke perangkat lain (HP/laptop). Saat restore dijalankan, sistem akan memvalidasi struktur JSON dan memulihkan seluruh data ke database lokal browser.
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleDownloadBackup}
            disabled={downloadingBackup}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60 min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            <span>{downloadingBackup ? 'Menyiapkan Backup...' : 'Download Backup (.json)'}</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={restoringDb}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold disabled:opacity-60 min-h-[44px]"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>{restoringDb ? 'Memulihkan Database...' : 'Restore dari File (.json)'}</span>
          </button>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(restoreFile)}
        title="Pulihkan Database dari Backup JSON?"
        description={
          restoreFile
            ? `File "${restoreFile.name}" (${Math.max(1, Math.round(restoreFile.size / 1024))} KB) akan menggantikan seluruh data aktif di browser ini setelah validasi struktur JSON berhasil.`
            : ''
        }
        confirmLabel="Ya, Pulihkan Database"
        loading={restoringDb}
        onConfirm={handleConfirmRestore}
        onCancel={() => setRestoreFile(null)}
      />
    </div>
  );
};
