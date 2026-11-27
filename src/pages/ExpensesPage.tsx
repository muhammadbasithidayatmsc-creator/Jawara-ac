import React, { useMemo, useState } from 'react';
import { Edit2, Plus, Search, Trash2, X } from 'lucide-react';
import { formatDateID, formatRupiah, todayISO } from '../lib/format';
import { api, formatApiError } from '../lib/api';
import type { Expense, ExpenseCategory, PaymentMethod } from '../types/database';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useToast } from '../components/ui/Toast';

interface ExpensesPageProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

const FALLBACK_CATEGORIES = [
  'Pembelian sparepart',
  'Transportasi',
  'Operasional',
  'Gaji teknisi',
  'Peralatan',
  'Lain-lain',
];

export const ExpensesPage: React.FC<ExpensesPageProps> = ({
  expenses,
  categories,
  loading,
  onRefresh,
}) => {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [expenseDate, setExpenseDate] = useState(todayISO());
  const [title, setTitle] = useState('');
  const [categoryName, setCategoryName] = useState(FALLBACK_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categoryOptions = useMemo(() => {
    if (categories.length > 0) return categories.map((c) => c.name);
    return FALLBACK_CATEGORIES;
  }, [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (categoryFilter !== 'ALL' && e.category_name !== categoryFilter) return false;
      if (startDate && e.expense_date < startDate) return false;
      if (endDate && e.expense_date > endDate) return false;
      if (q) {
        const hay = [e.title, e.category_name, e.notes].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, categoryFilter, startDate, endDate, search]);

  const totalFiltered = useMemo(
    () => filtered.reduce((s, e) => s + Number(e.amount), 0),
    [filtered]
  );

  const openAdd = () => {
    setEditing(null);
    setExpenseDate(todayISO());
    setTitle('');
    setCategoryName(categoryOptions[0] || 'Operasional');
    setAmount('');
    setPaymentMethod('CASH');
    setNotes('');
    setModalOpen(true);
  };

  const openEdit = (exp: Expense) => {
    setEditing(exp);
    setExpenseDate(exp.expense_date);
    setTitle(exp.title);
    setCategoryName(exp.category_name);
    setAmount(String(exp.amount));
    setPaymentMethod(exp.payment_method);
    setNotes(exp.notes || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!title.trim() || Number.isNaN(numAmount) || numAmount < 0) {
      showToast('error', 'Nama pengeluaran dan nominal valid wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        expense_date: expenseDate || todayISO(),
        title: title.trim(),
        category_name: categoryName,
        amount: numAmount,
        payment_method: paymentMethod,
        notes: notes.trim(),
      };

      if (editing) {
        await api.updateExpense(editing.id, payload);
        showToast('success', 'Pengeluaran berhasil diperbarui.');
      } else {
        await api.createExpense(payload);
        showToast('success', 'Pengeluaran baru berhasil dicatat.');
      }

      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal menyimpan pengeluaran.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteExpense(deleteTarget.id);
      showToast('success', `Pengeluaran "${deleteTarget.title}" berhasil dihapus.`);
      setDeleteTarget(null);
      await onRefresh();
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal menghapus pengeluaran.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Summary & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs text-slate-500 block">Total Pengeluaran (Sesuai Filter)</span>
            <span className="text-2xl font-bold text-red-700 font-mono tabular-nums">
              {formatRupiah(totalFiltered)}
            </span>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold min-h-[42px]"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Pengeluaran</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pengeluaran..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
          >
            <option value="ALL">Semua Kategori</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            title="Dari tanggal"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              title="Sampai tanggal"
            />
            {(startDate || endDate || categoryFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setCategoryFilter('ALL');
                }}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-600"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Memuat data pengeluaran...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
          <p className="text-sm text-slate-600">Belum ada data pengeluaran tercatat.</p>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Pengeluaran Pertama</span>
          </button>
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-4 text-left font-semibold">Tanggal</th>
                  <th className="py-3 px-4 text-left font-semibold">Nama Pengeluaran</th>
                  <th className="py-3 px-4 text-left font-semibold">Kategori</th>
                  <th className="py-3 px-4 text-left font-semibold">Metode</th>
                  <th className="py-3 px-4 text-right font-semibold">Nominal</th>
                  <th className="py-3 px-4 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {formatDateID(exp.expense_date)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{exp.title}</div>
                      {exp.notes && <div className="text-xs text-slate-500">{exp.notes}</div>}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">
                      {exp.category_name}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                      {exp.payment_method}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-red-700">
                      {formatRupiah(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(exp)}
                          className="p-2 rounded-lg text-blue-700 hover:bg-blue-50"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(exp)}
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {filtered.map((exp) => (
              <div key={exp.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900">{exp.title}</div>
                    <div className="text-xs text-slate-500">
                      {formatDateID(exp.expense_date)} · {exp.category_name}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-red-700 text-sm">
                    {formatRupiah(exp.amount)}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-600">{exp.payment_method}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(exp)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(exp)}
                      className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Add / Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 bg-navy-900 text-white flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editing ? 'Edit Pengeluaran' : 'Catat Pengeluaran Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal *
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori *
                  </label>
                  <select
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Pengeluaran *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Contoh: Beli Freon R32 1 Tabung"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nominal (Rp) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    placeholder="Contoh: 250000"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Metode Pembayaran *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    <option value="CASH">CASH / TUNAI</option>
                    <option value="TRANSFER">TRANSFER</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan (opsional)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={`Hapus Pengeluaran "${deleteTarget?.title || ''}"?`}
        description="Data pengeluaran akan dihapus permanen dan laporan saldo bersih akan disesuaikan."
        confirmLabel="Ya, Hapus"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
