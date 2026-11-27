import React, { useState } from 'react';
import { Check, Download, Edit3, MessageCircle, Printer, X } from 'lucide-react';
import { api, formatApiError } from '../../lib/api';
import {
  buildInvoiceWhatsAppMessage,
  buildWhatsAppLink,
  exportInvoiceToPDF,
  formatDateID,
  formatNumberID,
  formatRupiah,
} from '../../lib/format';
import type { BusinessSettings, Invoice, OrderItem, Payment } from '../../types/database';
import { JawaraLogo } from '../JawaraLogo';
import { PaymentStatusLabel } from '../ui/StatusBadge';
import { useToast } from '../ui/Toast';

interface InvoicePreviewModalProps {
  open: boolean;
  invoice: Invoice | null;
  orderNumber: string;
  items: OrderItem[];
  payments: Payment[];
  settings: BusinessSettings | null;
  onClose: () => void;
  onInvoiceUpdated?: (updated: Invoice) => void;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  open,
  invoice,
  orderNumber,
  items,
  payments,
  settings,
  onClose,
  onInvoiceUpdated,
}) => {
  const { showToast } = useToast();
  const [editingNumber, setEditingNumber] = useState(false);
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('');
  const [savingNumber, setSavingNumber] = useState(false);

  if (!open || !invoice) return null;

  const activePayments = payments.filter((p) => !p.is_void);

  const handleStartEditNumber = () => {
    setNewInvoiceNumber(invoice.invoice_number);
    setEditingNumber(true);
  };

  const handleSaveInvoiceNumber = async () => {
    const clean = newInvoiceNumber.trim();
    if (!clean) {
      showToast('error', 'Nomor invoice tidak boleh kosong.');
      return;
    }
    setSavingNumber(true);
    try {
      const { invoice: updatedInv } = await api.updateInvoiceNumber(invoice.id, clean);
      showToast('success', `Nomor invoice diubah menjadi ${clean}.`);
      setEditingNumber(false);
      onInvoiceUpdated?.(updatedInv);
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal mengubah nomor invoice.'));
    } finally {
      setSavingNumber(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    exportInvoiceToPDF({
      invoice,
      orderNumber,
      items,
      payments: activePayments,
      settings,
    });
  };

  const waUrl = buildWhatsAppLink(
    invoice.customer_whatsapp,
    buildInvoiceWhatsAppMessage(invoice, settings)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-6 bg-slate-900/60 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl my-auto overflow-hidden print-only-container">
        {/* Action Toolbar (Hidden when printing) */}
        <div className="no-print px-4 sm:px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {editingNumber ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newInvoiceNumber}
                  onChange={(e) => setNewInvoiceNumber(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm font-mono bg-white"
                />
                <button
                  type="button"
                  onClick={handleSaveInvoiceNumber}
                  disabled={savingNumber}
                  className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  title="Simpan nomor invoice"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingNumber(false)}
                  className="p-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                  title="Batal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartEditNumber}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Ubah No. Invoice</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {invoice.customer_whatsapp && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Kirim WA</span>
              </a>
            )}
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-200/70"
              aria-label="Tutup invoice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Body */}
        <div className="p-5 sm:p-8 space-y-6 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <JawaraLogo variant="dark" showTagline />
              <div className="mt-3 text-xs text-slate-600 space-y-0.5">
                {settings?.address && <p>{settings.address}</p>}
                {(settings?.whatsapp || settings?.phone || settings?.email) && (
                  <p>
                    {[
                      settings?.whatsapp ? `WA: ${settings.whatsapp}` : '',
                      settings?.phone ? `Telp: ${settings.phone}` : '',
                      settings?.email || '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
            </div>

            <div className="sm:text-right">
              <div className="text-2xl font-bold tracking-tight text-navy-900">INVOICE</div>
              <div className="text-sm font-mono font-semibold text-blue-700 mt-1">
                {invoice.invoice_number}
              </div>
              <div className="mt-2">
                <PaymentStatusLabel status={invoice.payment_status} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Tagihan Kepada
              </p>
              <p className="font-bold text-slate-900 mt-1">{invoice.customer_name}</p>
              {invoice.customer_whatsapp && (
                <p className="text-slate-600 text-xs mt-0.5 font-mono">
                  WA: {invoice.customer_whatsapp}
                </p>
              )}
              <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                {invoice.customer_address || '-'}
              </p>
            </div>

            <div className="sm:text-right space-y-1 text-xs">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Informasi Layanan
              </p>
              <p className="text-slate-600">
                No. Order:{' '}
                <span className="font-mono font-semibold text-slate-900">{orderNumber}</span>
              </p>
              <p className="text-slate-600">
                Tanggal Invoice:{' '}
                <span className="font-semibold text-slate-900">
                  {formatDateID(invoice.issued_date)}
                </span>
              </p>
              <p className="text-slate-600">
                Jenis Layanan:{' '}
                <span className="font-semibold text-slate-900">{invoice.service_name}</span>
              </p>
              <p className="text-slate-600">
                Teknisi:{' '}
                <span className="font-semibold text-slate-900">
                  {invoice.technician_name || '-'}
                </span>
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-navy-900 text-white text-xs">
                <tr>
                  <th className="py-2.5 px-3 text-left font-semibold w-10">No</th>
                  <th className="py-2.5 px-3 text-left font-semibold">Rincian Pekerjaan</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Qty</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Harga</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length > 0 ? (
                  items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">{item.work_name}</div>
                        {item.description && (
                          <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
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
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-xs">1</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      {invoice.service_name}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">
                      1 Layanan
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">
                      {formatRupiah(invoice.subtotal_amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                      {formatRupiah(invoice.subtotal_amount)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="space-y-4">
              {activePayments.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Riwayat Pembayaran
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {activePayments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-1.5 border-b border-slate-100"
                      >
                        <span className="text-slate-600">
                          {formatDateID(p.payment_date)} · {p.payment_method}
                          {p.notes ? ` (${p.notes})` : ''}
                        </span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {formatRupiah(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {settings?.bank_name && settings?.bank_account_number && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <p className="font-semibold text-slate-800">Pembayaran Transfer Bank</p>
                  <p className="text-slate-600 mt-1">
                    {settings.bank_name} —{' '}
                    <span className="font-mono font-semibold text-slate-900">
                      {settings.bank_account_number}
                    </span>
                  </p>
                  <p className="text-slate-600">
                    a.n. {settings.bank_account_name || settings.business_name}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Pekerjaan</span>
                <span className="font-mono tabular-nums">
                  {formatRupiah(invoice.subtotal_amount)}
                </span>
              </div>
              {Number(invoice.additional_cost) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Biaya Tambahan</span>
                  <span className="font-mono tabular-nums">
                    {formatRupiah(invoice.additional_cost)}
                  </span>
                </div>
              )}
              {Number(invoice.material_cost) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Biaya Material</span>
                  <span className="font-mono tabular-nums">
                    {formatRupiah(invoice.material_cost)}
                  </span>
                </div>
              )}
              {Number(invoice.discount) > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Diskon</span>
                  <span className="font-mono tabular-nums">
                    - {formatRupiah(invoice.discount)}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-base">
                <span>Total Tagihan</span>
                <span className="font-mono tabular-nums">{formatRupiah(invoice.total_amount)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Total Dibayar</span>
                <span className="font-mono tabular-nums">{formatRupiah(invoice.paid_amount)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-base">
                <span className={invoice.remaining_amount > 0 ? 'text-red-700' : 'text-emerald-700'}>
                  Sisa Pembayaran
                </span>
                <span
                  className={`font-mono tabular-nums ${
                    invoice.remaining_amount > 0 ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {formatRupiah(invoice.remaining_amount)}
                </span>
              </div>
            </div>
          </div>

          {settings?.invoice_footer_note && (
            <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 leading-relaxed">
              {settings.invoice_footer_note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
