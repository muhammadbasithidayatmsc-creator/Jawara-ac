import React, { useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, Plus, Search, Trash2, X } from 'lucide-react';
import { formatDateID, formatRupiah, todayISO } from '../lib/format';
import { api, formatApiError } from '../lib/api';
import type { Order, Payment, PaymentMethod } from '../types/database';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { PaymentStatusLabel } from '../components/ui/StatusBadge';
import { useToast } from '../components/ui/Toast';

interface PaymentsPageProps {
  orders: Order[];
  payments: Payment[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onSelectOrder: (order: Order) => void;
}

export const PaymentsPage: React.FC<PaymentsPageProps> = ({
  orders,
  payments,
  loading,
  onRefresh,
  onSelectOrder,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'ledger' | 'history'>('ledger');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BELUM BAYAR' | 'DP' | 'LUNAS'>('ALL');
  const [methodFilter, setMethodFilter] = useState<'ALL' | PaymentMethod>('ALL');
  const [dateFilter, setDateFilter] = useState('');

  // Modal record payment
  const [payModalOrder, setPayModalOrder] = useState<Order | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [payDate, setPayDate] = useState(todayISO());
  const [payNotes, setPayNotes] = useState('');
  const [manualInvoiceNo, setManualInvoiceNo] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  const [voidTarget, setVoidTarget] = useState<Payment | null>(null);
  const [voiding, setVoiding] = useState(false);

  const today = todayISO();

  const summary = useMemo(() => {
    const activeOrders = orders.filter((o) => !o.is_archived && o.status !== 'Dibatalkan');
    const totalTagihan = activeOrders.reduce((s, o) => s + Number(o.total_amount), 0);
    const totalDibayar = activeOrders.reduce((s, o) => s + Number(o.paid_amount), 0);
    const totalSisa = activeOrders.reduce(
      (s, o) => s + Math.max(0, Number(o.total_amount) - Number(o.paid_amount)),
      0
    );
    const todayPaid = payments
      .filter((p) => !p.is_void && p.payment_date.slice(0, 10) === today)
      .reduce((s, p) => s + Number(p.amount), 0);
    return { totalTagihan, totalDibayar, totalSisa, todayPaid };
  }, [orders, payments, today]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (o.is_archived || o.status === 'Dibatalkan') return false;
      if (statusFilter !== 'ALL' && o.payment_status !== statusFilter) return false;
      if (q) {
        const hay = [o.order_number, o.invoice_number || '', o.customer_name, o.service_name]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter]);

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (methodFilter !== 'ALL' && p.payment_method !== methodFilter) return false;
      if (dateFilter && p.payment_date.slice(0, 10) !== dateFilter) return false;
      if (q) {
        const hay = [p.order_number, p.invoice_number, p.customer_name, p.notes]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [payments, methodFilter, dateFilter, search]);

  const openPaymentModal = (ord: Order) => {
    const rem = Math.max(0, Number(ord.total_amount) - Number(ord.paid_amount));
    setPayModalOrder(ord);
    setPayAmount(rem > 0 ? String(rem) : '');
    setPayMethod('CASH');
    setPayDate(todayISO());
    setPayNotes(ord.paid_amount > 0 ? 'Pelunasan' : '');
    setManualInvoiceNo(ord.invoice_number || '');
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalOrder) return;
    const amount = Number(payAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      showToast('error', 'Nominal pembayaran harus lebih dari 0.');
      return;
    }

    setSavingPay(true);
    try {
      await api.recordPayment({
        order_id: payModalOrder.id,
        amount,
        payment_method: payMethod,
        payment_date: payDate ? `${payDate}T12:00:00Z` : new Date().toISOString(),
        notes: payNotes.trim(),
        invoice_number: manualInvoiceNo.trim() || null,
      });

      showToast(
        'success',
        `Pembayaran ${formatRupiah(amount)} (${payMethod}) untuk ${payModalOrder.order_number} berhasil dicatat.`
      );
      setPayModalOrder(null);
      await onRefresh();
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal mencatat pembayaran.'));
    } finally {
      setSavingPay(false);
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      await api.voidPayment(voidTarget.id);
      showToast('success', 'Transaksi pembayaran dibatalkan (void) dan tagihan dihitung ulang.');
      setVoidTarget(null);
      await onRefresh();
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal membatalkan pembayaran.'));
    } finally {
      setVoiding(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Pembayaran Hari Ini</div>
          <div className="text-xl font-bold text-blue-700 font-mono tabular-nums mt-1">
            {formatRupiah(summary.todayPaid)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Total Tagihan Order</div>
          <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {formatRupiah(summary.totalTagihan)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Total Pembayaran Masuk</div>
          <div className="text-xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {formatRupiah(summary.totalDibayar)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Sisa Piutang / Belum Lunas</div>
          <div className="text-xl font-bold text-red-700 font-mono tabular-nums mt-1">
            {formatRupiah(summary.totalSisa)}
          </div>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`px-3.5 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
                activeTab === 'ledger'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tagihan &amp; Status Order
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Riwayat Transaksi ({payments.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no. order, no. invoice, atau nama pelanggan..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          {activeTab === 'ledger' ? (
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'ALL' | 'BELUM BAYAR' | 'DP' | 'LUNAS')
              }
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="ALL">Semua Status Pembayaran</option>
              <option value="BELUM BAYAR">BELUM BAYAR</option>
              <option value="DP">DP</option>
              <option value="LUNAS">LUNAS</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value as 'ALL' | PaymentMethod)}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="ALL">Semua Metode</option>
                <option value="CASH">CASH / TUNAI</option>
                <option value="TRANSFER">TRANSFER</option>
              </select>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Memuat data pembayaran...
        </div>
      ) : activeTab === 'ledger' ? (
        filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
            Tidak ada data tagihan order yang sesuai.
          </div>
        ) : (
          <>
            <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <tr>
                    <th className="py-3 px-4 text-left font-semibold">No. Order / Invoice</th>
                    <th className="py-3 px-4 text-left font-semibold">Pelanggan</th>
                    <th className="py-3 px-4 text-left font-semibold">Status</th>
                    <th className="py-3 px-4 text-right font-semibold">Total Tagihan</th>
                    <th className="py-3 px-4 text-right font-semibold">Sudah Dibayar</th>
                    <th className="py-3 px-4 text-right font-semibold">Sisa Tagihan</th>
                    <th className="py-3 px-4 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredOrders.map((ord) => {
                    const sisa = Math.max(0, Number(ord.total_amount) - Number(ord.paid_amount));
                    return (
                      <tr key={ord.id} className="hover:bg-slate-50/80">
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
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{ord.customer_name}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[200px]">
                            {ord.service_name}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <PaymentStatusLabel status={ord.payment_status} />
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-medium">
                          {formatRupiah(ord.total_amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                          {formatRupiah(ord.paid_amount)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${
                            sisa > 0 ? 'text-red-700' : 'text-emerald-700'
                          }`}
                        >
                          {formatRupiah(sisa)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openPaymentModal(ord)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{sisa > 0 && ord.paid_amount > 0 ? 'Pelunasan' : 'Bayar'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredOrders.map((ord) => {
                const sisa = Math.max(0, Number(ord.total_amount) - Number(ord.paid_amount));
                return (
                  <div key={ord.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <button
                          type="button"
                          onClick={() => onSelectOrder(ord)}
                          className="font-mono text-xs font-bold text-blue-700"
                        >
                          {ord.order_number}
                        </button>
                        <div className="font-bold text-slate-900">{ord.customer_name}</div>
                      </div>
                      <PaymentStatusLabel status={ord.payment_status} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-slate-500 block">Tagihan</span>
                        <span className="font-mono font-semibold">{formatRupiah(ord.total_amount)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Dibayar</span>
                        <span className="font-mono font-semibold text-emerald-700">
                          {formatRupiah(ord.paid_amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Sisa</span>
                        <span
                          className={`font-mono font-bold ${
                            sisa > 0 ? 'text-red-700' : 'text-emerald-700'
                          }`}
                        >
                          {formatRupiah(sisa)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openPaymentModal(ord)}
                      className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{sisa > 0 && ord.paid_amount > 0 ? 'Catat Pelunasan / Cicilan' : 'Catat Pembayaran'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )
      ) : filteredPayments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Belum ada histori transaksi pembayaran.
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-4 text-left font-semibold">Tanggal</th>
                  <th className="py-3 px-4 text-left font-semibold">Order / Invoice</th>
                  <th className="py-3 px-4 text-left font-semibold">Pelanggan</th>
                  <th className="py-3 px-4 text-left font-semibold">Metode</th>
                  <th className="py-3 px-4 text-left font-semibold">Keterangan</th>
                  <th className="py-3 px-4 text-right font-semibold">Nominal</th>
                  <th className="py-3 px-4 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className={p.is_void ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50/80'}>
                    <td className="py-3 px-4 text-xs text-slate-600">{formatDateID(p.payment_date)}</td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-bold text-blue-700">{p.order_number}</div>
                      {p.invoice_number && (
                        <div className="font-mono text-[11px] text-slate-500">{p.invoice_number}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{p.customer_name}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-700">{p.payment_method}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {p.notes || '-'}
                      {p.is_void && <span className="ml-1.5 text-red-600 font-bold">(VOID)</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                      {formatRupiah(p.amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!p.is_void && (
                        <button
                          type="button"
                          onClick={() => setVoidTarget(p)}
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                          title="Batalkan transaksi (Void)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {filteredPayments.map((p) => (
              <div
                key={p.id}
                className={`bg-white rounded-xl border border-slate-200 p-4 space-y-2 ${
                  p.is_void ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-700">{p.order_number}</span>
                  <span className="text-xs text-slate-500">{formatDateID(p.payment_date)}</span>
                </div>
                <div className="font-semibold text-slate-900">{p.customer_name}</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    {p.payment_method} {p.notes ? `· ${p.notes}` : ''}
                    {p.is_void ? ' (VOID)' : ''}
                  </span>
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {formatRupiah(p.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Record Payment */}
      {payModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 bg-navy-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Catat Pembayaran</h3>
                <p className="text-xs text-slate-300">
                  {payModalOrder.order_number} · {payModalOrder.customer_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayModalOrder(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSavePayment} className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block">Tagihan</span>
                  <strong className="font-mono text-slate-900">
                    {formatRupiah(payModalOrder.total_amount)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Sudah Masuk</span>
                  <strong className="font-mono text-emerald-700">
                    {formatRupiah(payModalOrder.paid_amount)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Sisa</span>
                  <strong className="font-mono text-red-700">
                    {formatRupiah(
                      Math.max(0, Number(payModalOrder.total_amount) - Number(payModalOrder.paid_amount))
                    )}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nominal Pembayaran (Rp) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Pembayaran *
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Invoice (Opsional jika belum ada)
                </label>
                <input
                  type="text"
                  value={manualInvoiceNo}
                  onChange={(e) => setManualInvoiceNo(e.target.value)}
                  placeholder="Kosongkan untuk auto-generate"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan (DP / Pelunasan / Lunas)
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Contoh: DP via BCA / Pelunasan Cash"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPayModalOrder(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingPay}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingPay ? 'Menyimpan...' : 'Simpan Pembayaran'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(voidTarget)}
        title="Batalkan Transaksi Pembayaran?"
        description={
          voidTarget
            ? `Transaksi sebesar ${formatRupiah(voidTarget.amount)} (${voidTarget.payment_method}) untuk ${voidTarget.order_number} akan dibatalkan (void) dan sisa tagihan akan dihitung ulang.`
            : ''
        }
        confirmLabel="Ya, Batalkan"
        loading={voiding}
        onConfirm={handleConfirmVoid}
        onCancel={() => setVoidTarget(null)}
      />
    </div>
  );
};
