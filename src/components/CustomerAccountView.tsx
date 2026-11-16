import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Heart,
  HelpCircle,
  LogOut,
  MapPin,
  Package,
  Trash2,
  Truck,
  User as UserIcon,
} from 'lucide-react';
import { useTechora } from '../context/TechoraContext';
import { ConfirmDialog } from './ConfirmDialog';
import { calculateDiscountedPrice } from '../utils/commerce';

type AccountTab = 'orders' | 'wishlist' | 'addresses' | 'notifications' | 'profile' | 'support';

export function CustomerAccountView({ initialTab = 'orders' }: { initialTab?: AccountTab }) {
  const {
    currentUser,
    setAuthModalOpen,
    customerData,
    products,
    effectiveSettings,
    apiFetch,
    refreshAll,
    addToCart,
    toggleWishlist,
    logout,
    showToast,
    setActiveView,
  } = useTechora();

  const [tab, setTab] = useState<AccountTab>(initialTab);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [confirmDeleteAddrId, setConfirmDeleteAddrId] = useState<string | null>(null);
  const [confirmCancelOrderId, setConfirmCancelOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Address form
  const [label, setLabel] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Profile form
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profilePhone, setProfilePhone] = useState(currentUser?.phone || '');

  // Support form
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');

  const currency = effectiveSettings.paymentSettings.currencySymbol;

  if (!currentUser && tab !== 'support') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <UserIcon className="mx-auto h-10 w-10 text-zinc-400" />
        <h2 className="mt-4 font-display text-2xl font-bold text-zinc-950">
          Sign in to access your {effectiveSettings.appDisplayName} account
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Track active deliveries, manage saved addresses, view order receipts, and manage your wishlist.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: effectiveSettings.primaryColor }}
          >
            Sign In / Register
          </button>
          <button
            type="button"
            onClick={() => setTab('support')}
            className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700"
          >
            Help & Support
          </button>
        </div>
      </div>
    );
  }

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await apiFetch('/api/customer/addresses', {
        method: 'POST',
        body: JSON.stringify({ label, recipientName, phone, street, city, postalCode }),
      });
      setLabel('');
      setRecipientName('');
      setPhone('');
      setStreet('');
      setCity('');
      setPostalCode('');
      await refreshAll();
      showToast('Address saved');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save address.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAddress = async () => {
    if (!confirmDeleteAddrId) return;
    setBusy(true);
    try {
      await apiFetch(`/api/customer/addresses/${confirmDeleteAddrId}`, { method: 'DELETE' });
      setConfirmDeleteAddrId(null);
      await refreshAll();
      showToast('Address deleted');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to delete address.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!confirmCancelOrderId) return;
    setBusy(true);
    try {
      await apiFetch(`/api/orders/${confirmCancelOrderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled', note: 'Cancelled by customer.' }),
      });
      setConfirmCancelOrderId(null);
      await refreshAll();
      showToast('Order cancelled');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to cancel order.');
    } finally {
      setBusy(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: profileName, phone: profilePhone }),
      });
      await refreshAll();
      showToast('Profile updated');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setBusy(false);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await apiFetch('/api/support', {
        method: 'POST',
        body: JSON.stringify({ subject: ticketSubject, message: ticketMessage }),
      });
      setTicketSubject('');
      setTicketMessage('');
      await refreshAll();
      showToast('Support ticket submitted');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to submit ticket.');
    } finally {
      setBusy(false);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
    await refreshAll();
  };

  const tabs: Array<{ id: AccountTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'orders', label: `Orders (${customerData.orders.length})`, icon: Package },
    { id: 'wishlist', label: `Wishlist (${customerData.wishlist.length})`, icon: Heart },
    { id: 'addresses', label: 'Addresses', icon: MapPin },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'support', label: 'Help & Support', icon: HelpCircle },
  ];

  const wishlistProducts = products.filter((p) => customerData.wishlist.includes(p.id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-950">
            {currentUser ? `${currentUser.name}'s Account` : 'Help & Support Center'}
          </h1>
          {currentUser && (
            <p className="mt-1 text-xs text-zinc-500">
              {currentUser.email} · Role: {currentUser.role.replace('_', ' ')}
            </p>
          )}
        </div>
        {currentUser && (
          <div className="flex items-center gap-2.5">
            {currentUser.role === 'seller' && (
              <button
                type="button"
                onClick={() => setActiveView('seller')}
                className="rounded-lg border border-zinc-300 px-3.5 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Open Seller Dashboard
              </button>
            )}
            {(currentUser.role === 'admin' || currentUser.role === 'super_admin') && (
              <button
                type="button"
                onClick={() => setActiveView('admin')}
                className="rounded-lg border border-zinc-300 px-3.5 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Open Admin Console
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="mt-5 flex items-center gap-1.5 overflow-x-auto pb-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setFormError(null);
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                active ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {formError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      {/* Orders & Tracking Tab */}
      {tab === 'orders' && (
        <div className="mt-6 space-y-4">
          {customerData.orders.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-10 text-center">
              <Package className="mx-auto h-8 w-8 text-zinc-400" />
              <p className="mt-3 text-sm font-semibold text-zinc-900">No orders placed yet</p>
              <button
                type="button"
                onClick={() => setActiveView('home')}
                className="mt-4 rounded-lg bg-zinc-950 px-4 py-2 text-xs font-medium text-white"
              >
                Explore Products
              </button>
            </div>
          ) : (
            customerData.orders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const canCancel =
                order.orderStatus === 'pending' || order.orderStatus === 'confirmed';
              const steps: Array<'pending' | 'confirmed' | 'shipped' | 'delivered'> = [
                'pending',
                'confirmed',
                'shipped',
                'delivered',
              ];
              const stepIdx = steps.indexOf(order.orderStatus as typeof steps[number]);

              return (
                <div
                  key={order.id}
                  className="rounded-xl border border-zinc-200 bg-white overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4">
                    <div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span className="font-mono-num font-semibold text-zinc-950">
                          {order.orderNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{order.shopName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-zinc-900">
                        Status:{' '}
                        <span className="capitalize font-semibold text-blue-600">
                          {order.orderStatus}
                        </span>{' '}
                        · Payment: <span className="capitalize">{order.paymentStatus}</span> (
                        {order.paymentMethod.toUpperCase()})
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono-num text-base font-bold text-zinc-950">
                        {currency}
                        {order.total.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedOrderId(isExpanded ? null : order.id)
                        }
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        {isExpanded ? 'Hide Tracking' : 'Track Order'}
                      </button>
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => setConfirmCancelOrderId(order.id)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Item summary */}
                  <div className="px-5 py-3 space-y-2">
                    {order.items.map((item) => (
                      <div
                        key={item.productId}
                        className="flex items-center justify-between text-xs text-zinc-700"
                      >
                        <span>
                          {item.quantity} x {item.productName}
                        </span>
                        <span className="font-mono-num font-medium">
                          {currency}
                          {(item.finalUnitPrice * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Expanded Order Tracking & Delivery Partner Details */}
                  {isExpanded && (
                    <div className="border-t border-zinc-200 bg-zinc-50 p-5 space-y-5">
                      {stepIdx >= 0 && (
                        <div>
                          <p className="text-xs font-semibold text-zinc-900 mb-3">
                            Delivery Progress
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            {steps.map((s, idx) => (
                              <div key={s} className="space-y-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    idx <= stepIdx ? 'bg-blue-600' : 'bg-zinc-200'
                                  }`}
                                />
                                <p
                                  className={`text-xs capitalize ${
                                    idx <= stepIdx
                                      ? 'font-semibold text-zinc-950'
                                      : 'text-zinc-400'
                                  }`}
                                >
                                  {s}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-lg border border-zinc-200 bg-white p-3.5 text-xs space-y-1">
                          <p className="font-semibold text-zinc-950">Delivery Address</p>
                          <p className="text-zinc-700">{order.deliveryAddress.recipientName}</p>
                          <p className="text-zinc-600">
                            {order.deliveryAddress.street}, {order.deliveryAddress.city}{' '}
                            {order.deliveryAddress.postalCode}
                          </p>
                          <p className="text-zinc-500">{order.deliveryAddress.phone}</p>
                        </div>

                        <div className="rounded-lg border border-zinc-200 bg-white p-3.5 text-xs space-y-1">
                          <p className="font-semibold text-zinc-950 flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5 text-blue-600" />
                            Delivery Partner
                          </p>
                          {order.deliveryPartner ? (
                            <>
                              <p className="text-zinc-700">{order.deliveryPartner.name}</p>
                              <p className="font-mono-num text-zinc-600">
                                Tracking: {order.deliveryPartner.trackingCode}
                              </p>
                              <p className="text-zinc-500">
                                ETA: {order.deliveryPartner.estimatedEta} ·{' '}
                                {order.deliveryPartner.phone}
                              </p>
                            </>
                          ) : (
                            <p className="text-zinc-500">
                              Courier will be assigned once {order.shopName} dispatches your package.
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-zinc-900 mb-2">Activity Log</p>
                        <div className="space-y-2">
                          {order.timeline.map((ev, i) => (
                            <div
                              key={`${ev.timestamp}-${i}`}
                              className="flex items-start justify-between gap-4 text-xs text-zinc-600"
                            >
                              <span>
                                <strong className="capitalize text-zinc-900">{ev.status}</strong> —{' '}
                                {ev.note}
                              </span>
                              <span className="font-mono-num text-zinc-400 shrink-0">
                                {new Date(ev.timestamp).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Wishlist Tab */}
      {tab === 'wishlist' && (
        <div className="mt-6">
          {wishlistProducts.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-10 text-center">
              <Heart className="mx-auto h-8 w-8 text-zinc-400" />
              <p className="mt-3 text-sm font-semibold text-zinc-900">Your wishlist is empty</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {wishlistProducts.map((p) => {
                const price = calculateDiscountedPrice(p.price, p.discountPercent);
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-zinc-200 bg-white overflow-hidden flex flex-col"
                  >
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <div className="p-4 flex flex-1 flex-col">
                      <h3 className="text-sm font-semibold text-zinc-950">{p.name}</h3>
                      <p className="mt-1 font-mono-num text-sm font-bold text-zinc-900">
                        {currency}
                        {price.toFixed(2)}
                      </p>
                      <div className="mt-auto pt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => addToCart(p.id, 1)}
                          className="flex-1 rounded-lg bg-zinc-950 py-2 text-xs font-medium text-white"
                        >
                          Add to Cart
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleWishlist(p.id)}
                          className="rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Addresses Tab */}
      {tab === 'addresses' && (
        <div className="mt-6 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-3">
            <h2 className="text-base font-semibold text-zinc-950">Saved Delivery Addresses</h2>
            {customerData.addresses.length === 0 ? (
              <p className="text-sm text-zinc-500">No saved addresses yet.</p>
            ) : (
              customerData.addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="flex items-start justify-between rounded-xl border border-zinc-200 bg-white p-4"
                >
                  <div className="text-sm">
                    <p className="font-semibold text-zinc-950">
                      {addr.label} · {addr.recipientName}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">
                      {addr.street}, {addr.city} {addr.postalCode}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">{addr.phone}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete address ${addr.label}`}
                    onClick={() => setConfirmDeleteAddrId(addr.id)}
                    className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={handleAddAddress}
            className="lg:col-span-5 rounded-xl border border-zinc-200 bg-zinc-50 p-5 space-y-3"
          >
            <h3 className="text-sm font-semibold text-zinc-950">Add New Address</h3>
            <input
              type="text"
              required
              placeholder="Label (e.g. Home)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="text"
              required
              placeholder="Recipient Name"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="tel"
              required
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="text"
              required
              placeholder="Street & Apartment"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Postal Code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-zinc-950 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              {busy ? 'Saving...' : 'Save Address'}
            </button>
          </form>
        </div>
      )}

      {/* Notifications Tab */}
      {tab === 'notifications' && (
        <div className="mt-6 space-y-3">
          {customerData.notifications.length === 0 ? (
            <p className="text-sm text-zinc-500">No notifications yet.</p>
          ) : (
            customerData.notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${
                  n.isRead ? 'border-zinc-200 bg-white' : 'border-blue-200 bg-blue-50/40'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-950">{n.title}</p>
                  <p className="mt-1 text-xs text-zinc-600">{n.message}</p>
                  <p className="mt-1.5 font-mono-num text-xs text-zinc-400">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={() => void handleMarkNotificationRead(n.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" /> Mark Read
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Profile Tab */}
      {tab === 'profile' && currentUser && (
        <form
          onSubmit={handleProfileSave}
          className="mt-6 max-w-lg rounded-xl border border-zinc-200 bg-white p-6 space-y-4"
        >
          <h2 className="text-base font-semibold text-zinc-950">Account Profile</h2>
          <div>
            <label htmlFor="prof-name" className="block text-xs font-medium text-zinc-700">
              Full Name
            </label>
            <input
              id="prof-name"
              type="text"
              required
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="prof-email" className="block text-xs font-medium text-zinc-700">
              Email Address
            </label>
            <input
              id="prof-email"
              type="email"
              disabled
              value={currentUser.email}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
            />
          </div>
          <div>
            <label htmlFor="prof-phone" className="block text-xs font-medium text-zinc-700">
              Phone Number
            </label>
            <input
              id="prof-phone"
              type="tel"
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg px-5 py-2.5 text-xs font-semibold text-white"
            style={{ backgroundColor: effectiveSettings.primaryColor }}
          >
            {busy ? 'Saving...' : 'Update Profile'}
          </button>
        </form>
      )}

      {/* Help & Support Tab */}
      {tab === 'support' && (
        <div className="mt-6 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-3">
              <h2 className="font-display text-lg font-bold text-zinc-950">
                Contact {effectiveSettings.appDisplayName} Support
              </h2>
              <p className="text-sm text-zinc-600">{effectiveSettings.contactAddress}</p>
              <div className="text-xs text-zinc-700 space-y-1">
                <p>Support Email: {effectiveSettings.supportEmail}</p>
                <p>WhatsApp Concierge: {effectiveSettings.whatsappNumber}</p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-2">
              <h3 className="text-sm font-semibold text-zinc-950">Terms & Conditions</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {effectiveSettings.termsAndConditions}
              </p>
              <h3 className="pt-3 text-sm font-semibold text-zinc-950">Privacy Policy</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {effectiveSettings.privacyPolicy}
              </p>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-5">
            <form
              onSubmit={handleSupportSubmit}
              className="rounded-xl border border-zinc-200 bg-white p-6 space-y-3"
            >
              <h3 className="text-base font-semibold text-zinc-950">Submit Support Request</h3>
              <input
                type="text"
                required
                placeholder="Subject (e.g. Delivery inquiry or invoice request)"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <textarea
                rows={4}
                required
                placeholder="Describe your question or order number..."
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-zinc-950 px-5 py-2.5 text-xs font-semibold text-white"
              >
                {busy ? 'Sending...' : 'Submit Ticket'}
              </button>
            </form>

            {customerData.tickets.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-zinc-700">Your Support Tickets</h4>
                {customerData.tickets.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-zinc-950">
                      <span>{t.subject}</span>
                      <span className="capitalize text-blue-600">{t.status}</span>
                    </div>
                    <p className="mt-1 text-zinc-600">{t.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteAddrId)}
        title="Delete Saved Address"
        description="Are you sure you want to remove this delivery address from your account?"
        confirmLabel="Delete Address"
        busy={busy}
        onConfirm={() => void handleDeleteAddress()}
        onCancel={() => setConfirmDeleteAddrId(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmCancelOrderId)}
        title="Cancel Order"
        description="Cancelling this order will restore product stock and initiate a refund if already paid."
        confirmLabel="Cancel Order"
        busy={busy}
        onConfirm={() => void handleCancelOrder()}
        onCancel={() => setConfirmCancelOrderId(null)}
      />
    </div>
  );
}
