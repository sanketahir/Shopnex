import React, { useState } from 'react';
import {
  BarChart3,
  Bell,
  Check,
  CreditCard,
  LayoutDashboard,
  Package,
  Palette,
  Plus,
  Settings,
  ShieldAlert,
  Store,
  Trash2,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useTechora } from '../context/TechoraContext';
import type { OrderStatus, Product, Shop, UserRole } from '../types/techora';
import { calculateDiscountedPrice } from '../utils/commerce';
import { AdminCustomizationStudio } from './AdminCustomizationStudio';
import { ConfirmDialog } from './ConfirmDialog';

type AdminTab =
  | 'overview'
  | 'shops'
  | 'products'
  | 'orders'
  | 'customers'
  | 'customization'
  | 'payments'
  | 'delivery'
  | 'notifications'
  | 'reports'
  | 'settings';

export function SuperAdminDashboard() {
  const {
    currentUser,
    adminData,
    effectiveSettings,
    apiFetch,
    refreshAll,
    showToast,
    setAuthModalOpen,
  } = useTechora();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [orderFilter, setOrderFilter] = useState<'all' | OrderStatus>('all');
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Confirmations
  const [deleteShopTarget, setDeleteShopTarget] = useState<Shop | null>(null);
  const [deleteProdTarget, setDeleteProdTarget] = useState<Product | null>(null);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);

  // Category quick add
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Quick Add Shop
  const [addShopOpen, setAddShopOpen] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newShopDesc, setNewShopDesc] = useState('');
  const [newShopAddr, setNewShopAddr] = useState('');
  const [newShopCity, setNewShopCity] = useState('San Francisco');
  const [newShopPhone, setNewShopPhone] = useState('+1 415 555 0150');
  const [newShopCat, setNewShopCat] = useState('Audio & Sound');

  // Quick Add Product
  const [addProdOpen, setAddProdOpen] = useState(false);
  const [newProdShopId, setNewProdShopId] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('149');
  const [newProdDiscount, setNewProdDiscount] = useState('0');
  const [newProdStock, setNewProdStock] = useState('20');
  const [newProdCat, setNewProdCat] = useState('Audio & Sound');

  // Broadcast Notification
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMsg, setNotifMsg] = useState('');
  const [notifRole, setNotifRole] = useState<'all' | UserRole>('all');

  if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin')) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-zinc-400" />
        <h2 className="mt-4 font-display text-2xl font-bold text-zinc-950">
          Super Admin Console Restricted
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Sign in with a Super Admin or Admin account to manage shops, orders, payments, and app customization.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="mt-6 rounded-lg bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Sign In as Super Admin
        </button>
      </div>
    );
  }

  if (!adminData) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-sm text-zinc-500">
        Loading Super Admin dataset...
      </div>
    );
  }

  const currency = effectiveSettings.paymentSettings.currencySymbol;
  const { analytics } = adminData;

  const runAction = async (fn: () => Promise<void>, successToast: string) => {
    setBusy(true);
    setErrMsg(null);
    try {
      await fn();
      await refreshAll();
      showToast(successToast);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  };

  const sidebarItems: Array<{
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'shops', label: `Shops (${adminData.shops.length})`, icon: Store },
    { id: 'products', label: `Products & Categories`, icon: Package },
    { id: 'orders', label: `Orders (${adminData.orders.length})`, icon: Truck },
    { id: 'customers', label: `Users (${adminData.users.length})`, icon: Users },
    { id: 'customization', label: 'App Customization', icon: Palette },
    { id: 'payments', label: 'Payments & Refunds', icon: CreditCard },
    { id: 'delivery', label: 'Delivery System', icon: Truck },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Admin Settings', icon: Settings },
  ];

  const filteredOrders =
    orderFilter === 'all'
      ? adminData.orders
      : adminData.orders.filter((o) => o.orderStatus === orderFilter);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAction(async () => {
      await apiFetch('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName, description: newCatDesc }),
      });
      setNewCatName('');
      setNewCatDesc('');
    }, 'Category created');
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAction(async () => {
      await apiFetch('/api/shops', {
        method: 'POST',
        body: JSON.stringify({
          name: newShopName,
          description: newShopDesc,
          address: newShopAddr,
          city: newShopCity,
          phone: newShopPhone,
          category: newShopCat,
        }),
      });
      setAddShopOpen(false);
      setNewShopName('');
      setNewShopDesc('');
      setNewShopAddr('');
    }, 'Shop created and activated');
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetShop = newProdShopId || adminData.shops[0]?.id;
    await runAction(async () => {
      await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          shopId: targetShop,
          name: newProdName,
          category: newProdCat,
          price: Number(newProdPrice),
          discountPercent: Number(newProdDiscount),
          stock: Number(newProdStock),
        }),
      });
      setAddProdOpen(false);
      setNewProdName('');
    }, 'Product published');
  };

  const handleBroadcastNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAction(async () => {
      await apiFetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          title: notifTitle,
          message: notifMsg,
          targetRole: notifRole,
          type: 'promo',
        }),
      });
      setNotifTitle('');
      setNotifMsg('');
    }, 'Notification broadcasted');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-1">
            <div className="px-3 py-2 border-b border-zinc-100 mb-2">
              <p className="text-xs font-semibold text-zinc-950">
                {effectiveSettings.appDisplayName} Control Center
              </p>
              <p className="text-xs text-zinc-500 capitalize">
                {currentUser.name} · {currentUser.role.replace('_', ' ')}
              </p>
            </div>
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setErrMsg(null);
                  }}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                    active
                      ? 'bg-zinc-950 text-white'
                      : 'text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Admin Content */}
        <div className="lg:col-span-9 space-y-6">
          {errMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errMsg}
            </div>
          )}

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-bold text-zinc-950">
                  Super Admin Overview
                </h1>
                <p className="mt-1 text-xs text-zinc-500">
                  Real-time multi-vendor telemetry across shops, sellers, customers, and revenue.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Total Shops', value: analytics.totalShops },
                  { label: 'Active Shops', value: analytics.activeShops },
                  { label: 'Total Customers', value: analytics.totalCustomers },
                  { label: 'Total Sellers', value: analytics.totalSellers },
                  { label: 'Total Products', value: analytics.totalProducts },
                  { label: 'Total Orders', value: analytics.totalOrders },
                  { label: 'Pending Orders', value: analytics.pendingOrders },
                  {
                    label: 'Total Revenue',
                    value: `${currency}${analytics.totalRevenue.toFixed(2)}`,
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-xl border border-zinc-200 bg-white p-5"
                  >
                    <p className="text-xs font-medium text-zinc-500">{kpi.label}</p>
                    <p className="mt-2 font-mono-num text-2xl font-bold text-zinc-950">
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Pending Seller Approvals Alert */}
              {analytics.pendingShopApprovals > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50/60 p-5">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">
                      {analytics.pendingShopApprovals} Seller Shop Application(s) Pending Review
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      Review shop credentials before allowing products on the marketplace.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('shops')}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Review Applications
                  </button>
                </div>
              )}

              {/* Support Tickets Queue */}
              <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                <div className="border-b border-zinc-200 px-5 py-3.5">
                  <h2 className="text-sm font-semibold text-zinc-950">Recent Support Tickets</h2>
                </div>
                <div className="divide-y divide-zinc-100">
                  {adminData.supportTickets.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-zinc-950">
                          {t.subject} · {t.userName}
                        </p>
                        <p className="text-zinc-600 mt-0.5">{t.message}</p>
                      </div>
                      {t.status === 'open' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              () =>
                                apiFetch(`/api/support/${t.id}/resolve`, {
                                  method: 'PUT',
                                }).then(() => undefined),
                              'Support ticket resolved',
                            )
                          }
                          className="rounded-lg bg-zinc-950 px-3 py-1.5 font-medium text-white"
                        >
                          Mark Resolved
                        </button>
                      ) : (
                        <span className="text-emerald-700 font-semibold">Resolved</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SHOP MANAGEMENT */}
          {tab === 'shops' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-zinc-950">
                  Shop & Seller Management
                </h2>
                <button
                  type="button"
                  onClick={() => setAddShopOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Shop
                </button>
              </div>

              {addShopOpen && (
                <form
                  onSubmit={handleCreateShop}
                  className="rounded-xl border border-zinc-200 bg-white p-5 grid gap-3 sm:grid-cols-2"
                >
                  <input
                    type="text"
                    required
                    placeholder="Shop Name"
                    value={newShopName}
                    onChange={(e) => setNewShopName(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={newShopCat}
                    onChange={(e) => setNewShopCat(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    {adminData.categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Street Address"
                    value={newShopAddr}
                    onChange={(e) => setNewShopAddr(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    required
                    placeholder="City"
                    value={newShopCity}
                    onChange={(e) => setNewShopCity(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Phone"
                    value={newShopPhone}
                    onChange={(e) => setNewShopPhone(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Short Description"
                    value={newShopDesc}
                    onChange={(e) => setNewShopDesc(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <div className="sm:col-span-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAddShopOpen(false)}
                      className="rounded-lg border border-zinc-300 px-4 py-2 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                    >
                      Save Shop
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {adminData.shops.map((shop) => (
                  <div
                    key={shop.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-950">{shop.name}</p>
                      <p className="text-xs text-zinc-500">
                        {shop.category} · {shop.city} · Status:{' '}
                        <span className="capitalize font-semibold text-zinc-900">{shop.status}</span>{' '}
                        · {shop.isOpen ? 'Open' : 'Closed'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {shop.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void runAction(
                                () =>
                                  apiFetch(`/api/shops/${shop.id}/status`, {
                                    method: 'PUT',
                                    body: JSON.stringify({ status: 'approved' }),
                                  }).then(() => undefined),
                                `${shop.name} approved`,
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void runAction(
                                () =>
                                  apiFetch(`/api/shops/${shop.id}/status`, {
                                    method: 'PUT',
                                    body: JSON.stringify({ status: 'rejected' }),
                                  }).then(() => undefined),
                                `${shop.name} rejected`,
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600"
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        </>
                      )}
                      {shop.status === 'approved' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              () =>
                                apiFetch(`/api/shops/${shop.id}/status`, {
                                  method: 'PUT',
                                  body: JSON.stringify({ status: 'inactive' }),
                                }).then(() => undefined),
                              `${shop.name} deactivated`,
                            )
                          }
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700"
                        >
                          Deactivate
                        </button>
                      )}
                      {shop.status === 'inactive' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              () =>
                                apiFetch(`/api/shops/${shop.id}/status`, {
                                  method: 'PUT',
                                  body: JSON.stringify({ status: 'approved' }),
                                }).then(() => undefined),
                              `${shop.name} activated`,
                            )
                          }
                          className="rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Delete ${shop.name}`}
                        onClick={() => setDeleteShopTarget(shop)}
                        className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PRODUCT & CATEGORY MANAGEMENT */}
          {tab === 'products' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-zinc-950">
                  Products & Categories
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setNewProdShopId(adminData.shops[0]?.id || '');
                    setAddProdOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Product
                </button>
              </div>

              {addProdOpen && (
                <form
                  onSubmit={handleCreateProduct}
                  className="rounded-xl border border-zinc-200 bg-white p-5 grid gap-3 sm:grid-cols-3"
                >
                  <select
                    value={newProdShopId}
                    onChange={(e) => setNewProdShopId(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    {adminData.shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Product Name"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={newProdCat}
                    onChange={(e) => setNewProdCat(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    {adminData.categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="Price"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono-num"
                  />
                  <input
                    type="number"
                    min={0}
                    max={75}
                    placeholder="Discount %"
                    value={newProdDiscount}
                    onChange={(e) => setNewProdDiscount(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono-num"
                  />
                  <input
                    type="number"
                    required
                    min={0}
                    placeholder="Stock"
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono-num"
                  />
                  <div className="sm:col-span-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAddProdOpen(false)}
                      className="rounded-lg border border-zinc-300 px-4 py-2 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                    >
                      Publish Product
                    </button>
                  </div>
                </form>
              )}

              {/* Categories Bar */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-950">Manage Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {adminData.categories.map((c) => (
                    <div
                      key={c.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs"
                    >
                      <span className="font-medium text-zinc-900">{c.name}</span>
                      <button
                        type="button"
                        aria-label={`Delete category ${c.name}`}
                        onClick={() => setDeleteCatId(c.id)}
                        className="text-zinc-400 hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleCreateCategory} className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    required
                    placeholder="New Category Name"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    className="flex-1 min-w-[180px] rounded-lg border border-zinc-300 px-3 py-1.5 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-zinc-950 px-4 py-1.5 text-xs font-semibold text-white"
                  >
                    Add Category
                  </button>
                </form>
              </div>

              {/* Products Table */}
              <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Shop</th>
                      <th className="px-4 py-3 font-medium text-right">Final Price</th>
                      <th className="px-4 py-3 font-medium text-right">Stock</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {adminData.products.map((p) => {
                      const shop = adminData.shops.find((s) => s.id === p.shopId);
                      return (
                        <tr key={p.id}>
                          <td className="px-4 py-3 font-medium text-zinc-950">{p.name}</td>
                          <td className="px-4 py-3 text-zinc-600">{shop?.name}</td>
                          <td className="px-4 py-3 text-right font-mono-num">
                            {currency}
                            {calculateDiscountedPrice(p.price, p.discountPercent).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono-num">{p.stock}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              aria-label={`Delete ${p.name}`}
                              onClick={() => setDeleteProdTarget(p)}
                              className="rounded p-1 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ORDER MANAGEMENT */}
          {tab === 'orders' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold text-zinc-950">Order Management</h2>
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const).map(
                    (f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setOrderFilter(f)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                          orderFilter === f
                            ? 'bg-zinc-950 text-white'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {f}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {filteredOrders.map((o) => (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4"
                  >
                    <div>
                      <p className="text-xs text-zinc-500">
                        <span className="font-mono-num font-bold text-zinc-950">
                          {o.orderNumber}
                        </span>{' '}
                        · {o.shopName} · Customer: {o.customerName}
                      </p>
                      <p className="mt-1 text-xs font-medium text-zinc-700 capitalize">
                        Status: <span className="text-blue-600 font-semibold">{o.orderStatus}</span>{' '}
                        · Payment: {o.paymentStatus}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num text-sm font-bold text-zinc-950 mr-2">
                        {currency}
                        {o.total.toFixed(2)}
                      </span>
                      {o.orderStatus === 'pending' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              () =>
                                apiFetch(`/api/orders/${o.id}/status`, {
                                  method: 'PUT',
                                  body: JSON.stringify({ status: 'confirmed' }),
                                }).then(() => undefined),
                              `${o.orderNumber} confirmed`,
                            )
                          }
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Confirm
                        </button>
                      )}
                      {o.orderStatus === 'confirmed' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              () =>
                                apiFetch(`/api/orders/${o.id}/status`, {
                                  method: 'PUT',
                                  body: JSON.stringify({ status: 'shipped' }),
                                }).then(() => undefined),
                              `${o.orderNumber} marked shipped`,
                            )
                          }
                          className="rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Mark Shipped
                        </button>
                      )}
                      {o.orderStatus === 'shipped' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              () =>
                                apiFetch(`/api/orders/${o.id}/status`, {
                                  method: 'PUT',
                                  body: JSON.stringify({ status: 'delivered' }),
                                }).then(() => undefined),
                              `${o.orderNumber} delivered`,
                            )
                          }
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Mark Delivered
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CUSTOMER & USER MANAGEMENT */}
          {tab === 'customers' && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Account Status</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {adminData.users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-zinc-950">{u.name}</p>
                        <p className="text-zinc-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 capitalize">{u.role.replace('_', ' ')}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-semibold capitalize ${
                            u.status === 'active' ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.role !== 'super_admin' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void runAction(
                                () =>
                                  apiFetch(`/api/admin/users/${u.id}/status`, {
                                    method: 'PUT',
                                    body: JSON.stringify({
                                      status: u.status === 'active' ? 'suspended' : 'active',
                                    }),
                                  }).then(() => undefined),
                                `${u.name} status updated`,
                              )
                            }
                            className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-800 hover:bg-zinc-50"
                          >
                            {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* APP CUSTOMIZATION */}
          {tab === 'customization' && <AdminCustomizationStudio mode="customization" />}

          {/* PAYMENTS, COMMISSIONS & REFUNDS */}
          {tab === 'payments' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-zinc-950">
                    Payments, Commissions & Refunds
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Gateway: {effectiveSettings.paymentSettings.gatewayProvider} · Platform
                    Commission: {effectiveSettings.paymentSettings.platformCommissionPercent}%
                  </p>
                </div>
                <p className="font-mono-num text-sm font-bold text-blue-600">
                  Earned Commission: {currency}
                  {analytics.totalPlatformCommission.toFixed(2)}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Order / Ref</th>
                      <th className="px-4 py-3 font-medium">Shop</th>
                      <th className="px-4 py-3 font-medium">Method</th>
                      <th className="px-4 py-3 font-medium text-right">Amount</th>
                      <th className="px-4 py-3 font-medium text-right">Commission</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Refund</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {adminData.payments.map((pay) => (
                      <tr key={pay.id}>
                        <td className="px-4 py-3">
                          <p className="font-mono-num font-semibold text-zinc-950">
                            {pay.orderNumber}
                          </p>
                          <p className="font-mono-num text-zinc-500">{pay.gatewayRef}</p>
                        </td>
                        <td className="px-4 py-3">{pay.shopName}</td>
                        <td className="px-4 py-3 uppercase">
                          {pay.method} {pay.cardLast4 ? `•••• ${pay.cardLast4}` : ''}
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num font-semibold">
                          {currency}
                          {pay.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num text-zinc-600">
                          {currency}
                          {pay.platformCommission.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 capitalize font-semibold">{pay.status}</td>
                        <td className="px-4 py-3 text-right">
                          {pay.status !== 'refunded' && pay.status !== 'failed' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void runAction(
                                  () =>
                                    apiFetch(`/api/payments/${pay.id}/refund`, {
                                      method: 'POST',
                                      body: JSON.stringify({
                                        reason: 'Admin approved refund',
                                      }),
                                    }).then(() => undefined),
                                  `Refunded ${pay.orderNumber}`,
                                )
                              }
                              className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50"
                            >
                              Issue Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DELIVERY SYSTEM */}
          {tab === 'delivery' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 grid gap-4 sm:grid-cols-3 text-xs">
                <div>
                  <p className="text-zinc-500">Base Delivery Fee</p>
                  <p className="mt-1 font-mono-num text-lg font-bold text-zinc-950">
                    {currency}
                    {effectiveSettings.deliverySettings.baseDeliveryCharge.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Free Threshold</p>
                  <p className="mt-1 font-mono-num text-lg font-bold text-zinc-950">
                    {currency}
                    {effectiveSettings.deliverySettings.freeDeliveryThreshold.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Primary Courier Partner</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-950">
                    {effectiveSettings.deliverySettings.defaultPartnerName}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {adminData.orders.map((o) => (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-xs"
                  >
                    <div>
                      <p className="font-mono-num font-bold text-zinc-950">{o.orderNumber}</p>
                      <p className="text-zinc-600">
                        {o.deliveryAddress.street}, {o.deliveryAddress.city}{' '}
                        {o.deliveryAddress.postalCode}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold capitalize text-blue-600">{o.orderStatus}</p>
                      <p className="font-mono-num text-zinc-500">
                        {o.deliveryPartner
                          ? `${o.deliveryPartner.name} (${o.deliveryPartner.trackingCode})`
                          : 'Awaiting courier dispatch'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NOTIFICATIONS BROADCASTER */}
          {tab === 'notifications' && (
            <div className="space-y-6">
              <form
                onSubmit={handleBroadcastNotification}
                className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3"
              >
                <h2 className="font-display text-lg font-bold text-zinc-950">
                  Broadcast Notification
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    required
                    placeholder="Notification Title"
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={notifRole}
                    onChange={(e) => setNotifRole(e.target.value as 'all' | UserRole)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="all">All Users (Promotional)</option>
                    <option value="customer">Customers Only</option>
                    <option value="seller">Sellers Only</option>
                    <option value="admin">Admins Only</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  required
                  placeholder="Notification message..."
                  value={notifMsg}
                  onChange={(e) => setNotifMsg(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-zinc-950 px-5 py-2 text-xs font-semibold text-white"
                >
                  Send Notification
                </button>
              </form>

              <div className="space-y-2">
                {adminData.notifications.slice(0, 15).map((n) => (
                  <div key={n.id} className="rounded-xl border border-zinc-200 bg-white p-4 text-xs">
                    <div className="flex justify-between font-semibold text-zinc-950">
                      <span>{n.title}</span>
                      <span className="capitalize text-zinc-500">Target: {n.targetRole}</span>
                    </div>
                    <p className="mt-1 text-zinc-600">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REPORTS & ANALYTICS */}
          {tab === 'reports' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-zinc-200 bg-white p-6">
                <h2 className="font-display text-lg font-bold text-zinc-950">
                  Monthly Revenue & Orders
                </h2>
                <div className="mt-4 space-y-3">
                  {analytics.monthlyRevenue.map((m) => {
                    const maxRev = Math.max(
                      1,
                      ...analytics.monthlyRevenue.map((x) => x.revenue),
                    );
                    const pct = Math.round((m.revenue / maxRev) * 100);
                    return (
                      <div key={m.month} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-mono-num font-semibold">{m.month}</span>
                          <span className="font-mono-num text-zinc-700">
                            {currency}
                            {m.revenue.toFixed(2)} ({m.orders} orders)
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-zinc-100">
                          <div
                            className="h-2.5 rounded-full bg-blue-600"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-zinc-950 mb-3">Shop Performance</h3>
                  <div className="space-y-2.5 text-xs">
                    {analytics.shopPerformance.map((sp) => (
                      <div key={sp.shopId} className="flex justify-between">
                        <span className="font-medium text-zinc-800">{sp.shopName}</span>
                        <span className="font-mono-num text-zinc-600">
                          {sp.orderCount} orders · {currency}
                          {sp.revenue.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-zinc-950 mb-3">
                    Top Product Performance
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    {analytics.productPerformance.map((pp) => (
                      <div key={pp.productId} className="flex justify-between">
                        <span className="font-medium text-zinc-800 truncate pr-3">
                          {pp.productName}
                        </span>
                        <span className="font-mono-num text-zinc-600 shrink-0">
                          {pp.unitsSold} sold · {currency}
                          {pp.revenue.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CENTRAL ADMIN SETTINGS */}
          {tab === 'settings' && <AdminCustomizationStudio mode="settings" />}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteShopTarget)}
        title="Delete Shop"
        description={`Deleting "${deleteShopTarget?.name}" will also remove all products owned by that shop. Continue?`}
        confirmLabel="Delete Shop"
        busy={busy}
        onConfirm={() => {
          if (!deleteShopTarget) return;
          void runAction(async () => {
            await apiFetch(`/api/shops/${deleteShopTarget.id}`, { method: 'DELETE' });
            setDeleteShopTarget(null);
          }, 'Shop deleted');
        }}
        onCancel={() => setDeleteShopTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteProdTarget)}
        title="Delete Product"
        description={`Permanently delete "${deleteProdTarget?.name}" from the marketplace?`}
        confirmLabel="Delete Product"
        busy={busy}
        onConfirm={() => {
          if (!deleteProdTarget) return;
          void runAction(async () => {
            await apiFetch(`/api/products/${deleteProdTarget.id}`, { method: 'DELETE' });
            setDeleteProdTarget(null);
          }, 'Product deleted');
        }}
        onCancel={() => setDeleteProdTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteCatId)}
        title="Delete Category"
        description="Are you sure you want to delete this product category?"
        confirmLabel="Delete Category"
        busy={busy}
        onConfirm={() => {
          if (!deleteCatId) return;
          void runAction(async () => {
            await apiFetch(`/api/categories/${deleteCatId}`, { method: 'DELETE' });
            setDeleteCatId(null);
          }, 'Category deleted');
        }}
        onCancel={() => setDeleteCatId(null)}
      />
    </div>
  );
}
