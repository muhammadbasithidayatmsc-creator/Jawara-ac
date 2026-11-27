import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  CreditCard,
  Edit2,
  FileText,
  History,
  MessageCircle,
  Plus,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { api, formatApiError } from '../../lib/api';
import {
  buildOrderWhatsAppMessage,
  buildWhatsAppLink,
  formatDateID,
  formatDateTimeID,
  formatNumberID,
  formatRupiah,
  todayISO,
} from '../../lib/format';
import {
  ORDER_STATUSES,
  type BusinessSettings,
  type Invoice,
  type Order,
  type OrderItem,
  type OrderStatus,
  type OrderStatusHistory,
  type Payment,
  type PaymentMethod,
} from '../../types/database';
import { InvoicePreviewModal } from '../invoices/InvoicePreviewModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { OrderStatusLabel, PaymentStatusLabel } from '../ui/StatusBadge';
import { useToast } from '../ui/Toast';

interface OrderDetailModalProps {
  order: Order | null;
  settings: BusinessSettings | null;
  onClose: () => void;
  onEditOrder: (order: Order) => void;
  onOrderUpdated: (updated: Order) => void;
  onOrderDeleted: (orderId: string) => void;
}

type DetailTab = 'summary' | 'items' | 'payments' | 'invoice';

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  settings,
  onClose,
  onEditOrder,
  onOrderUpdated,
  onOrderDeleted,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<DetailTab>('summary');
  const [currentOrder, setCurrentOrder] = useState<Order | null>(order);

  const [items, setItems] = useState<OrderItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('Baru');
  const [statusNote, setStatusNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [workName, setWorkName] = useState('');
  const [workDesc, setWorkDesc] = useState('');
  const [workQty, setWorkQty] = useState('1');
  const [workUnit, setWorkUnit] = useState('Unit');
  const [workPrice, setWorkPrice] = useState('0');
  const [savingItem, setSavingItem] = useState(false);

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [payDate, setPayDate] = useState(todayISO());
  const [payNotes, setPayNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const [manualInvoiceNo, setManualInvoiceNo] = useState('');
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);

  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [voidTarget, setVoidTarget] = useState<Payment | null>(null);
  const [voidingPayment, setVoidingPayment] = useState(false);

  const fetchDetails = useCallback(
    async (orderId: string) => {
      setLoadingData(true);
      try {
        const res = await api.getOrderDetails(orderId);
        setCurrentOrder(res.order);
        setSelectedStatus(res.order.status);
        onOrderUpdated(res.order);

        setItems(res.items);
        setPayments(res.payments);
        setHistory(res.history);
        setInvoice(res.invoice);
        setManualInvoiceNo(res.order.invoice_number || '');

        const rem = Math.max(0, Number(res.order.total_amount) - Number(res.order.paid_amount));
        setPayAmount(rem > 0 ? String(rem) : '');
      } catch (err) {
        showToast('error', formatApiError(err, 'Gagal memuat detail order.'));
      } finally {
        setLoadingData(false);
      }
    },
    [onOrderUpdated, showToast]
  );

  useEffect(() => {
    if (order) {
      setCurrentOrder(order);
      setSelectedStatus(order.status);
      setActiveTab('summary');
      void fetchDetails(order.id);
    } else {
      setCurrentOrder(null);
    }
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const itemPreviewSubtotal = useMemo(() => {
    const q = Math.max(0, Number(workQty) || 0);
    const p = Math.max(0, Number(workPrice) || 0);
    return q * p;
  }, [workQty, workPrice]);

  if (!currentOrder) return null;

  const remainingAmount = Math.max(
    0,
    Number(currentOrder.total_amount) - Number(currentOrder.paid_amount)
  );

  const handleUpdateStatus = async () => {
    if (selectedStatus === currentOrder.status && !statusNote.trim()) {
      showToast('info', 'Pilih status baru atau isi catatan perubahan.');
      return;
    }
    setUpdatingStatus(true);
    try {
      await api.updateOrderStatus(currentOrder.id, selectedStatus, statusNote.trim());
      setStatusNote('');
      await fetchDetails(currentOrder.id);
      showToast('success', `Status order berhasil diubah menjadi ${selectedStatus}.`);
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal memperbarui status order.'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const resetItemForm = () => {
    setEditingItem(null);
    setWorkName('');
    setWorkDesc('');
    setWorkQty('1');
    setWorkUnit('Unit');
    setWorkPrice('0');
  };

  const handleEditItem = (item: OrderItem) => {
    setEditingItem(item);
    setWorkName(item.work_name);
    setWorkDesc(item.description || '');
    setWorkQty(String(item.quantity));
    setWorkUnit(item.unit || 'Unit');
    setWorkPrice(String(item.unit_price));
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workName.trim()) {
      showToast('error', 'Nama pekerjaan wajib diisi.');
      return;
    }
    const qty = Number(workQty);
    const price = Number(workPrice);
    if (Number.isNaN(qty) || qty <= 0) {
      showToast('error', 'Jumlah harus lebih dari 0.');
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      showToast('error', 'Harga satuan tidak boleh negatif.');
      return;
    }

    setSavingItem(true);
    try {
      if (editingItem) {
        await api.updateOrderItem(editingItem.id, {
          work_name: workName.trim(),
          description: workDesc.trim(),
          quantity: qty,
          unit: workUnit.trim() || 'Unit',
          unit_price: price,
        });
        showToast('success', 'Rincian pekerjaan berhasil diperbarui.');
      } else {
        await api.addOrderItem(currentOrder.id, {
          work_name: workName.trim(),
          description: workDesc.trim(),
          quantity: qty,
          unit: workUnit.trim() || 'Unit',
          unit_price: price,
          sort_order: items.length + 1,
        });
        showToast('success', 'Rincian pekerjaan berhasil ditambahkan.');
      }

      resetItemForm();
      await fetchDetails(currentOrder.id);
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal menyimpan rincian pekerjaan.'));
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await api.deleteOrderItem(itemId);
      showToast('success', 'Item pekerjaan dihapus.');
      await fetchDetails(currentOrder.id);
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal menghapus item pekerjaan.'));
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(payAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      showToast('error', 'Nominal pembayaran harus lebih dari 0.');
      return;
    }

    setSavingPayment(true);
    try {
      await api.recordPayment({
        order_id: currentOrder.id,
        amount,
        payment_method: payMethod,
        payment_date: payDate ? `${payDate}T12:00:00Z` : new Date().toISOString(),
        notes: payNotes.trim(),
        invoice_number: manualInvoiceNo.trim() || null,
      });

      setPayNotes('');
      await fetchDetails(currentOrder.id);
      showToast('success', `Pembayaran ${formatRupiah(amount)} (${payMethod}) berhasil dicatat.`);
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal mencatat pembayaran.'));
    } finally {
      setSavingPayment(false);
    }
  };

  const handleConfirmVoidPayment = async () => {
    if (!voidTarget) return;
    setVoidingPayment(true);
    try {
      await api.voidPayment(voidTarget.id);
      setVoidTarget(null);
      await fetchDetails(currentOrder.id);
      showToast('success', 'Transaksi pembayaran berhasil dibatalkan (void) & saldo dihitung ulang.');
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal membatalkan pembayaran.'));
    } finally {
      setVoidingPayment(false);
    }
  };

  const handleCreateOrSyncInvoice = async () => {
    setCreatingInvoice(true);
    try {
      const { invoice: synced } = await api.upsertInvoice({
        order_id: currentOrder.id,
        invoice_number: manualInvoiceNo.trim() || undefined,
      });
      await fetchDetails(currentOrder.id);
      showToast('success', `Invoice ${synced.invoice_number} berhasil dibuat & disinkronkan.`);
      setInvoicePreviewOpen(true);
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal membuat invoice.'));
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleArchiveToggle = async () => {
    try {
      const nextVal = !currentOrder.is_archived;
      await api.toggleArchiveOrder(currentOrder.id, nextVal);
      showToast(
        'success',
        nextVal ? 'Order berhasil diarsipkan.' : 'Order berhasil dikembalikan dari arsip.'
      );
      await fetchDetails(currentOrder.id);
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal mengubah status arsip order.'));
    }
  };

  const handleDeleteOrder = async () => {
    setDeletingOrder(true);
    try {
      await api.deleteOrder(currentOrder.id);
      showToast('success', `Order ${currentOrder.order_number} berhasil dihapus.`);
      setConfirmDeleteOrder(false);
      onOrderDeleted(currentOrder.id);
      onClose();
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal menghapus order.'));
    } finally {
      setDeletingOrder(false);
    }
  };

  const waMessage = buildOrderWhatsAppMessage(currentOrder, settings);
  const waLink = buildWhatsAppLink(currentOrder.customer_whatsapp, waMessage);

  return (
    <>
      <div className="no-print fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-[1px]">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
          <div className="px-5 py-4 bg-navy-900 text-white flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono font-bold text-base sm:text-lg">
                  {currentOrder.order_number}
                </span>
                <OrderStatusLabel status={currentOrder.status} />
                <PaymentStatusLabel status={currentOrder.payment_status} />
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 truncate">
                {currentOrder.customer_name} · {currentOrder.service_name}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white shrink-0"
              aria-label="Tutup detail order"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 sm:px-5 pt-2.5 bg-slate-50 border-b border-slate-200 flex gap-1 overflow-x-auto">
            {[
              { id: 'summary' as DetailTab, label: 'Ringkasan & Status', icon: History },
              { id: 'items' as DetailTab, label: `Rincian Pekerjaan (${items.length})`, icon: Wrench },
              { id: 'payments' as DetailTab, label: 'Pembayaran', icon: CreditCard },
              { id: 'invoice' as DetailTab, label: 'Invoice', icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {loadingData && (
              <div className="text-xs text-slate-500">Menyinkronkan data dari server...</div>
            )}

            {activeTab === 'summary' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEditOrder(currentOrder)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Order</span>
                  </button>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Hubungi WhatsApp</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleArchiveToggle}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>{currentOrder.is_archived ? 'Pulihkan Arsip' : 'Arsipkan'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOrder(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Order</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-sm">
                    <h4 className="font-semibold text-slate-900">Informasi Pelanggan &amp; Lokasi</h4>
                    <div className="text-xs space-y-1.5 text-slate-600">
                      <p>
                        Nama: <strong className="text-slate-900">{currentOrder.customer_name}</strong>
                      </p>
                      <p>
                        WhatsApp:{' '}
                        <strong className="text-slate-900 font-mono">
                          {currentOrder.customer_whatsapp}
                        </strong>
                      </p>
                      <p>
                        Alamat Service:{' '}
                        <strong className="text-slate-900">
                          {currentOrder.service_address || '-'}
                        </strong>
                      </p>
                      <p>
                        Keluhan:{' '}
                        <strong className="text-slate-900">{currentOrder.complaint || '-'}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-sm">
                    <h4 className="font-semibold text-slate-900">Jadwal, Teknisi &amp; Tagihan</h4>
                    <div className="text-xs space-y-1.5 text-slate-600">
                      <p>
                        Pelayanan: <strong className="text-slate-900">{currentOrder.service_name}</strong>
                      </p>
                      <p>
                        Jadwal:{' '}
                        <strong className="text-slate-900">
                          {formatDateID(currentOrder.service_date)}
                          {currentOrder.service_time
                            ? `, ${currentOrder.service_time.slice(0, 5)} WIB`
                            : ''}
                        </strong>
                      </p>
                      <p>
                        Teknisi:{' '}
                        <strong className="text-slate-900">
                          {currentOrder.technician_name || 'Belum ditugaskan'}
                        </strong>
                      </p>
                      <p>
                        Total Tagihan:{' '}
                        <strong className="text-blue-700 font-mono tabular-nums">
                          {formatRupiah(currentOrder.total_amount)}
                        </strong>{' '}
                        (Dibayar: {formatRupiah(currentOrder.paid_amount)} · Sisa:{' '}
                        {formatRupiah(remainingAmount)})
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <h4 className="text-sm font-semibold text-slate-900">Ubah Status Order Manual</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                      className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-medium bg-white"
                    >
                      {ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Catatan perubahan (opsional)"
                      className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleUpdateStatus}
                      disabled={updatingStatus}
                      className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
                    >
                      {updatingStatus ? 'Menyimpan...' : 'Simpan Status'}
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2.5">
                    Histori Perubahan Status
                  </h4>
                  {history.length === 0 ? (
                    <p className="text-xs text-slate-500">Belum ada catatan perubahan status.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-200">
                      {history.map((h) => (
                        <div
                          key={h.id}
                          className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">
                              {h.previous_status ? `${h.previous_status} → ${h.new_status}` : h.new_status}
                            </span>
                            {h.notes && <p className="text-slate-600 mt-0.5">{h.notes}</p>}
                          </div>
                          <span className="text-slate-500 font-mono shrink-0">
                            {formatDateTimeID(h.changed_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'items' && (
              <div className="space-y-5">
                <form
                  onSubmit={handleSaveItem}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900">
                      {editingItem ? 'Edit Rincian Pekerjaan' : 'Tambah Rincian Pekerjaan'}
                    </h4>
                    {editingItem && (
                      <button
                        type="button"
                        onClick={resetItemForm}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        Batal Edit
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Nama Pekerjaan *
                      </label>
                      <input
                        type="text"
                        value={workName}
                        onChange={(e) => setWorkName(e.target.value)}
                        placeholder="Contoh: Cuci AC Split 1 PK"
                        required
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Deskripsi Pekerjaan
                      </label>
                      <input
                        type="text"
                        value={workDesc}
                        onChange={(e) => setWorkDesc(e.target.value)}
                        placeholder="Keterangan singkat (opsional)"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Jumlah *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={workQty}
                        onChange={(e) => setWorkQty(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Satuan</label>
                      <input
                        type="text"
                        value={workUnit}
                        onChange={(e) => setWorkUnit(e.target.value)}
                        placeholder="Unit / Pcs"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Harga Satuan (Rp) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={workPrice}
                        onChange={(e) => setWorkPrice(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums"
                      />
                    </div>
                    <div className="sm:col-span-2 flex flex-col justify-end">
                      <div className="text-xs text-slate-500 mb-1">
                        Subtotal:{' '}
                        <strong className="font-mono text-slate-900">
                          {formatRupiah(itemPreviewSubtotal)}
                        </strong>
                      </div>
                      <button
                        type="submit"
                        disabled={savingItem}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60 min-h-[40px]"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{savingItem ? 'Menyimpan...' : editingItem ? 'Update Item' : 'Tambah Item'}</span>
                      </button>
                    </div>
                  </div>
                </form>

                {items.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-500">
                    Belum ada rincian pekerjaan. Tambahkan item di atas untuk menghitung total pekerjaan otomatis.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                          <tr>
                            <th className="py-2.5 px-3 text-left font-semibold">Pekerjaan</th>
                            <th className="py-2.5 px-3 text-right font-semibold">Qty</th>
                            <th className="py-2.5 px-3 text-right font-semibold">Harga Satuan</th>
                            <th className="py-2.5 px-3 text-right font-semibold">Subtotal</th>
                            <th className="py-2.5 px-3 text-right font-semibold w-24">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {items.map((item) => (
                            <tr key={item.id}>
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-slate-900">{item.work_name}</div>
                                {item.description && (
                                  <div className="text-xs text-slate-500">{item.description}</div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">
                                {formatNumberID(item.quantity)} {item.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">
                                {formatRupiah(item.unit_price)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                                {formatRupiah(item.subtotal)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditItem(item)}
                                    className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
                                    title="Edit item"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="p-1.5 rounded text-red-600 hover:bg-red-50"
                                    title="Hapus item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="sm:hidden divide-y divide-slate-200">
                      {items.map((item) => (
                        <div key={item.id} className="p-3.5 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-sm text-slate-900">{item.work_name}</div>
                              {item.description && (
                                <div className="text-xs text-slate-500">{item.description}</div>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleEditItem(item)}
                                className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 rounded text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-600 font-mono">
                            <span>
                              {formatNumberID(item.quantity)} {item.unit} × {formatRupiah(item.unit_price)}
                            </span>
                            <span className="font-bold text-slate-900">
                              {formatRupiah(item.subtotal)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Pekerjaan (Jasa)</span>
                    <span className="font-mono tabular-nums">{formatRupiah(currentOrder.labor_cost)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Biaya Tambahan</span>
                    <span className="font-mono tabular-nums">{formatRupiah(currentOrder.additional_cost)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Biaya Material</span>
                    <span className="font-mono tabular-nums">{formatRupiah(currentOrder.material_cost)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Diskon</span>
                    <span className="font-mono tabular-nums">- {formatRupiah(currentOrder.discount)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-base">
                    <span>Total Tagihan</span>
                    <span className="font-mono tabular-nums text-blue-700">
                      {formatRupiah(currentOrder.total_amount)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-500">Total Tagihan</div>
                    <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                      {formatRupiah(currentOrder.total_amount)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-500">Total Dibayar</div>
                    <div className="text-lg font-bold text-emerald-700 font-mono tabular-nums mt-1">
                      {formatRupiah(currentOrder.paid_amount)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-500">Sisa Tagihan</div>
                    <div
                      className={`text-lg font-bold font-mono tabular-nums mt-1 ${
                        remainingAmount > 0 ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatRupiah(remainingAmount)}
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={handleRecordPayment}
                  className="p-4 rounded-xl border border-slate-200 bg-white space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">
                      Catat Pembayaran (Lunas / DP / Pelunasan)
                    </h4>
                    {remainingAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setPayAmount(String(remainingAmount))}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Isi Nominal Sisa ({formatRupiah(remainingAmount)})
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Nominal Pembayaran (Rp) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        placeholder="Contoh: 100000"
                        required
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Metode Pembayaran *
                      </label>
                      <select
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                      >
                        <option value="CASH">CASH / TUNAI</option>
                        <option value="TRANSFER">TRANSFER BANK</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Tanggal Pembayaran
                      </label>
                      <input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Keterangan (DP / Pelunasan)
                      </label>
                      <input
                        type="text"
                        value={payNotes}
                        onChange={(e) => setPayNotes(e.target.value)}
                        placeholder="DP / Pelunasan / Lunas"
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingPayment}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{savingPayment ? 'Menyimpan...' : 'Simpan Pembayaran'}</span>
                    </button>
                  </div>
                </form>

                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2.5">
                    Histori Transaksi Pembayaran Order Ini
                  </h4>
                  {payments.length === 0 ? (
                    <div className="p-5 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                      Belum ada transaksi pembayaran untuk order ini.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-200">
                      {payments.map((p) => (
                        <div
                          key={p.id}
                          className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                            p.is_void ? 'bg-slate-50 opacity-60' : 'bg-white'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                                {formatRupiah(p.amount)}
                              </span>
                              <span className="text-xs font-semibold text-blue-700">
                                {p.payment_method}
                              </span>
                              {p.is_void && (
                                <span className="text-xs font-semibold text-red-600">(DIBATALKAN)</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formatDateID(p.payment_date)}
                              {p.notes ? ` · ${p.notes}` : ''}
                            </p>
                          </div>
                          {!p.is_void && (
                            <button
                              type="button"
                              onClick={() => setVoidTarget(p)}
                              className="self-start sm:self-center text-xs font-semibold text-red-600 hover:text-red-700 px-2.5 py-1.5 rounded-lg border border-red-200 hover:bg-red-50"
                            >
                              Batalkan (Void)
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'invoice' && (
              <div className="space-y-4">
                <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">
                      {invoice ? `Invoice ${invoice.invoice_number}` : 'Terbitkan Invoice Order'}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Nomor invoice dapat diisi manual atau dibuat otomatis oleh sistem (bersifat unik).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nomor Invoice
                      </label>
                      <input
                        type="text"
                        value={manualInvoiceNo}
                        onChange={(e) => setManualInvoiceNo(e.target.value)}
                        placeholder="Kosongkan untuk generate otomatis"
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-mono"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={handleCreateOrSyncInvoice}
                        disabled={creatingInvoice}
                        className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold min-h-[42px] disabled:opacity-60"
                      >
                        {creatingInvoice
                          ? 'Memproses...'
                          : invoice
                          ? 'Sinkronkan & Buka Invoice'
                          : 'Buat & Lihat Invoice'}
                      </button>
                      {invoice && (
                        <button
                          type="button"
                          onClick={() => setInvoicePreviewOpen(true)}
                          className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-sm font-semibold min-h-[42px]"
                        >
                          Preview / Cetak
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <InvoicePreviewModal
        open={invoicePreviewOpen}
        invoice={invoice}
        orderNumber={currentOrder.order_number}
        items={items}
        payments={payments}
        settings={settings}
        onClose={() => setInvoicePreviewOpen(false)}
        onInvoiceUpdated={(updated) => {
          setInvoice(updated);
          void fetchDetails(currentOrder.id);
        }}
      />

      <ConfirmModal
        open={confirmDeleteOrder}
        title={`Hapus Order ${currentOrder.order_number}?`}
        description="Order, rincian pekerjaan, invoice, dan riwayat pembayaran terkait order ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Ya, Hapus Order"
        loading={deletingOrder}
        onConfirm={handleDeleteOrder}
        onCancel={() => setConfirmDeleteOrder(false)}
      />

      <ConfirmModal
        open={Boolean(voidTarget)}
        title="Batalkan Transaksi Pembayaran?"
        description={
          voidTarget
            ? `Pembayaran sebesar ${formatRupiah(voidTarget.amount)} (${voidTarget.payment_method}) akan ditandai void dan sisa tagihan order akan dihitung ulang.`
            : ''
        }
        confirmLabel="Ya, Batalkan Pembayaran"
        loading={voidingPayment}
        onConfirm={handleConfirmVoidPayment}
        onCancel={() => setVoidTarget(null)}
      />
    </>
  );
};
