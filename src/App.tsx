import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { OrderDetailModal } from './components/orders/OrderDetailModal';
import { OrderFormModal } from './components/orders/OrderFormModal';
import { Layout } from './components/ui/Layout';
import { ToastProvider, useToast } from './components/ui/Toast';
import {
  api,
  clearAuthToken,
  formatApiError,
  getAuthToken,
  setUnauthorizedHandler,
} from './lib/api';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { InventoryPage } from './pages/InventoryPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { LoginPage } from './pages/LoginPage';
import { OrdersPage } from './pages/OrdersPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TechniciansPage } from './pages/TechniciansPage';
import type {
  AppRoute,
  BusinessSettings,
  Customer,
  Expense,
  ExpenseCategory,
  InventoryItem,
  Invoice,
  Order,
  Payment,
  Profile,
  StockMovement,
  Technician,
} from './types/database';

const AppContent: React.FC = () => {
  const { showToast } = useToast();

  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [currentRoute, setCurrentRoute] = useState<AppRoute>('dashboard');
  const [loadingData, setLoadingData] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Live SQLite internal backend data
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);

  // Global modals for Order creation/editing & detail
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadAllData = useCallback(async () => {
    setLoadingData(true);
    setLoadError('');
    try {
      const data = await api.bootstrap();
      setOrders(data.orders || []);
      setCustomers(data.customers || []);
      setTechnicians(data.technicians || []);
      setPayments(data.payments || []);
      setExpenses(data.expenses || []);
      setExpenseCategories(data.expenseCategories || []);
      setInventoryItems(data.inventoryItems || []);
      setStockMovements(data.stockMovements || []);
      setInvoices(data.invoices || []);
      setBusinessSettings(data.businessSettings || null);
    } catch (err) {
      const msg = formatApiError(err, 'Gagal memuat data dari server internal.');
      setLoadError(msg);
      showToast('error', msg);
    } finally {
      setLoadingData(false);
    }
  }, [showToast]);

  const verifySession = useCallback(async () => {
    if (!getAuthToken()) {
      setIsAuthenticated(false);
      setProfile(null);
      setAuthChecking(false);
      return;
    }

    try {
      const { profile: prof } = await api.getMe();
      if (!prof || prof.role !== 'admin' || !prof.is_active) {
        clearAuthToken();
        setIsAuthenticated(false);
        setProfile(null);
      } else {
        setProfile(prof);
        setIsAuthenticated(true);
        await loadAllData();
      }
    } catch {
      clearAuthToken();
      setIsAuthenticated(false);
      setProfile(null);
    } finally {
      setAuthChecking(false);
    }
  }, [loadAllData]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setIsAuthenticated(false);
      setProfile(null);
      setSelectedOrder(null);
    });
    void verifySession();
    return () => {
      setUnauthorizedHandler(() => {});
    };
  }, [verifySession]);

  const handleLogout = async () => {
    clearAuthToken();
    setIsAuthenticated(false);
    setProfile(null);
    setSelectedOrder(null);
    showToast('info', 'Anda telah keluar dari sistem.');
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Memeriksa sesi Admin JAWARA AC...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLoginSuccess={(prof) => {
          setProfile(prof);
          setIsAuthenticated(true);
          void loadAllData();
        }}
      />
    );
  }

  const handleOpenNewOrder = () => {
    setEditingOrder(null);
    setOrderFormOpen(true);
  };

  const handleOpenEditOrder = (ord: Order) => {
    setEditingOrder(ord);
    setOrderFormOpen(true);
  };

  return (
    <Layout
      currentRoute={currentRoute}
      onNavigate={setCurrentRoute}
      onQuickNewOrder={handleOpenNewOrder}
      profile={profile}
      onLogout={handleLogout}
    >
      {loadError && (
        <div className="no-print mb-5 p-4 rounded-xl bg-red-50 border border-red-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-sm text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadAllData()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Muat Ulang</span>
          </button>
        </div>
      )}

      {currentRoute === 'dashboard' && (
        <DashboardPage
          orders={orders}
          customers={customers}
          technicians={technicians}
          payments={payments}
          expenses={expenses}
          loading={loadingData}
          onNavigate={setCurrentRoute}
          onSelectOrder={setSelectedOrder}
        />
      )}

      {currentRoute === 'orders' && (
        <OrdersPage
          orders={orders}
          technicians={technicians}
          settings={businessSettings}
          loading={loadingData}
          onNewOrder={handleOpenNewOrder}
          onEditOrder={handleOpenEditOrder}
          onSelectOrder={setSelectedOrder}
          onRefresh={loadAllData}
        />
      )}

      {currentRoute === 'technicians' && (
        <TechniciansPage
          technicians={technicians}
          loading={loadingData}
          onRefresh={loadAllData}
        />
      )}

      {currentRoute === 'customers' && (
        <CustomersPage
          customers={customers}
          orders={orders}
          loading={loadingData}
          onRefresh={loadAllData}
          onSelectOrder={setSelectedOrder}
        />
      )}

      {currentRoute === 'payments' && (
        <PaymentsPage
          orders={orders}
          payments={payments}
          loading={loadingData}
          onRefresh={loadAllData}
          onSelectOrder={setSelectedOrder}
        />
      )}

      {currentRoute === 'invoices' && (
        <InvoicesPage
          invoices={invoices}
          orders={orders}
          payments={payments}
          settings={businessSettings}
          loading={loadingData}
          onRefresh={loadAllData}
        />
      )}

      {currentRoute === 'expenses' && (
        <ExpensesPage
          expenses={expenses}
          categories={expenseCategories}
          loading={loadingData}
          onRefresh={loadAllData}
        />
      )}

      {currentRoute === 'inventory' && (
        <InventoryPage
          items={inventoryItems}
          movements={stockMovements}
          loading={loadingData}
          onRefresh={loadAllData}
        />
      )}

      {currentRoute === 'reports' && (
        <ReportsPage
          orders={orders}
          customers={customers}
          technicians={technicians}
          payments={payments}
          expenses={expenses}
        />
      )}

      {currentRoute === 'settings' && (
        <SettingsPage
          settings={businessSettings}
          profile={profile}
          onRefresh={async () => {
            await verifySession();
          }}
        />
      )}

      <OrderFormModal
        open={orderFormOpen}
        editingOrder={editingOrder}
        customers={customers}
        technicians={technicians}
        onClose={() => {
          setOrderFormOpen(false);
          setEditingOrder(null);
        }}
        onSaved={(saved) => {
          void loadAllData();
          if (selectedOrder && selectedOrder.id === saved.id) {
            setSelectedOrder(saved);
          }
        }}
      />

      <OrderDetailModal
        order={selectedOrder}
        settings={businessSettings}
        onClose={() => setSelectedOrder(null)}
        onEditOrder={(ord) => {
          setSelectedOrder(null);
          handleOpenEditOrder(ord);
        }}
        onOrderUpdated={(updated) => {
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
          void loadAllData();
        }}
        onOrderDeleted={(deletedId) => {
          setOrders((prev) => prev.filter((o) => o.id !== deletedId));
          void loadAllData();
        }}
      />
    </Layout>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
