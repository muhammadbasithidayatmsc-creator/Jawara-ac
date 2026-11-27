import React, { useMemo, useState } from 'react';
import { Edit2, History, MessageCircle, Plus, Search, Trash2, X } from 'lucide-react';
import { buildWhatsAppLink, formatDateID, formatRupiah } from '../lib/format';
import { api, formatApiError } from '../lib/api';
import type { Customer, Order } from '../types/database';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { OrderStatusLabel, PaymentStatusLabel } from '../components/ui/StatusBadge';
import { useToast } from '../components/ui/Toast';

interface CustomersPageProps {
  customers: Customer[];
  orders: Order[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onSelectOrder: (order: Order) => void;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({
  customers,
  orders,
  loading,
  onRefresh,
  onSelectOrder,
}) => {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const orderCountsByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => {
      map.set(o.customer_id, (map.get(o.customer_id) || 0) + 1);
    });
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.whatsapp, c.address, c.email].join(' ').toLowerCase().includes(q)
    );
  }, [customers, search]);

  const customerOrders = useMemo(() => {
    if (!historyCustomer) return [];
    return orders.filter((o) => o.customer_id === historyCustomer.id);
  }, [orders, historyCustomer]);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setWhatsapp('');
    setAddress('');
    setEmail('');
    setNotes('');
    setModalOpen(true);
  };

  const openEdit = (cust: Customer) => {
    setEditing(cust);
    setName(cust.name);
    setWhatsapp(cust.whatsapp);
    setAddress(cust.address || '');
    setEmail(cust.email || '');
    setNotes(cust.notes || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !whatsapp.trim()) {
      showToast('error', 'Nama pelanggan dan nomor WhatsApp wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        whatsapp: whatsapp.trim(),
        address: address.trim(),
        email: email.trim(),
        notes: notes.trim(),
      };

      if (editing) {
        await api.updateCustomer(editing.id, payload);
        showToast('success', `Data pelanggan ${payload.name} berhasil diperbarui.`);
      } else {
        await api.createCustomer(payload);
        showToast('success', `Pelanggan ${payload.name} berhasil ditambahkan.`);
      }

      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal menyimpan data pelanggan.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRequestDelete = (cust: Customer) => {
    const count = orderCountsByCustomer.get(cust.id) || 0;
    if (count > 0) {
      showToast(
        'error',
        `Pelanggan "${cust.name}" tidak dapat dihapus karena memiliki ${count} transaksi order terkait.`
      );
      return;
    }
    setDeleteTarget(cust);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteCustomer(deleteTarget.id);
      showToast('success', `Pelanggan ${deleteTarget.name} berhasil dihapus.`);
      setDeleteTarget(null);
      await onRefresh();
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal menghapus pelanggan.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pelanggan berdasarkan nama atau nomor WhatsApp..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
          />
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold min-h-[42px]"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pelanggan</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Memuat data pelanggan...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
          <p className="text-sm text-slate-600">Belum ada data pelanggan.</p>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pelanggan Pertama</span>
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-4 text-left font-semibold">Nama Pelanggan</th>
                  <th className="py-3 px-4 text-left font-semibold">WhatsApp</th>
                  <th className="py-3 px-4 text-left font-semibold">Alamat Lengkap</th>
                  <th className="py-3 px-4 text-right font-semibold">Total Order</th>
                  <th className="py-3 px-4 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((cust) => {
                  const count = orderCountsByCustomer.get(cust.id) || 0;
                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{cust.name}</div>
                        {cust.email && <div className="text-xs text-slate-500">{cust.email}</div>}
                        {cust.notes && <div className="text-xs text-slate-500">{cust.notes}</div>}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">{cust.whatsapp}</td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-[260px]">
                        {cust.address || '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-800">
                        {count}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setHistoryCustomer(cust)}
                            title="Lihat Riwayat Order"
                            className="p-2 rounded-lg text-slate-700 hover:bg-slate-100"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <a
                            href={buildWhatsAppLink(
                              cust.whatsapp,
                              `Halo Kak ${cust.name}, kami dari JAWARA AC.`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Chat WhatsApp"
                            className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => openEdit(cust)}
                            title="Edit Pelanggan"
                            className="p-2 rounded-lg text-blue-700 hover:bg-blue-50"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRequestDelete(cust)}
                            title="Hapus Pelanggan"
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((cust) => {
              const count = orderCountsByCustomer.get(cust.id) || 0;
              return (
                <div key={cust.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900">{cust.name}</div>
                      <div className="text-xs font-mono text-slate-600">{cust.whatsapp}</div>
                    </div>
                    <span className="text-xs font-mono font-semibold text-blue-700">
                      {count} order
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">{cust.address || '-'}</div>
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setHistoryCustomer(cust)}
                      className="py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                    >
                      Riwayat
                    </button>
                    <a
                      href={buildWhatsAppLink(
                        cust.whatsapp,
                        `Halo Kak ${cust.name}, kami dari JAWARA AC.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold text-center"
                    >
                      WA
                    </a>
                    <button
                      type="button"
                      onClick={() => openEdit(cust)}
                      className="py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestDelete(cust)}
                      className="py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal Add / Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 bg-navy-900 text-white flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editing ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru'}
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
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Pelanggan *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Contoh: Ibu Rina Wijaya"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor WhatsApp *
                </label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  required
                  placeholder="0812xxxxxxxx"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Lengkap
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Alamat lengkap rumah / kantor pelanggan"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email (Opsional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pelanggan@email.com"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan preferensi atau info gedung"
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
                  {saving ? 'Menyimpan...' : 'Simpan Pelanggan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Order History Modal */}
      {historyCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-navy-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Riwayat Order — {historyCustomer.name}</h3>
                <p className="text-xs text-slate-300 font-mono">{historyCustomer.whatsapp}</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryCustomer(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3">
              {customerOrders.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  Pelanggan ini belum memiliki riwayat order service.
                </p>
              ) : (
                customerOrders.map((ord) => (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => {
                      setHistoryCustomer(null);
                      onSelectOrder(ord);
                    }}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-700">
                          {ord.order_number}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDateID(ord.service_date)}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-slate-900 mt-0.5">
                        {ord.service_name}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <OrderStatusLabel status={ord.status} />
                      <PaymentStatusLabel status={ord.payment_status} />
                      <span className="font-mono text-sm font-bold text-slate-900 tabular-nums ml-1">
                        {formatRupiah(ord.total_amount)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={`Hapus Pelanggan ${deleteTarget?.name || ''}?`}
        description="Pelanggan ini belum memiliki transaksi order dan akan dihapus permanen."
        confirmLabel="Ya, Hapus"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
