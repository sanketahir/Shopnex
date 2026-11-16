import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  Check,
  Edit3,
  Package,
  Plus,
  Power,
  Store,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { useTechora } from '../context/TechoraContext';
import type { OrderStatus, Product } from '../types/techora';
import { calculateDiscountedPrice } from '../utils/commerce';
import { ConfirmDialog } from './ConfirmDialog';

type SellerTab = 'overview' | 'shops' | 'products' | 'orders' | 'notifications';

const IMAGE_PRESETS = [
  { label: 'Studio Headphones', url: '/src/assets/images/product_wireless_headphones_1794818826813.jpg' },
  { label: 'Titanium Smartwatch', url: '/src/assets/images/product_smartwatch_titanium_1794818827887.jpg' },
  { label: 'CNC Mechanical Keyboard', url: '/src/assets/images/product_mechanical_keyboard_1794818827796.jpg' },
  { label: 'Espresso Brewer', url: '/src/assets/images/product_espresso_brewer_1794818828636.jpg' },
  { label: 'Flagship Hardware Banner', url: '/src/assets/images/hero_techora_flagship_1794818827475.jpg' },
  { label: 'Urban Audio Showroom', url: '/src/assets/images/shop_banner_urban_audio_1794818828912.jpg' },
];

export function SellerDashboard() {
  const {
    currentUser,
    sellerData,
    categories,
    effectiveSettings,
    apiFetch,
    refreshAll,
    showToast,
    setAuthModalOpen,
  } = useTechora();

  const [tab, setTab] = useState<SellerTab>('overview');
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Create / Edit Shop Form
  const [shopFormOpen, setShopFormOpen] = useState(false);
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState('');
  const [shopLogoText, setShopLogoText] = useState('');
  const [shopDesc, setShopDesc] = useState('');
  const [shopAddr, setShopAddr] = useState('');
  const [shopCity, setShopCity] = useState('San Francisco');
  const [shopPhone, setShopPhone] = useState('');
  const [shopCat, setShopCat] = useState(categories[0]?.name || 'Audio & Sound');
  const [shopBanner, setShopBanner] = useState(IMAGE_PRESETS[5].url);

  // Create / Edit Product Form
  const [prodFormOpen, setProdFormOpen] = useState(false);
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [prodShopId, setProdShopId] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodCat, setProdCat] = useState(categories[0]?.name || 'Audio & Sound');
  const [prodPrice, setProdPrice] = useState('199');
  const [prodDiscount, setProdDiscount] = useState('0');
  const [prodStock, setProdStock] = useState('15');
  const [prodImg, setProdImg] = useState(IMAGE_PRESETS[0].url);
  const [confirmDeleteProd, setConfirmDeleteProd] = useState<Product | null>(null);

  // Courier shipping form state
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [courierName, setCourierName] = useState(
    effectiveSettings.deliverySettings.defaultPartnerName,
  );
  const [courierPhone, setCourierPhone] = useState(
    effectiveSettings.deliverySettings.defaultPartnerPhone,
  );

  const currency = effectiveSettings.paymentSettings.currencySymbol;

  const salesSummary = useMemo(() => {
    const valid = sellerData.orders.filter(
      (o) => o.orderStatus !== 'cancelled' && o.orderStatus !== 'rejected',
    );
    const gross = valid.reduce((s, o) => s + o.total, 0);
    const payout = valid.reduce((s, o) => s + o.sellerPayout, 0);
    const pending = sellerData.orders.filter((o) => o.orderStatus === 'pending').length;
    return { gross, payout, pending, totalOrders: sellerData.orders.length };
  }, [sellerData.orders]);

  if (!currentUser || (currentUser.role !== 'seller' && currentUser.role !== 'super_admin' && currentUser.role !== 'admin')) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Store className="mx-auto h-10 w-10 text-zinc-400" />
        <h2 className="mt-4 font-display text-2xl font-bold text-zinc-950">
          Seller Dashboard Access Required
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Sign in with a Seller account to manage your local storefront, inventory, and orders.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="mt-6 rounded-lg bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Sign In as Seller
        </button>
      </div>
    );
  }

  const openNewShopForm = () => {
    setEditingShopId(null);
    setShopName('');
    setShopLogoText('');
    setShopDesc('');
    setShopAddr('');
    setShopCity('San Francisco');
    setShopPhone(currentUser.phone || '');
    setShopCat(categories[0]?.name || 'Audio & Sound');
    setShopBanner(IMAGE_PRESETS[5].url);
    setShopFormOpen(true);
  };

  const openEditShopForm = (shopId: string) => {
    const s = sellerData.shops.find((x) => x.id === shopId);
    if (!s) return;
    setEditingShopId(s.id);
    setShopName(s.name);
    setShopLogoText(s.logoText);
    setShopDesc(s.description);
    setShopAddr(s.address);
    setShopCity(s.city);
    setShopPhone(s.phone);
    setShopCat(s.category);
    setShopBanner(s.bannerUrl);
    setShopFormOpen(true);
  };

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrMsg(null);
    try {
      if (editingShopId) {
        await apiFetch(`/api/shops/${editingShopId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: shopName,
            logoText: shopLogoText,
            description: shopDesc,
            address: shopAddr,
            city: shopCity,
            phone: shopPhone,
            category: shopCat,
            bannerUrl: shopBanner,
          }),
        });
        showToast('Shop details updated');
      } else {
        await apiFetch('/api/shops', {
          method: 'POST',
          body: JSON.stringify({
            name: shopName,
            logoText: shopLogoText,
            description: shopDesc,
            address: shopAddr,
            city: shopCity,
            phone: shopPhone,
            category: shopCat,
            bannerUrl: shopBanner,
          }),
        });
        showToast('New shop submitted');
      }
      setShopFormOpen(false);
      await refreshAll();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unable to save shop.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleShopOpen = async (shopId: string) => {
    setBusy(true);
    setErrMsg(null);
    try {
      await apiFetch(`/api/shops/${shopId}/toggle-open`, { method: 'PUT' });
      await refreshAll();
      showToast('Shop availability updated');
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unable to toggle shop status.');
    } finally {
      setBusy(false);
    }
  };

  const openNewProductForm = () => {
    setEditingProdId(null);
    setProdShopId(sellerData.shops[0]?.id || '');
    setProdName('');
    setProdDesc('');
    setProdCat(categories[0]?.name || 'Audio & Sound');
    setProdPrice('199');
    setProdDiscount('0');
    setProdStock('12');
    setProdImg(IMAGE_PRESETS[0].url);
    setProdFormOpen(true);
  };

  const openEditProductForm = (p: Product) => {
    setEditingProdId(p.id);
    setProdShopId(p.shopId);
    setProdName(p.name);
    setProdDesc(p.description);
    setProdCat(p.category);
    setProdPrice(String(p.price));
    setProdDiscount(String(p.discountPercent));
    setProdStock(String(p.stock));
    setProdImg(p.images[0] || IMAGE_PRESETS[0].url);
    setProdFormOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrMsg(null);
    try {
      const payload = {
        shopId: prodShopId,
        name: prodName,
        description: prodDesc,
        category: prodCat,
        price: Number(prodPrice),
        discountPercent: Number(prodDiscount),
        stock: Number(prodStock),
        images: [prodImg],
      };
      if (editingProdId) {
        await apiFetch(`/api/products/${editingProdId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Product updated');
      } else {
        await apiFetch('/api/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Product added to catalog');
      }
      setProdFormOpen(false);
      await refreshAll();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unable to save product.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!confirmDeleteProd) return;
    setBusy(true);
    try {
      await apiFetch(`/api/products/${confirmDeleteProd.id}`, { method: 'DELETE' });
      setConfirmDeleteProd(null);
      await refreshAll();
      showToast('Product deleted');
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unable to delete product.');
    } finally {
      setBusy(false);
    }
  };

  const handleOrderTransition = async (
    orderId: string,
    status: OrderStatus,
    deliveryPartner?: { name: string; phone: string },
  ) => {
    setBusy(true);
    setErrMsg(null);
    try {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, deliveryPartner }),
      });
      setShippingOrderId(null);
      await refreshAll();
      showToast(`Order updated to ${status}`);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unable to update order.');
    } finally {
      setBusy(false);
    }
  };

  const navItems: Array<{ id: SellerTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Sales Reports', icon: BarChart3 },
    { id: 'shops', label: `My Shops (${sellerData.shops.length})`, icon: Store },
    { id: 'products', label: `Products (${sellerData.products.length})`, icon: Package },
    { id: 'orders', label: `Orders (${sellerData.orders.length})`, icon: Truck },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-950">Seller Workspace</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Manage storefronts, inventory, discounts, and incoming customer orders for{' '}
            {currentUser.name}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openNewShopForm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            <Plus className="h-3.5 w-3.5" /> Create Shop
          </button>
          {sellerData.shops.length > 0 && (
            <button
              type="button"
              onClick={openNewProductForm}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
              style={{ backgroundColor: effectiveSettings.primaryColor }}
            >
              <Plus className="h-3.5 w-3.5" /> Add Product
            </button>
          )}
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="mt-5 flex items-center gap-1.5 overflow-x-auto pb-2">
        {navItems.map((n) => {
          const Icon = n.icon;
          const active = tab === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setTab(n.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium whitespace-nowrap shrink-0 ${
                active ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {n.label}
            </button>
          );
        })}
      </div>

      {errMsg && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errMsg}
        </div>
      )}

      {/* Overview & Sales Reports */}
      {tab === 'overview' && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-medium text-zinc-500">Gross Sales</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-zinc-950">
                {currency}
                {salesSummary.gross.toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-medium text-zinc-500">Net Seller Payout</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-blue-600">
                {currency}
                {salesSummary.payout.toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-medium text-zinc-500">Total Orders</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-zinc-950">
                {salesSummary.totalOrders}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-medium text-zinc-500">Pending Action</p>
              <p className="mt-2 font-mono-num text-2xl font-bold text-amber-600">
                {salesSummary.pending}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-950">Shop Status & Quick Controls</h2>
            </div>
            {sellerData.shops.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                You have not registered a shop yet. Click &ldquo;Create Shop&rdquo; above to get started.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {sellerData.shops.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-950">{s.name}</p>
                      <p className="text-xs text-zinc-500">
                        {s.category} · Approval: <span className="capitalize">{s.status}</span> ·{' '}
                        {s.isOpen ? 'Open for Orders' : 'Closed'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        disabled={busy || s.status !== 'approved'}
                        onClick={() => void handleToggleShopOpen(s.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                          s.isOpen
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-zinc-900 text-white hover:bg-zinc-800'
                        } disabled:opacity-50`}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {s.isOpen ? 'Open (Click to Close)' : 'Closed (Click to Open)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditShopForm(s.id)}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Edit Shop
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* My Shops Tab */}
      {tab === 'shops' && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {sellerData.shops.map((s) => (
            <div key={s.id} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <img
                src={s.bannerUrl}
                alt={s.name}
                referrerPolicy="no-referrer"
                className="aspect-[16/9] w-full object-cover"
              />
              <div className="p-5">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    {s.category} · {s.city}
                  </span>
                  <span className="capitalize font-semibold text-zinc-900">{s.status}</span>
                </div>
                <h3 className="mt-1.5 font-display text-lg font-bold text-zinc-950">{s.name}</h3>
                <p className="mt-1 text-xs text-zinc-600">{s.description}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {s.address} · {s.phone}
                </p>
                <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-4">
                  <button
                    type="button"
                    disabled={busy || s.status !== 'approved'}
                    onClick={() => void handleToggleShopOpen(s.id)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {s.isOpen ? 'Close Temporarily' : 'Reopen Shop'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditShopForm(s.id)}
                    className="rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Edit Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Products CRUD Tab */}
      {tab === 'products' && (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium text-right">Discount</th>
                <th className="px-4 py-3 font-medium text-right">Stock</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sellerData.products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-zinc-500">
                    No products listed yet.
                  </td>
                </tr>
              ) : (
                sellerData.products.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          className="h-10 w-12 rounded-md object-cover border border-zinc-200"
                        />
                        <span className="font-medium text-zinc-950">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{p.category}</td>
                    <td className="px-4 py-3 text-right font-mono-num text-xs font-semibold">
                      {currency}
                      {calculateDiscountedPrice(p.price, p.discountPercent).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-xs text-blue-600">
                      {p.discountPercent}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-xs">{p.stock}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`Edit ${p.name}`}
                          onClick={() => openEditProductForm(p)}
                          className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${p.name}`}
                          onClick={() => setConfirmDeleteProd(p)}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Orders Management Tab */}
      {tab === 'orders' && (
        <div className="mt-6 space-y-4">
          {sellerData.orders.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-10 text-center text-sm text-zinc-500">
              No customer orders received yet.
            </div>
          ) : (
            sellerData.orders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span className="font-mono-num font-bold text-zinc-950">
                        {order.orderNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{order.customerName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{order.customerPhone}</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">
                      Deliver to: {order.deliveryAddress.street}, {order.deliveryAddress.city}{' '}
                      {order.deliveryAddress.postalCode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono-num text-base font-bold text-zinc-950">
                      {currency}
                      {order.total.toFixed(2)}
                    </p>
                    <p className="text-xs font-medium capitalize text-blue-600">
                      {order.orderStatus} · Payout {currency}
                      {order.sellerPayout.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="border-t border-zinc-100 pt-3 text-xs text-zinc-700 space-y-1">
                  {order.items.map((item) => (
                    <div key={item.productId} className="flex justify-between">
                      <span>
                        {item.quantity} x {item.productName}
                      </span>
                      <span className="font-mono-num">
                        {currency}
                        {(item.finalUnitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
                  {order.orderStatus === 'pending' && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleOrderTransition(order.id, 'confirmed')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        <Check className="h-3.5 w-3.5" /> Accept Order
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleOrderTransition(order.id, 'rejected')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        <X className="h-3.5 w-3.5" /> Reject Order
                      </button>
                    </>
                  )}
                  {order.orderStatus === 'confirmed' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setShippingOrderId(order.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white"
                    >
                      <Truck className="h-3.5 w-3.5" /> Dispatch & Mark Shipped
                    </button>
                  )}
                  {order.orderStatus === 'shipped' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleOrderTransition(order.id, 'delivered')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white"
                    >
                      <Check className="h-3.5 w-3.5" /> Confirm Delivered
                    </button>
                  )}
                </div>

                {shippingOrderId === order.id && (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-zinc-900">
                      Assign Delivery Partner for {order.orderNumber}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        value={courierName}
                        onChange={(e) => setCourierName(e.target.value)}
                        placeholder="Delivery Partner Name"
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        value={courierPhone}
                        onChange={(e) => setCourierPhone(e.target.value)}
                        placeholder="Partner Phone"
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleOrderTransition(order.id, 'shipped', {
                            name: courierName,
                            phone: courierPhone,
                          })
                        }
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                      >
                        Confirm Dispatch
                      </button>
                      <button
                        type="button"
                        onClick={() => setShippingOrderId(null)}
                        className="rounded-lg border border-zinc-300 px-4 py-2 text-xs text-zinc-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Seller Notifications */}
      {tab === 'notifications' && (
        <div className="mt-6 space-y-3">
          {sellerData.notifications.map((n) => (
            <div key={n.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-sm font-semibold text-zinc-950">{n.title}</p>
              <p className="mt-1 text-xs text-zinc-600">{n.message}</p>
              <p className="mt-1 font-mono-num text-xs text-zinc-400">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Shop Form Modal */}
      {shopFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveShop}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-zinc-950">
                {editingShopId ? 'Edit Shop Details' : 'Create New Shop'}
              </h2>
              <button type="button" onClick={() => setShopFormOpen(false)} aria-label="Close modal">
                <X className="h-5 w-5 text-zinc-500" />
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="Shop Name"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                maxLength={3}
                placeholder="Logo Initials (e.g. KA)"
                value={shopLogoText}
                onChange={(e) => setShopLogoText(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <select
                value={shopCat}
                onChange={(e) => setShopCat(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              rows={3}
              required
              placeholder="Shop Description"
              value={shopDesc}
              onChange={(e) => setShopDesc(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              required
              placeholder="Street Address"
              value={shopAddr}
              onChange={(e) => setShopAddr(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="City"
                value={shopCity}
                onChange={(e) => setShopCity(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                type="tel"
                required
                placeholder="Phone"
                value={shopPhone}
                onChange={(e) => setShopPhone(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="shop-banner-sel" className="block text-xs font-medium text-zinc-700 mb-1">
                Shop Banner Image
              </label>
              <select
                id="shop-banner-sel"
                value={shopBanner}
                onChange={(e) => setShopBanner(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                {IMAGE_PRESETS.map((img) => (
                  <option key={img.url} value={img.url}>
                    {img.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShopFormOpen(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-zinc-950 px-5 py-2 text-xs font-semibold text-white"
              >
                {busy ? 'Saving...' : 'Save Shop'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Product Form Modal */}
      {prodFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveProduct}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-zinc-950">
                {editingProdId ? 'Edit Product' : 'Add Product'}
              </h2>
              <button type="button" onClick={() => setProdFormOpen(false)} aria-label="Close modal">
                <X className="h-5 w-5 text-zinc-500" />
              </button>
            </div>
            <select
              value={prodShopId}
              onChange={(e) => setProdShopId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              {sellerData.shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              placeholder="Product Name"
              value={prodName}
              onChange={(e) => setProdName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <select
              value={prodCat}
              onChange={(e) => setProdCat(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <textarea
              rows={3}
              required
              placeholder="Product Description"
              value={prodDesc}
              onChange={(e) => setProdDesc(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="p-price" className="block text-xs text-zinc-600 mb-1">
                  Price ({currency})
                </label>
                <input
                  id="p-price"
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono-num"
                />
              </div>
              <div>
                <label htmlFor="p-disc" className="block text-xs text-zinc-600 mb-1">
                  Discount (%)
                </label>
                <input
                  id="p-disc"
                  type="number"
                  min={0}
                  max={effectiveSettings.productSettings.maxDiscountPercent}
                  value={prodDiscount}
                  onChange={(e) => setProdDiscount(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono-num"
                />
              </div>
              <div>
                <label htmlFor="p-stock" className="block text-xs text-zinc-600 mb-1">
                  Stock Qty
                </label>
                <input
                  id="p-stock"
                  type="number"
                  min={0}
                  required
                  value={prodStock}
                  onChange={(e) => setProdStock(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono-num"
                />
              </div>
            </div>
            <div>
              <label htmlFor="p-img" className="block text-xs text-zinc-600 mb-1">
                Product Image
              </label>
              <select
                id="p-img"
                value={prodImg}
                onChange={(e) => setProdImg(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                {IMAGE_PRESETS.map((img) => (
                  <option key={img.url} value={img.url}>
                    {img.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProdFormOpen(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-zinc-950 px-5 py-2 text-xs font-semibold text-white"
              >
                {busy ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteProd)}
        title="Delete Product"
        description={`Are you sure you want to permanently delete "${confirmDeleteProd?.name}" from your catalog?`}
        confirmLabel="Delete Product"
        busy={busy}
        onConfirm={() => void handleDeleteProduct()}
        onCancel={() => setConfirmDeleteProd(null)}
      />
    </div>
  );
}
