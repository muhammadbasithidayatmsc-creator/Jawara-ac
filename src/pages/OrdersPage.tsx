import React, { useMemo, useState } from 'react';
import {
  Archive,
  Edit2,
  Eye,
  MessageCircle,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  buildOrderWhatsAppMessage,
  buildWhatsAppLink,
  formatDateID,
  formatRupiah,
} from '../lib/format';
import { api, formatApiError } from '../lib/api';
import {
  ORDER_STATUSES,
  type BusinessSettings,
  type Order,
  type OrderStatus,
  type Technician,
} from '../types/database';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { OrderStatusLabel, PaymentStatusLabel } from '../components/ui/StatusBadge';
import { useToast } from '../components/ui/Toast';

interface OrdersPageProps {
  orders: Order[];
  technicians: Technician[];
  settings: BusinessSettings | null;
  loading: boolean;
  onNewOrder: () => void;
  onEditOrder: (order: Order) => void;
  onSelectOrder: (order: Order) => void;
  onRefresh: () => Promise<void>;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({
  orders,
  technicians,
  settings,
  loading,
  onNewOrder,
  onEditOrder,
  onSelectOrder,
  onRefresh,
}) => {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [techFilter, setTechFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (Boolean(o.is_archived) !== showArchived) return false;
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (techFilter !== 'ALL' && (o.technician_id || 'UNASSIGNED') !== techFilter) return false;
      if (dateFilter && o.service_date !== dateFilter) return false;
      if (q) {
        const hay = [
          o.order_number,
          o.invoice_number || '',
          o.customer_name,
          o.customer_whatsapp,
          o.service_name,
          o.technician_name,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, techFilter, dateFilter, showArchived]);

  const handleQuickStatusChange = async (order: Order, nextStatus: OrderStatus) => {
    if (order.status === nextStatus) return;
    setUpdatingStatusId(order.id);
    try {
      await api.updateOrderStatus(order.id, nextStatus, 'Diubah dari daftar order');
      await onRefresh();
      showToast('success', `Status ${order.order_number} diubah menjadi ${nextStatus}.`);
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal mengubah status order.'));
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteOrder(deleteTarget.id);
      showToast('success', `Order ${deleteTarget.order_number} berhasil dihapus.`);
      setDeleteTarget(null);
      await onRefresh();
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal menghapus order.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no. order, invoice, nama pelanggan, WA, atau layanan..."
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowArchived((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border text-xs font-semibold min-h-[42px] ${
                showArchived
                  ? 'bg-navy-900 text-white border-navy-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Archive className="w-4 h-4" />
              <span>{showArchived ? 'Tampilkan Aktif' : 'Lihat Arsip'}</span>
            </button>
            <button
              type="button"
              onClick={onNewOrder}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold min-h-[42px]"
            >
              <Plus className="w-4 h-4" />
              <span>Order Baru</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white"
          >
            <option value="ALL">Semua Status Order</option>
            {ORDER_STATUSES.map((st) => (
              <option key={st} value={st}>
                Status: {st}
              </option>
            ))}
          </select>

          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white"
          >
            <option value="ALL">Semua Teknisi</option>
            <option value="UNASSIGNED">Belum Ditugaskan</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                Teknisi: {t.name}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Memuat data order...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700">
            {showArchived
              ? 'Tidak ada order yang diarsipkan.'
              : 'Belum ada order yang sesuai dengan filter.'}
          </p>
          {!showArchived && (
            <button
              type="button"
              onClick={onNewOrder}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Order Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <tr>
                    <th className="py-3 px-4 text-left font-semibold">No. Order &amp; Jadwal</th>
                    <th className="py-3 px-4 text-left font-semibold">Pelanggan</th>
                    <th className="py-3 px-4 text-left font-semibold">Pelayanan &amp; Teknisi</th>
                    <th className="py-3 px-4 text-left font-semibold">Status Order</th>
                    <th className="py-3 px-4 text-left font-semibold">Pembayaran</th>
                    <th className="py-3 px-4 text-right font-semibold">Total Tagihan</th>
                    <th className="py-3 px-4 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredOrders.map((ord) => {
                    const waLink = buildWhatsAppLink(
                      ord.customer_whatsapp,
                      buildOrderWhatsAppMessage(ord, settings)
                    );
                    return (
                      <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => onSelectOrder(ord)}
                            className="font-mono text-xs font-bold text-blue-700 hover:underline text-left"
                          >
                            {ord.order_number}
                          </button>
                          {ord.invoice_number && (
                            <div className="font-mono text-[11px] text-slate-500">
                              {ord.invoice_number}
                            </div>
                          )}
                          <div className="text-xs text-slate-500 mt-0.5">
                            {formatDateID(ord.service_date)}
                            {ord.service_time ? ` · ${ord.service_time.slice(0, 5)}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{ord.customer_name}</div>
                          <div className="text-xs text-slate-500 font-mono">{ord.customer_whatsapp}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 max-w-[220px] truncate">
                            {ord.service_name}
                          </div>
                          <div className="text-xs text-slate-500">
                            Teknisi: {ord.technician_name || 'Belum ditugaskan'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={ord.status}
                            disabled={updatingStatusId === ord.id}
                            onChange={(e) =>
                              handleQuickStatusChange(ord, e.target.value as OrderStatus)
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                          >
                            {ORDER_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <PaymentStatusLabel status={ord.payment_status} />
                          <div className="text-[11px] text-slate-500 font-mono mt-1 tabular-nums">
                            Bayar: {formatRupiah(ord.paid_amount)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                          {formatRupiah(ord.total_amount)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onSelectOrder(ord)}
                              title="Lihat Detail, Rincian & Pembayaran"
                              className="p-2 rounded-lg text-blue-700 hover:bg-blue-50"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditOrder(ord)}
                              title="Edit Order"
                              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Chat WhatsApp Pelanggan"
                              className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(ord)}
                              title="Hapus Order"
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
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map((ord) => {
              const waLink = buildWhatsAppLink(
                ord.customer_whatsapp,
                buildOrderWhatsAppMessage(ord, settings)
              );
              return (
                <div
                  key={ord.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => onSelectOrder(ord)}
                        className="font-mono text-sm font-bold text-blue-700"
                      >
                        {ord.order_number}
                      </button>
                      <p className="text-xs text-slate-500">
                        {formatDateID(ord.service_date)}
                        {ord.service_time ? ` · ${ord.service_time.slice(0, 5)}` : ''}
                      </p>
                    </div>
                    <PaymentStatusLabel status={ord.payment_status} />
                  </div>

                  <div>
                    <div className="font-semibold text-slate-900">{ord.customer_name}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{ord.service_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Teknisi: {ord.technician_name || 'Belum ditugaskan'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <OrderStatusLabel status={ord.status} />
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Total Tagihan</div>
                      <div className="font-mono font-bold text-slate-900 tabular-nums">
                        {formatRupiah(ord.total_amount)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onSelectOrder(ord)}
                      className="py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detail</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditOrder(ord)}
                      className="py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WA</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(ord)}
                      className="py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={`Hapus Order ${deleteTarget?.order_number || ''}?`}
        description="Seluruh rincian pekerjaan, invoice, dan riwayat pembayaran terkait order ini akan dihapus permanen."
        confirmLabel="Ya, Hapus"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
