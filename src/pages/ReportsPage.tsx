import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import {
  exportTableToPDF,
  exportToExcel,
  formatDateID,
  formatNumberID,
  formatRupiah,
  todayISO,
} from '../lib/format';
import type { Customer, Expense, Order, Payment, Technician } from '../types/database';

interface ReportsPageProps {
  orders: Order[];
  customers: Customer[];
  technicians: Technician[];
  payments: Payment[];
  expenses: Expense[];
}

type PeriodMode = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
type ReportTab = 'revenue' | 'orders' | 'payments' | 'expenses' | 'technicians' | 'customers';

export const ReportsPage: React.FC<ReportsPageProps> = ({
  orders,
  customers,
  technicians,
  payments,
  expenses,
}) => {
  const today = todayISO();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly');
  const [customStart, setCustomStart] = useState(`${today.slice(0, 7)}-01`);
  const [customEnd, setCustomEnd] = useState(today);
  const [activeTab, setActiveTab] = useState<ReportTab>('revenue');

  const dateRange = useMemo(() => {
    const now = new Date(`${today}T00:00:00`);
    if (periodMode === 'daily') {
      return { start: today, end: today, label: `Harian (${formatDateID(today)})` };
    }
    if (periodMode === 'weekly') {
      const startObj = new Date(now);
      startObj.setDate(now.getDate() - 6);
      const start = startObj.toISOString().slice(0, 10);
      return {
        start,
        end: today,
        label: `Mingguan (${formatDateID(start)} - ${formatDateID(today)})`,
      };
    }
    if (periodMode === 'monthly') {
      const start = `${today.slice(0, 7)}-01`;
      return {
        start,
        end: today,
        label: `Bulanan (${formatDateID(start)} - ${formatDateID(today)})`,
      };
    }
    if (periodMode === 'yearly') {
      const start = `${today.slice(0, 4)}-01-01`;
      return {
        start,
        end: today,
        label: `Tahunan (${today.slice(0, 4)})`,
      };
    }
    const start = customStart || '2000-01-01';
    const end = customEnd || today;
    return {
      start,
      end,
      label: `Rentang (${formatDateID(start)} - ${formatDateID(end)})`,
    };
  }, [periodMode, customStart, customEnd, today]);

  const filteredData = useMemo(() => {
    const inRange = (dStr: string) => {
      const d = dStr.slice(0, 10);
      return d >= dateRange.start && d <= dateRange.end;
    };

    const validPayments = payments.filter((p) => !p.is_void && inRange(p.payment_date));
    const validExpenses = expenses.filter((e) => inRange(e.expense_date));
    const periodOrders = orders.filter((o) => !o.is_archived && inRange(o.service_date));

    const totalRevenue = validPayments.reduce((s, p) => s + Number(p.amount), 0);
    const totalExpense = validExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const netBalance = totalRevenue - totalExpense;

    const cashRevenue = validPayments
      .filter((p) => p.payment_method === 'CASH')
      .reduce((s, p) => s + Number(p.amount), 0);
    const transferRevenue = validPayments
      .filter((p) => p.payment_method === 'TRANSFER')
      .reduce((s, p) => s + Number(p.amount), 0);

    const technicianReport = technicians.map((t) => {
      const handled = periodOrders.filter((o) => o.technician_id === t.id);
      const completed = handled.filter((o) => o.status === 'Selesai').length;
      const totalBilled = handled
        .filter((o) => o.status !== 'Dibatalkan')
        .reduce((s, o) => s + Number(o.total_amount), 0);
      return {
        name: t.name,
        whatsapp: t.whatsapp,
        status: t.is_active ? 'Aktif' : 'Nonaktif',
        orderCount: handled.length,
        completedCount: completed,
        totalBilled,
      };
    });

    const customerReport = customers
      .map((c) => {
        const custOrders = periodOrders.filter((o) => o.customer_id === c.id);
        const totalBilled = custOrders
          .filter((o) => o.status !== 'Dibatalkan')
          .reduce((s, o) => s + Number(o.total_amount), 0);
        const totalPaid = custOrders
          .filter((o) => o.status !== 'Dibatalkan')
          .reduce((s, o) => s + Number(o.paid_amount), 0);
        return {
          name: c.name,
          whatsapp: c.whatsapp,
          orderCount: custOrders.length,
          totalBilled,
          totalPaid,
        };
      })
      .filter((row) => row.orderCount > 0);

    return {
      validPayments,
      validExpenses,
      periodOrders,
      totalRevenue,
      totalExpense,
      netBalance,
      cashRevenue,
      transferRevenue,
      technicianReport,
      customerReport,
    };
  }, [orders, payments, expenses, technicians, customers, dateRange]);

  const handleExportExcel = () => {
    const sheets = [
      {
        sheetName: 'Ringkasan Pendapatan',
        rows: [
          { Keterangan: 'Periode', Nilai: dateRange.label },
          { Keterangan: 'Total Pendapatan Valid (Cash + Transfer)', Nilai: filteredData.totalRevenue },
          { Keterangan: 'Pendapatan Cash', Nilai: filteredData.cashRevenue },
          { Keterangan: 'Pendapatan Transfer', Nilai: filteredData.transferRevenue },
          { Keterangan: 'Total Pengeluaran Valid', Nilai: filteredData.totalExpense },
          { Keterangan: 'Saldo Bersih', Nilai: filteredData.netBalance },
        ],
      },
      {
        sheetName: 'Laporan Order',
        rows: filteredData.periodOrders.map((o) => ({
          'No. Order': o.order_number,
          Tanggal: o.service_date,
          Pelanggan: o.customer_name,
          Pelayanan: o.service_name,
          Teknisi: o.technician_name || '-',
          'Status Order': o.status,
          'Status Bayar': o.payment_status,
          'Total Tagihan': Number(o.total_amount),
          'Sudah Dibayar': Number(o.paid_amount),
        })),
      },
      {
        sheetName: 'Laporan Pembayaran',
        rows: filteredData.validPayments.map((p) => ({
          Tanggal: p.payment_date.slice(0, 10),
          'No. Order': p.order_number,
          'No. Invoice': p.invoice_number || '-',
          Pelanggan: p.customer_name,
          Metode: p.payment_method,
          Nominal: Number(p.amount),
          Keterangan: p.notes || '-',
        })),
      },
      {
        sheetName: 'Laporan Pengeluaran',
        rows: filteredData.validExpenses.map((e) => ({
          Tanggal: e.expense_date,
          Pengeluaran: e.title,
          Kategori: e.category_name,
          Metode: e.payment_method,
          Nominal: Number(e.amount),
          Keterangan: e.notes || '-',
        })),
      },
      {
        sheetName: 'Laporan Teknisi',
        rows: filteredData.technicianReport.map((t) => ({
          Teknisi: t.name,
          WhatsApp: t.whatsapp,
          Status: t.status,
          'Jumlah Order': t.orderCount,
          'Order Selesai': t.completedCount,
          'Nilai Order': t.totalBilled,
        })),
      },
      {
        sheetName: 'Laporan Pelanggan',
        rows: filteredData.customerReport.map((c) => ({
          Pelanggan: c.name,
          WhatsApp: c.whatsapp,
          'Jumlah Order': c.orderCount,
          'Total Tagihan': c.totalBilled,
          'Total Dibayar': c.totalPaid,
        })),
      },
    ];

    exportToExcel(`Laporan_JAWARA_AC_${dateRange.start}_${dateRange.end}.xlsx`, sheets);
  };

  const handleExportPDF = () => {
    const summaryPairs = [
      { label: 'Periode', value: dateRange.label },
      { label: 'Total Pendapatan Valid', value: formatRupiah(filteredData.totalRevenue) },
      { label: 'Total Pengeluaran Valid', value: formatRupiah(filteredData.totalExpense) },
      { label: 'Saldo Bersih', value: formatRupiah(filteredData.netBalance) },
    ];

    if (activeTab === 'orders') {
      exportTableToPDF({
        title: 'Laporan Order Service — JAWARA AC',
        subtitle: dateRange.label,
        summaryPairs,
        headers: ['No. Order', 'Tanggal', 'Pelanggan', 'Layanan', 'Status', 'Tagihan'],
        rows: filteredData.periodOrders.map((o) => [
          o.order_number,
          formatDateID(o.service_date),
          o.customer_name,
          o.service_name,
          o.status,
          formatRupiah(o.total_amount),
        ]),
        filename: `Laporan_Order_${dateRange.start}.pdf`,
      });
    } else if (activeTab === 'expenses') {
      exportTableToPDF({
        title: 'Laporan Pengeluaran — JAWARA AC',
        subtitle: dateRange.label,
        summaryPairs,
        headers: ['Tanggal', 'Pengeluaran', 'Kategori', 'Metode', 'Nominal'],
        rows: filteredData.validExpenses.map((e) => [
          formatDateID(e.expense_date),
          e.title,
          e.category_name,
          e.payment_method,
          formatRupiah(e.amount),
        ]),
        filename: `Laporan_Pengeluaran_${dateRange.start}.pdf`,
      });
    } else if (activeTab === 'technicians') {
      exportTableToPDF({
        title: 'Laporan Kinerja Teknisi — JAWARA AC',
        subtitle: dateRange.label,
        summaryPairs,
        headers: ['Teknisi', 'WhatsApp', 'Status', 'Order', 'Selesai', 'Nilai Order'],
        rows: filteredData.technicianReport.map((t) => [
          t.name,
          t.whatsapp,
          t.status,
          String(t.orderCount),
          String(t.completedCount),
          formatRupiah(t.totalBilled),
        ]),
        filename: `Laporan_Teknisi_${dateRange.start}.pdf`,
      });
    } else if (activeTab === 'customers') {
      exportTableToPDF({
        title: 'Laporan Pelanggan — JAWARA AC',
        subtitle: dateRange.label,
        summaryPairs,
        headers: ['Pelanggan', 'WhatsApp', 'Order', 'Tagihan', 'Dibayar'],
        rows: filteredData.customerReport.map((c) => [
          c.name,
          c.whatsapp,
          String(c.orderCount),
          formatRupiah(c.totalBilled),
          formatRupiah(c.totalPaid),
        ]),
        filename: `Laporan_Pelanggan_${dateRange.start}.pdf`,
      });
    } else {
      exportTableToPDF({
        title: 'Laporan Keuangan & Pembayaran — JAWARA AC',
        subtitle: dateRange.label,
        summaryPairs,
        headers: ['Tanggal', 'No. Order', 'Pelanggan', 'Metode', 'Nominal', 'Ket.'],
        rows: filteredData.validPayments.map((p) => [
          formatDateID(p.payment_date),
          p.order_number,
          p.customer_name,
          p.payment_method,
          formatRupiah(p.amount),
          p.notes || '-',
        ]),
        filename: `Laporan_Keuangan_${dateRange.start}.pdf`,
      });
    }
  };

  return (
    <div className="space-y-5 print-only-container">
      {/* Period & Export Toolbar */}
      <div className="no-print bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'daily' as PeriodMode, label: 'Harian' },
              { id: 'weekly' as PeriodMode, label: 'Mingguan' },
              { id: 'monthly' as PeriodMode, label: 'Bulanan' },
              { id: 'yearly' as PeriodMode, label: 'Tahunan' },
              { id: 'custom' as PeriodMode, label: 'Rentang Tanggal' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodMode(p.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  periodMode === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak</span>
            </button>
          </div>
        </div>

        {periodMode === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Financial Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Total Pendapatan Valid (Kas Masuk)</div>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {formatRupiah(filteredData.totalRevenue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Cash: {formatRupiah(filteredData.cashRevenue)} · Transfer:{' '}
            {formatRupiah(filteredData.transferRevenue)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Total Pengeluaran Valid</div>
          <div className="text-2xl font-bold text-red-700 font-mono tabular-nums mt-1">
            {formatRupiah(filteredData.totalExpense)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{dateRange.label}</div>
        </div>

        <div className="bg-navy-900 text-white rounded-xl border border-navy-800 p-4">
          <div className="text-xs text-sky-200">Saldo Bersih (Pendapatan - Pengeluaran)</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums mt-1">
            {formatRupiah(filteredData.netBalance)}
          </div>
          <div className="text-[11px] text-slate-300 mt-1">
            Order belum dibayar tidak dihitung sebagai pendapatan aktual.
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="no-print px-4 pt-2.5 bg-slate-50 border-b border-slate-200 flex gap-1 overflow-x-auto">
          {[
            { id: 'revenue' as ReportTab, label: 'Pendapatan' },
            { id: 'orders' as ReportTab, label: `Order (${filteredData.periodOrders.length})` },
            { id: 'payments' as ReportTab, label: `Pembayaran (${filteredData.validPayments.length})` },
            { id: 'expenses' as ReportTab, label: `Pengeluaran (${filteredData.validExpenses.length})` },
            { id: 'technicians' as ReportTab, label: 'Teknisi' },
            { id: 'customers' as ReportTab, label: 'Pelanggan' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5 overflow-x-auto">
          {(activeTab === 'revenue' || activeTab === 'payments') && (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-2.5 text-left font-semibold">Tanggal</th>
                  <th className="py-2.5 text-left font-semibold">No. Order</th>
                  <th className="py-2.5 text-left font-semibold">Pelanggan</th>
                  <th className="py-2.5 text-left font-semibold">Metode</th>
                  <th className="py-2.5 text-left font-semibold">Keterangan</th>
                  <th className="py-2.5 text-right font-semibold">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredData.validPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                      Belum ada pembayaran valid pada periode ini.
                    </td>
                  </tr>
                ) : (
                  filteredData.validPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 text-xs text-slate-600">{formatDateID(p.payment_date)}</td>
                      <td className="py-2.5 font-mono text-xs font-semibold text-blue-700">
                        {p.order_number}
                      </td>
                      <td className="py-2.5 font-medium text-slate-900">{p.customer_name}</td>
                      <td className="py-2.5 text-xs font-semibold">{p.payment_method}</td>
                      <td className="py-2.5 text-xs text-slate-600">{p.notes || '-'}</td>
                      <td className="py-2.5 text-right font-mono font-bold tabular-nums">
                        {formatRupiah(p.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'orders' && (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-2.5 text-left font-semibold">No. Order</th>
                  <th className="py-2.5 text-left font-semibold">Tanggal</th>
                  <th className="py-2.5 text-left font-semibold">Pelanggan</th>
                  <th className="py-2.5 text-left font-semibold">Layanan</th>
                  <th className="py-2.5 text-left font-semibold">Status</th>
                  <th className="py-2.5 text-right font-semibold">Tagihan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredData.periodOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                      Belum ada order pada periode ini.
                    </td>
                  </tr>
                ) : (
                  filteredData.periodOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="py-2.5 font-mono text-xs font-semibold text-blue-700">
                        {o.order_number}
                      </td>
                      <td className="py-2.5 text-xs text-slate-600">{formatDateID(o.service_date)}</td>
                      <td className="py-2.5 font-medium text-slate-900">{o.customer_name}</td>
                      <td className="py-2.5 text-xs text-slate-700">{o.service_name}</td>
                      <td className="py-2.5 text-xs font-semibold">{o.status}</td>
                      <td className="py-2.5 text-right font-mono font-bold tabular-nums">
                        {formatRupiah(o.total_amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'expenses' && (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-2.5 text-left font-semibold">Tanggal</th>
                  <th className="py-2.5 text-left font-semibold">Pengeluaran</th>
                  <th className="py-2.5 text-left font-semibold">Kategori</th>
                  <th className="py-2.5 text-left font-semibold">Metode</th>
                  <th className="py-2.5 text-right font-semibold">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredData.validExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                      Belum ada pengeluaran pada periode ini.
                    </td>
                  </tr>
                ) : (
                  filteredData.validExpenses.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2.5 text-xs text-slate-600">{formatDateID(e.expense_date)}</td>
                      <td className="py-2.5 font-medium text-slate-900">{e.title}</td>
                      <td className="py-2.5 text-xs text-slate-600">{e.category_name}</td>
                      <td className="py-2.5 text-xs font-semibold">{e.payment_method}</td>
                      <td className="py-2.5 text-right font-mono font-bold tabular-nums text-red-700">
                        {formatRupiah(e.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'technicians' && (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-2.5 text-left font-semibold">Nama Teknisi</th>
                  <th className="py-2.5 text-left font-semibold">WhatsApp</th>
                  <th className="py-2.5 text-left font-semibold">Status</th>
                  <th className="py-2.5 text-right font-semibold">Total Order</th>
                  <th className="py-2.5 text-right font-semibold">Selesai</th>
                  <th className="py-2.5 text-right font-semibold">Nilai Tagihan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredData.technicianReport.map((t) => (
                  <tr key={t.name}>
                    <td className="py-2.5 font-semibold text-slate-900">{t.name}</td>
                    <td className="py-2.5 font-mono text-xs text-slate-600">{t.whatsapp}</td>
                    <td className="py-2.5 text-xs">{t.status}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {formatNumberID(t.orderCount)}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {formatNumberID(t.completedCount)}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold tabular-nums">
                      {formatRupiah(t.totalBilled)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'customers' && (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-2.5 text-left font-semibold">Pelanggan</th>
                  <th className="py-2.5 text-left font-semibold">WhatsApp</th>
                  <th className="py-2.5 text-right font-semibold">Jumlah Order</th>
                  <th className="py-2.5 text-right font-semibold">Total Tagihan</th>
                  <th className="py-2.5 text-right font-semibold">Total Dibayar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredData.customerReport.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                      Belum ada transaksi pelanggan pada periode ini.
                    </td>
                  </tr>
                ) : (
                  filteredData.customerReport.map((c) => (
                    <tr key={c.name + c.whatsapp}>
                      <td className="py-2.5 font-semibold text-slate-900">{c.name}</td>
                      <td className="py-2.5 font-mono text-xs text-slate-600">{c.whatsapp}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums">
                        {formatNumberID(c.orderCount)}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums">
                        {formatRupiah(c.totalBilled)}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold tabular-nums text-emerald-700">
                        {formatRupiah(c.totalPaid)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
