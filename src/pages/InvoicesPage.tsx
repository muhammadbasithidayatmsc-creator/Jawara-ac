import React, { useMemo, useState } from 'react';
import { FileText, MessageCircle, Plus, Printer, Search } from 'lucide-react';
import {
  buildInvoiceWhatsAppMessage,
  buildWhatsAppLink,
  formatDateID,
  formatRupiah,
} from '../lib/format';
import { api, formatApiError } from '../lib/api';
import type { BusinessSettings, Invoice, Order, OrderItem, Payment } from '../types/database';
import { InvoicePreviewModal } from '../components/invoices/InvoicePreviewModal';
import { PaymentStatusLabel } from '../components/ui/StatusBadge';
import { useToast } from '../components/ui/Toast';

interface InvoicesPageProps {
  invoices: Invoice[];
  orders: Order[];
  payments: Payment[];
  settings: BusinessSettings | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
}

export const InvoicesPage: React.FC<InvoicesPageProps> = ({
  invoices,
  orders,
  payments,
  settings,
  loading,
  onRefresh,
}) => {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [customInvoiceNo, setCustomInvoiceNo] = useState('');
  const [creating, setCreating] = useState(false);

  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewOrderNumber, setPreviewOrderNumber] = useState('');
  const [previewItems, setPreviewItems] = useState<OrderItem[]>([]);

  const ordersWithoutInvoice = useMemo(() => {
    const invoicedOrderIds = new Set(invoices.map((i) => i.order_id));
    return orders.filter((o) => !invoicedOrderIds.has(o.id) && o.status !== 'Dibatalkan');
  }, [orders, invoices]);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) =>
      [inv.invoice_number, inv.customer_name, inv.service_name, inv.customer_whatsapp]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [invoices, search]);

  const handleOpenPreview = async (inv: Invoice) => {
    try {
      const details = await api.getOrderDetails(inv.order_id);
      const linkedOrder = orders.find((o) => o.id === inv.order_id);
      setPreviewItems(details.items || []);
      setPreviewOrderNumber(linkedOrder?.order_number || details.order?.order_number || '-');
      setPreviewInvoice(inv);
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal memuat rincian invoice.'));
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const ord = orders.find((o) => o.id === selectedOrderId);
    if (!ord) {
      showToast('error', 'Pilih order terlebih dahulu.');
      return;
    }

    setCreating(true);
    try {
      const customNo = customInvoiceNo.trim() || ord.invoice_number || undefined;
      const { invoice } = await api.upsertInvoice({
        order_id: ord.id,
        invoice_number: customNo,
      });

      setCustomInvoiceNo('');
      setSelectedOrderId('');
      await onRefresh();
      showToast('success', `Invoice ${invoice.invoice_number} berhasil diterbitkan.`);
      await handleOpenPreview(invoice);
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal menerbitkan invoice.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Create Invoice Bar */}
      <form
        onSubmit={handleCreateInvoice}
        className="bg-white rounded-xl border border-slate-200 p-4 space-y-3"
      >
        <div className="text-sm font-semibold text-slate-900">Terbitkan Invoice dari Order</div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="sm:col-span-2 px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
          >
            <option value="">-- Pilih Order Belum Ber-Invoice --</option>
            {ordersWithoutInvoice.map((ord) => (
              <option key={ord.id} value={ord.id}>
                {ord.order_number} — {ord.customer_name} ({formatRupiah(ord.total_amount)})
              </option>
            ))}
          </select>
          <input
            type="text"
            value={customInvoiceNo}
            onChange={(e) => setCustomInvoiceNo(e.target.value)}
            placeholder="No. Invoice manual (opsional)"
            className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-mono"
          />
          <button
            type="submit"
            disabled={creating || !selectedOrderId}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{creating ? 'Membuat...' : 'Buat Invoice'}</span>
          </button>
        </div>
      </form>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor invoice, nama pelanggan, atau layanan..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Memuat daftar invoice...
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Belum ada invoice tercatat. Pilih order di atas atau buat invoice dari halaman Detail Order.
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-4 text-left font-semibold">No. Invoice</th>
                  <th className="py-3 px-4 text-left font-semibold">Tanggal</th>
                  <th className="py-3 px-4 text-left font-semibold">Pelanggan &amp; Layanan</th>
                  <th className="py-3 px-4 text-left font-semibold">Status</th>
                  <th className="py-3 px-4 text-right font-semibold">Total</th>
                  <th className="py-3 px-4 text-right font-semibold">Sisa</th>
                  <th className="py-3 px-4 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono text-xs font-bold text-blue-700">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {formatDateID(inv.issued_date)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{inv.customer_name}</div>
                      <div className="text-xs text-slate-500">{inv.service_name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <PaymentStatusLabel status={inv.payment_status} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatRupiah(inv.total_amount)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${
                        inv.remaining_amount > 0 ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatRupiah(inv.remaining_amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(inv)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Preview / PDF</span>
                        </button>
                        {inv.customer_whatsapp && (
                          <a
                            href={buildWhatsAppLink(
                              inv.customer_whatsapp,
                              buildInvoiceWhatsAppMessage(inv, settings)
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50"
                            title="Kirim Invoice ke WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {filteredInvoices.map((inv) => (
              <div key={inv.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-xs font-bold text-blue-700">
                      {inv.invoice_number}
                    </div>
                    <div className="font-bold text-slate-900 mt-0.5">{inv.customer_name}</div>
                    <div className="text-xs text-slate-500">{inv.service_name}</div>
                  </div>
                  <PaymentStatusLabel status={inv.payment_status} />
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-500">{formatDateID(inv.issued_date)}</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatRupiah(inv.total_amount)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(inv)}
                    className="py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Preview / PDF</span>
                  </button>
                  {inv.customer_whatsapp && (
                    <a
                      href={buildWhatsAppLink(
                        inv.customer_whatsapp,
                        buildInvoiceWhatsAppMessage(inv, settings)
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Kirim WA</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <InvoicePreviewModal
        open={Boolean(previewInvoice)}
        invoice={previewInvoice}
        orderNumber={previewOrderNumber}
        items={previewItems}
        payments={
          previewInvoice ? payments.filter((p) => p.order_id === previewInvoice.order_id) : []
        }
        settings={settings}
        onClose={() => setPreviewInvoice(null)}
        onInvoiceUpdated={(updated) => {
          setPreviewInvoice(updated);
          void onRefresh();
        }}
      />
    </div>
  );
};
