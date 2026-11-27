import React, { useState } from 'react';
import {
  BarChart3,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Receipt,
  Settings,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type { AppRoute, Profile } from '../../types/database';
import { JawaraLogo } from '../JawaraLogo';

interface NavItem {
  id: AppRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Utama',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'orders', label: 'Order Service', icon: ClipboardList },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { id: 'customers', label: 'Data Pelanggan', icon: Users },
      { id: 'technicians', label: 'Data Teknisi', icon: Wrench },
    ],
  },
  {
    title: 'Keuangan & Dokumen',
    items: [
      { id: 'payments', label: 'Pembayaran', icon: CreditCard },
      { id: 'invoices', label: 'Invoice', icon: FileText },
      { id: 'expenses', label: 'Pengeluaran', icon: Receipt },
      { id: 'reports', label: 'Laporan', icon: BarChart3 },
    ],
  },
  {
    title: 'Operasional',
    items: [
      { id: 'inventory', label: 'Inventaris & Part', icon: Package },
      { id: 'settings', label: 'Pengaturan', icon: Settings },
    ],
  },
];

const ROUTE_TITLES: Record<AppRoute, string> = {
  dashboard: 'Dashboard Operasional',
  orders: 'Order Masuk & Service',
  technicians: 'Data Teknisi',
  customers: 'Data Pelanggan',
  payments: 'Keuangan — Pembayaran',
  invoices: 'Invoice Pelanggan',
  expenses: 'Keuangan — Pengeluaran',
  inventory: 'Inventaris & Sparepart',
  reports: 'Laporan Bisnis & Keuangan',
  settings: 'Pengaturan Bisnis & Admin',
};

interface LayoutProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onQuickNewOrder: () => void;
  profile: Profile | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentRoute,
  onNavigate,
  onQuickNewOrder,
  profile,
  onLogout,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (id: AppRoute) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-navy-900 text-slate-100">
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
        <JawaraLogo variant="light" showTagline />
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
          aria-label="Tutup menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="px-3 mb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = currentRoute === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left min-h-[42px] ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4.5 h-4.5 shrink-0 ${active ? 'text-white' : 'text-sky-300/80'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 bg-navy-950/60">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {profile?.full_name || 'Admin JAWARA AC'}
            </p>
            <p className="text-xs text-slate-400 truncate">{profile?.email || 'Admin'}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Keluar dari akun Admin"
            className="p-2.5 rounded-lg text-slate-300 hover:bg-red-500/20 hover:text-red-200 transition-colors shrink-0"
            aria-label="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Navy Sidebar */}
      <aside className="no-print hidden lg:block w-64 shrink-0 border-r border-slate-200 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10 shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: 3 clean zones */}
        <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-700 hover:bg-slate-100 min-w-[42px] min-h-[42px] flex items-center justify-center"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {ROUTE_TITLES[currentRoute]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onQuickNewOrder}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Order Baru</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
