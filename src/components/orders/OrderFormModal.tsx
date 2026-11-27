import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, UserPlus, X } from 'lucide-react';
import { api, formatApiError } from '../../lib/api';
import { formatRupiah, todayISO } from '../../lib/format';
import {
  ORDER_STATUSES,
  type Customer,
  type Order,
  type OrderStatus,
  type Technician,
} from '../../types/database';
import { useToast } from '../ui/Toast';

interface OrderFormModalProps {
  open: boolean;
  editingOrder?: Order | null;
  customers: Customer[];
  technicians: Technician[];
  onClose: () => void;
  onSaved: (savedOrder: Order, newCustomerCreated?: Customer) => void;
}

const SERVICE_SUGGESTIONS = [
  'Service Cleaning AC Split',
  'Cuci AC',
  'Isi Freon',
  'Perbaikan AC',
  'Bongkar Pasang AC',
  'Instalasi AC Baru',
  'Ganti Kapasitor / Sparepart',
  'Cek Kebocoran Freon',
];

export const OrderFormModal: React.FC<OrderFormModalProps> = ({
  open,
  editingOrder,
  customers,
  technicians,
  onClose,
  onSaved,
}) => {
  const { showToast } = useToast();

  const [orderNumber, setOrderNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerWhatsapp, setNewCustomerWhatsapp] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');

  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceDate, setServiceDate] = useState(todayISO());
  const [serviceTime, setServiceTime] = useState('09:00');
  const [technicianId, setTechnicianId] = useState('');
  const [status, setStatus] = useState<OrderStatus>('Baru');
  const [complaint, setComplaint] = useState('');
  const [laborCost, setLaborCost] = useState('0');
  const [additionalCost, setAdditionalCost] = useState('0');
  const [materialCost, setMaterialCost] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [internalNotes, setInternalNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [generatingNum, setGeneratingNum] = useState(false);

  const activeTechnicians = useMemo(
    () => technicians.filter((t) => t.is_active || t.id === technicianId),
    [technicians, technicianId]
  );

  const computedTotal = useMemo(() => {
    const l = Math.max(0, Number(laborCost) || 0);
    const a = Math.max(0, Number(additionalCost) || 0);
    const m = Math.max(0, Number(materialCost) || 0);
    const d = Math.max(0, Number(discount) || 0);
    return Math.max(0, l + a + m - d);
  }, [laborCost, additionalCost, materialCost, discount]);

  const fetchNextOrderNumber = async () => {
    setGeneratingNum(true);
    try {
      const { order_number } = await api.nextOrderNumber();
      if (order_number) setOrderNumber(order_number);
    } catch {
      const fallback = `ORD-JWR-${todayISO().replace(/-/g, '').slice(0, 6)}-${String(
        Math.floor(1000 + Math.random() * 9000)
      )}`;
      setOrderNumber(fallback);
    } finally {
      setGeneratingNum(false);
    }
  };

  const handleGenerateInvoiceNo = async () => {
    try {
      const { invoice_number } = await api.nextInvoiceNumber();
      if (invoice_number) setInvoiceNumber(invoice_number);
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal membuat nomor invoice otomatis.'));
    }
  };

  useEffect(() => {
    if (!open) return;
    if (editingOrder) {
      setOrderNumber(editingOrder.order_number);
      setInvoiceNumber(editingOrder.invoice_number || '');
      setIsNewCustomer(false);
      setCustomerId(editingOrder.customer_id);
      setCustomerWhatsapp(editingOrder.customer_whatsapp);
      setServiceAddress(editingOrder.service_address);
      setServiceName(editingOrder.service_name);
      setServiceDate(editingOrder.service_date || todayISO());
      setServiceTime(editingOrder.service_time ? editingOrder.service_time.slice(0, 5) : '');
      setTechnicianId(editingOrder.technician_id || '');
      setStatus(editingOrder.status);
      setComplaint(editingOrder.complaint || '');
      setLaborCost(String(editingOrder.labor_cost ?? 0));
      setAdditionalCost(String(editingOrder.additional_cost ?? 0));
      setMaterialCost(String(editingOrder.material_cost ?? 0));
      setDiscount(String(editingOrder.discount ?? 0));
      setInternalNotes(editingOrder.internal_notes || '');
    } else {
      setInvoiceNumber('');
      setIsNewCustomer(customers.length === 0);
      setCustomerId(customers[0]?.id || '');
      setCustomerWhatsapp(customers[0]?.whatsapp || '');
      setServiceAddress(customers[0]?.address || '');
      setNewCustomerName('');
      setNewCustomerWhatsapp('');
      setNewCustomerAddress('');
      setNewCustomerEmail('');
      setServiceName('');
      setServiceDate(todayISO());
      setServiceTime('09:00');
      setTechnicianId('');
      setStatus('Baru');
      setComplaint('');
      setLaborCost('0');
      setAdditionalCost('0');
      setMaterialCost('0');
      setDiscount('0');
      setInternalNotes('');
      void fetchNextOrderNumber();
    }
  }, [open, editingOrder, customers]);

  const handleCustomerSelect = (selectedId: string) => {
    setCustomerId(selectedId);
    const found = customers.find((c) => c.id === selectedId);
    if (found) {
      setCustomerWhatsapp(found.whatsapp);
      setServiceAddress(found.address);
    }
  };

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!orderNumber.trim()) {
      showToast('error', 'Nomor order wajib diisi.');
      return;
    }
    if (!serviceName.trim()) {
      showToast('error', 'Nama pelayanan wajib diisi.');
      return;
    }

    if (isNewCustomer && (!newCustomerName.trim() || !newCustomerWhatsapp.trim())) {
      showToast('error', 'Nama pelanggan baru dan nomor WhatsApp wajib diisi.');
      return;
    }

    if (!isNewCustomer && !customerId) {
      showToast('error', 'Silakan pilih pelanggan atau tambah pelanggan baru.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        order_number: orderNumber.trim(),
        invoice_number: invoiceNumber.trim() || null,
        customer_id: isNewCustomer ? undefined : customerId,
        new_customer: isNewCustomer
          ? {
              name: newCustomerName.trim(),
              whatsapp: newCustomerWhatsapp.trim(),
              address: newCustomerAddress.trim(),
              email: newCustomerEmail.trim(),
            }
          : undefined,
        customer_whatsapp: customerWhatsapp.trim(),
        service_address: serviceAddress.trim(),
        service_name: serviceName.trim(),
        service_date: serviceDate || todayISO(),
        service_time: serviceTime ? `${serviceTime}:00` : null,
        technician_id: technicianId || null,
        complaint: complaint.trim(),
        labor_cost: Math.max(0, Number(laborCost) || 0),
        additional_cost: Math.max(0, Number(additionalCost) || 0),
        material_cost: Math.max(0, Number(materialCost) || 0),
        discount: Math.max(0, Number(discount) || 0),
        status,
        internal_notes: internalNotes.trim(),
      };

      if (editingOrder) {
        const { order: savedOrder } = await api.updateOrder(editingOrder.id, payload);
        showToast('success', `Order ${savedOrder.order_number} berhasil diperbarui.`);
        onSaved(savedOrder);
      } else {
        const { order: savedOrder, newCustomer } = await api.createOrder(payload);
        showToast('success', `Order ${savedOrder.order_number} berhasil dibuat.`);
        onSaved(savedOrder, newCustomer);
      }

      onClose();
    } catch (err) {
      showToast('error', formatApiError(err, 'Gagal menyimpan order service.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-[1px]">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-navy-900 text-white">
          <div>
            <h2 className="text-base sm:text-lg font-bold">
              {editingOrder ? `Edit Order ${editingOrder.order_number}` : 'Buat Order Service Baru'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Lengkapi data pelanggan, pelayanan, teknisi, dan estimasi biaya.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Tutup form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Nomor Order & Invoice */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nomor Order *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  required
                  className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                />
                {!editingOrder && (
                  <button
                    type="button"
                    onClick={fetchNextOrderNumber}
                    disabled={generatingNum}
                    title="Generate nomor order baru"
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium"
                  >
                    <RefreshCw className={`w-4 h-4 ${generatingNum ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nomor Invoice (Opsional / Manual)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Kosongkan atau isi manual"
                  className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                />
                <button
                  type="button"
                  onClick={handleGenerateInvoiceNo}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold whitespace-nowrap"
                >
                  Auto
                </button>
              </div>
            </div>
          </div>

          {/* Pelanggan */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">Data Pelanggan</span>
              {!editingOrder && (
                <button
                  type="button"
                  onClick={() => setIsNewCustomer((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isNewCustomer ? 'Pilih Pelanggan Terdaftar' : '+ Pelanggan Baru'}</span>
                </button>
              )}
            </div>

            {isNewCustomer ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Pelanggan Baru *
                  </label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nomor WhatsApp *
                  </label>
                  <input
                    type="text"
                    value={newCustomerWhatsapp}
                    onChange={(e) => {
                      setNewCustomerWhatsapp(e.target.value);
                      setCustomerWhatsapp(e.target.value);
                    }}
                    placeholder="0812xxxxxxxx"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Alamat Pelanggan
                  </label>
                  <input
                    type="text"
                    value={newCustomerAddress}
                    onChange={(e) => {
                      setNewCustomerAddress(e.target.value);
                      setServiceAddress(e.target.value);
                    }}
                    placeholder="Alamat lengkap lokasi service"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email (Opsional)
                  </label>
                  <input
                    type="email"
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    placeholder="email@pelanggan.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pilih Pelanggan *
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm"
                  >
                    <option value="">-- Pilih Pelanggan --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.whatsapp})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nomor WhatsApp Order *
                  </label>
                  <input
                    type="text"
                    value={customerWhatsapp}
                    onChange={(e) => setCustomerWhatsapp(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Alamat Service
                  </label>
                  <input
                    type="text"
                    value={serviceAddress}
                    onChange={(e) => setServiceAddress(e.target.value)}
                    placeholder="Alamat lokasi pengerjaan AC"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Detail Pelayanan & Jadwal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Pelayanan (Input Teks Bebas) *
              </label>
              <input
                type="text"
                list="jawara-service-suggestions"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="Contoh: Service Cleaning AC Split, Cuci AC 2 Unit, Isi Freon R32..."
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
              />
              <datalist id="jawara-service-suggestions">
                {SERVICE_SUGGESTIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tanggal Service *
              </label>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Jam Service
              </label>
              <input
                type="time"
                value={serviceTime}
                onChange={(e) => setServiceTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Teknisi Bertugas
              </label>
              <select
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">-- Belum Ditugaskan --</option>
                {activeTechnicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {!t.is_active ? '(Nonaktif)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Status Order
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white font-medium"
              >
                {ORDER_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Keluhan Pelanggan
              </label>
              <textarea
                rows={2}
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                placeholder="Contoh: AC tidak dingin, menetes air di indoor, berisik..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          {/* Komponen Biaya */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Rincian Biaya Awal</span>
              <span className="text-xs text-slate-500">
                Bisa ditambah detail item di tab Rincian Pekerjaan
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Biaya Jasa (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Biaya Tambahan (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={additionalCost}
                  onChange={(e) => setAdditionalCost(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Biaya Material (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={materialCost}
                  onChange={(e) => setMaterialCost(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Diskon (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums"
                />
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Estimasi Total Tagihan</span>
              <span className="text-lg font-bold text-blue-700 font-mono tabular-nums">
                {formatRupiah(computedTotal)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Catatan Internal Admin
            </label>
            <textarea
              rows={2}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Catatan internal khusus admin / instruksi teknisi"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 min-h-[42px]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold min-h-[42px] disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : editingOrder ? 'Simpan Perubahan' : 'Simpan Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
