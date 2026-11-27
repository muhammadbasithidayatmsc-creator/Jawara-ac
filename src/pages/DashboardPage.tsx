import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import { formatDateID, formatNumberID, formatRupiah, todayISO } from '../lib/format';
import {
  ORDER_STATUSES,
  type AppRoute,
  type Customer,
  type Expense,
  type Order,
  type Payment,
  type Technician,
} from '../types/database';
import { OrderStatusLabel, PaymentStatusLabel } from '../components/ui/StatusBadge';

interface DashboardPageProps {
  orders: Order[];
  customers: Customer[];
  technicians: Technician[];
  payments: Payment[];
  expenses: Expense[];
  loading: boolean;
  onNavigate: (route: AppRoute) => void;
  onSelectOrder: (order: Order) => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const DashboardPage: React.FC<DashboardPageProps> = ({
  orders,
  customers,
  technicians,
  payments,
  expenses,
  loading,
  onNavigate,
  onSelectOrder,
}) => {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const today = todayISO();
  const currentYear = Number(today.slice(0, 4));

  const stats = useMemo(() => {
    const activeOrders = orders.filter((o) => !o.is_archived);
    const todayOrders = activeOrders.filter((o) => o.service_date === today);
    const nonCancelledOrders = activeOrders.filter((o) => o.status !== 'Dibatalkan');
    const inProgressOrders = activeOrders.filter((o) => o.status === 'Dikerjakan');
    const completedOrders = activeOrders.filter((o) => o.status === 'Selesai');

    const validPayments = payments.filter((p) => !p.is_void);
    const todayPayments = validPayments
      .filter((p) => p.payment_date.slice(0, 10) === today)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalRevenue = validPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const netBalance = totalRevenue - totalExpenses;

    const activeTechCount = technicians.filter((t) => t.is_active).length;

    return {
      todayOrderCount: todayOrders.length,
      totalIncomingCount: nonCancelledOrders.length,
      inProgressCount: inProgressOrders.length,
      completedCount: completedOrders.length,
      customerCount: customers.length,
      activeTechCount,
      totalTechCount: technicians.length,
      todayPayments,
      totalRevenue,
      totalExpenses,
      netBalance,
      todaySchedule: todayOrders.sort((a, b) =>
        (a.service_time || '99:99').localeCompare(b.service_time || '99:99')
      ),
      recentOrders: activeOrders.slice(0, 6),
    };
  }, [orders, customers, technicians, payments, expenses, today]);

  const statusSummary = useMemo(() => {
    const active = orders.filter((o) => !o.is_archived);
    const total = active.length || 1;
    return ORDER_STATUSES.map((status) => {
      const count = active.filter((o) => o.status === status).length;
      return {
        status,
        count,
        pct: Math.round((count / total) * 100),
      };
    });
  }, [orders]);

  const monthlySeries = useMemo(() => {
    const validPayments = payments.filter((p) => !p.is_void);
    const rows = MONTH_NAMES.map((label, idx) => {
      const monthPrefix = `${currentYear}-${String(idx + 1).padStart(2, '0')}`;
      const income = validPayments
        .filter((p) => p.payment_date.slice(0, 7) === monthPrefix)
        .reduce((s, p) => s + Number(p.amount), 0);
      const expense = expenses
        .filter((e) => e.expense_date.slice(0, 7) === monthPrefix)
        .reduce((s, e) => s + Number(e.amount), 0);
      return { idx, label, income, expense };
    });
    const maxVal = Math.max(
      1,
      ...rows.map((r) => Math.max(r.income, r.expense))
    );
    return { rows, maxVal };
  }, [payments, expenses, currentYear]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, idx) => (
            <div key={idx} className="h-24 rounded-xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Grid: 9 Metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Order Hari Ini</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {formatNumberID(stats.todayOrderCount)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Order Masuk</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {formatNumberID(stats.totalIncomingCount)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Sedang Dikerjakan</p>
            <p className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
              {formatNumberID(stats.inProgressCount)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Order Selesai</p>
            <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
              {formatNumberID(stats.completedCount)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Pelanggan</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {formatNumberID(stats.customerCount)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Jumlah Teknisi</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {formatNumberID(stats.activeTechCount)}
              <span className="text-xs font-normal text-slate-500 ml-1">
                / {formatNumberID(stats.totalTechCount)} total
              </span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Pembayaran Hari Ini</p>
            <p className="text-xl font-bold text-blue-700 font-mono tabular-nums mt-1">
              {formatRupiah(stats.todayPayments)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Pengeluaran</p>
            <p className="text-xl font-bold text-red-700 font-mono tabular-nums mt-1">
              {formatRupiah(stats.totalExpenses)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-navy-900 text-white rounded-xl border border-navy-800 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-sky-200">Saldo Bersih (Kas Aktual)</p>
            <p className="text-xl font-bold text-white font-mono tabular-nums mt-1">
              {formatRupiah(stats.netBalance)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-white/10 text-sky-300 flex items-center justify-center shrink-0">
            {stats.netBalance >= 0 ? (
              <TrendingUp className="w-5 h-5" />
            ) : (
              <Wallet className="w-5 h-5" />
            )}
          </div>
        </div>
      </section>

      {/* Chart + Order Status Breakdown */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Monthly Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Grafik Pendapatan &amp; Pengeluaran {currentYear}
              </h2>
              <p className="text-xs text-slate-500">
                Berdasarkan transaksi pembayaran &amp; pengeluaran aktual tercatat
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
                Pendapatan
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-300" />
                Pengeluaran
              </span>
            </div>
          </div>

          <div className="relative h-56 flex items-end gap-1.5 sm:gap-3 pt-6 pb-2 border-b border-slate-200">
            {monthlySeries.rows.map((m) => {
              const incH = Math.round((m.income / monthlySeries.maxVal) * 100);
              const expH = Math.round((m.expense / monthlySeries.maxVal) * 100);
              return (
                <div
                  key={m.label}
                  onMouseEnter={() => setHoveredMonth(m.idx)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  className="flex-1 h-full flex flex-col justify-end items-center group relative"
                >
                  {hoveredMonth === m.idx && (
                    <div className="absolute -top-2 z-20 bg-navy-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap pointer-events-none">
                      <div className="font-semibold">{m.label} {currentYear}</div>
                      <div className="font-mono text-sky-300">Masuk: {formatRupiah(m.income)}</div>
                      <div className="font-mono text-slate-300">Keluar: {formatRupiah(m.expense)}</div>
                    </div>
                  )}
                  <div className="w-full h-[85%] flex items-end justify-center gap-0.5 sm:gap-1">
                    <div
                      style={{ height: `${Math.max(m.income > 0 ? 6 : 2, incH)}%` }}
                      className="w-2.5 sm:w-3.5 bg-blue-600 group-hover:bg-blue-700 rounded-t transition-all"
                    />
                    <div
                      style={{ height: `${Math.max(m.expense > 0 ? 6 : 2, expH)}%` }}
                      className="w-2.5 sm:w-3.5 bg-slate-300 group-hover:bg-slate-400 rounded-t transition-all"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1.5 font-medium">{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Ringkasan Status Order</h2>
            <p className="text-xs text-slate-500 mt-0.5">Distribusi seluruh order aktif</p>

            <div className="mt-4 space-y-3">
              {statusSummary.map((row) => (
                <div key={row.status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{row.status}</span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {row.count} ({row.pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      style={{ width: `${row.pct}%` }}
                      className={`h-full rounded-full ${
                        row.status === 'Selesai'
                          ? 'bg-emerald-600'
                          : row.status === 'Dibatalkan'
                          ? 'bg-red-500'
                          : row.status === 'Dikerjakan'
                          ? 'bg-amber-500'
                          : 'bg-blue-600'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="mt-5 w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <span>Kelola Semua Order</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Today's Schedule + Recent Orders */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Jadwal Hari Ini */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Jadwal Service Hari Ini</h2>
              <p className="text-xs text-slate-500">{formatDateID(today)}</p>
            </div>
            <span className="text-xs font-mono font-semibold text-blue-700">
              {stats.todaySchedule.length} jadwal
            </span>
          </div>

          {stats.todaySchedule.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
              Belum ada jadwal service untuk hari ini.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {stats.todaySchedule.map((ord) => (
                <button
                  key={ord.id}
                  type="button"
                  onClick={() => onSelectOrder(ord)}
                  className="w-full py-3 text-left hover:bg-slate-50 transition-colors rounded-lg px-2 -mx-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-blue-700">
                      {ord.service_time ? `${ord.service_time.slice(0, 5)} WIB` : 'Waktu fleksibel'}
                    </span>
                    <OrderStatusLabel status={ord.status} />
                  </div>
                  <p className="text-sm font-semibold text-slate-900 mt-1 truncate">
                    {ord.customer_name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {ord.service_name} · {ord.technician_name || 'Teknisi belum dipilih'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Order Terbaru */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Daftar Order Terbaru</h2>
              <p className="text-xs text-slate-500">Klik baris order untuk melihat rincian &amp; pembayaran</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('orders')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              <span>Lihat Semua</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {stats.recentOrders.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
              Belum ada order masuk. Klik tombol <strong>+ Order Baru</strong> di pojok kanan atas untuk mencatat order pertama.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="py-2.5 text-left font-semibold">Order</th>
                      <th className="py-2.5 text-left font-semibold">Pelanggan &amp; Layanan</th>
                      <th className="py-2.5 text-left font-semibold">Status</th>
                      <th className="py-2.5 text-right font-semibold">Tagihan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {stats.recentOrders.map((ord) => (
                      <tr
                        key={ord.id}
                        onClick={() => onSelectOrder(ord)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="py-3 pr-3">
                          <div className="font-mono text-xs font-semibold text-blue-700">
                            {ord.order_number}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatDateID(ord.service_date)}
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-slate-900">{ord.customer_name}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[240px]">
                            {ord.service_name}
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap gap-1.5">
                            <OrderStatusLabel status={ord.status} />
                            <PaymentStatusLabel status={ord.payment_status} />
                          </div>
                        </td>
                        <td className="py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                          {formatRupiah(ord.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-2.5">
                {stats.recentOrders.map((ord) => (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => onSelectOrder(ord)}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-blue-700">
                        {ord.order_number}
                      </span>
                      <span className="text-xs text-slate-500">{formatDateID(ord.service_date)}</span>
                    </div>
                    <div className="font-semibold text-sm text-slate-900">{ord.customer_name}</div>
                    <div className="text-xs text-slate-600">{ord.service_name}</div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-wrap gap-1.5">
                        <OrderStatusLabel status={ord.status} />
                        <PaymentStatusLabel status={ord.payment_status} />
                      </div>
                      <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                        {formatRupiah(ord.total_amount)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
