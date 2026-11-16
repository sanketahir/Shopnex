import React, { useMemo, useState } from 'react';
import { CreditCard, Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Truck, X } from 'lucide-react';
import { useTechora } from '../context/TechoraContext';
import type { Address, PaymentMethod } from '../types/techora';
import { calculateDiscountedPrice, calculateOrderTotals } from '../utils/commerce';

export function CartCheckoutDrawer() {
  const {
    cart,
    cartOpen,
    setCartOpen,
    products,
    shops,
    effectiveSettings,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    currentUser,
    customerData,
    setAuthModalOpen,
    apiFetch,
    refreshAll,
    setActiveView,
    showToast,
  } = useTechora();

  const [step, setStep] = useState<'cart' | 'checkout'>('cart');
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [useNewAddress, setUseNewAddress] = useState(false);

  const [addrLabel, setAddrLabel] = useState('Home');
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const [busy, setBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const resolvedItems = useMemo(() => {
    return cart
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product) return null;
        const shop = shops.find((s) => s.id === product.shopId);
        return {
          ...item,
          product,
          shop,
          finalUnit: calculateDiscountedPrice(product.price, product.discountPercent),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [cart, products, shops]);

  const totals = useMemo(() => {
    return calculateOrderTotals(
      resolvedItems.map((i) => ({
        price: i.product.price,
        discountPercent: i.product.discountPercent,
        quantity: i.quantity,
      })),
      effectiveSettings.deliverySettings,
      effectiveSettings.paymentSettings.platformCommissionPercent,
    );
  }, [resolvedItems, effectiveSettings]);

  const activeAddress: Address | null = useMemo(() => {
    if (useNewAddress || customerData.addresses.length === 0) {
      return {
        id: 'new',
        label: addrLabel || 'Delivery',
        recipientName: recipientName || currentUser?.name || '',
        phone: phone || currentUser?.phone || '',
        street,
        city,
        postalCode,
        isDefault: false,
      };
    }
    return (
      customerData.addresses.find((a) => a.id === selectedAddressId) ||
      customerData.addresses.find((a) => a.isDefault) ||
      customerData.addresses[0]
    );
  }, [
    useNewAddress,
    customerData.addresses,
    selectedAddressId,
    addrLabel,
    recipientName,
    phone,
    street,
    city,
    postalCode,
    currentUser,
  ]);

  if (!cartOpen) return null;

  const currency = effectiveSettings.paymentSettings.currencySymbol;

  const handleProceedToCheckout = () => {
    if (!currentUser) {
      setAuthModalOpen(true);
      showToast('Please sign in to place your order');
      return;
    }
    setCheckoutError(null);
    setStep('checkout');
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!activeAddress) return;

    setBusy(true);
    setCheckoutError(null);

    try {
      let cardTokenRef: string | undefined;
      let cardLast4: string | undefined;
      let cardBrand: string | undefined;

      // Never store raw card numbers; tokenize via payment gateway endpoint first
      if (paymentMethod === 'online_card') {
        const tok = await apiFetch<{
          gatewayRef: string;
          cardLast4: string;
          cardBrand: string;
        }>('/api/payments/tokenize', {
          method: 'POST',
          body: JSON.stringify({
            cardHolder,
            cardNumber,
            expiry,
            cvv,
          }),
        });
        cardTokenRef = tok.gatewayRef;
        cardLast4 = tok.cardLast4;
        cardBrand = tok.cardBrand;
      }

      if (useNewAddress || customerData.addresses.length === 0) {
        await apiFetch('/api/customer/addresses', {
          method: 'POST',
          body: JSON.stringify(activeAddress),
        });
      }

      const res = await apiFetch<{ orders: Array<{ orderNumber: string }> }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: resolvedItems.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
          })),
          deliveryAddress: activeAddress,
          paymentMethod,
          cardTokenRef,
          cardLast4,
          cardBrand,
        }),
      });

      clearCart();
      setCardNumber('');
      setCvv('');
      setStep('cart');
      setCartOpen(false);
      await refreshAll();
      setActiveView('orders');
      showToast(
        `Order ${res.orders.map((o) => o.orderNumber).join(', ')} placed successfully`,
      );
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Unable to complete order.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-xs">
      <div
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart and checkout"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-zinc-900" />
            <h2 className="font-display text-lg font-bold text-zinc-950">
              {step === 'cart' ? 'Shopping Cart' : 'Secure Checkout'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close cart drawer"
            onClick={() => {
              setCartOpen(false);
              setStep('cart');
            }}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {resolvedItems.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <ShoppingBag className="h-10 w-10 text-zinc-300" />
            <p className="mt-3 text-base font-semibold text-zinc-900">Your cart is empty</p>
            <p className="mt-1 text-sm text-zinc-500">
              Add items from verified local shops to start checkout.
            </p>
            <button
              type="button"
              onClick={() => setCartOpen(false)}
              className="mt-5 rounded-lg bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white"
            >
              Browse Marketplace
            </button>
          </div>
        ) : step === 'cart' ? (
          <>
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 px-6">
              {resolvedItems.map((item) => (
                <div key={item.productId} className="flex gap-4 py-4">
                  <img
                    src={item.product.images[0]}
                    alt={item.product.name}
                    referrerPolicy="no-referrer"
                    className="h-20 w-24 rounded-lg border border-zinc-200 object-cover shrink-0"
                  />
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-zinc-500">{item.shop?.name}</p>
                        <h3 className="text-sm font-semibold text-zinc-950">
                          {item.product.name}
                        </h3>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${item.product.name}`}
                        onClick={() => removeFromCart(item.productId)}
                        className="p-1 text-zinc-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-auto pt-3 flex items-center justify-between">
                      <div className="flex items-center rounded-md border border-zinc-200">
                        <button
                          type="button"
                          aria-label={`Decrease quantity for ${item.product.name}`}
                          onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                          className="p-1.5 text-zinc-600 hover:bg-zinc-100"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="px-2.5 font-mono-num text-xs font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity for ${item.product.name}`}
                          onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                          className="p-1.5 text-zinc-600 hover:bg-zinc-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="font-mono-num text-sm font-bold text-zinc-950">
                        {currency}
                        {(item.finalUnit * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50 p-6 space-y-3">
              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <Truck className="h-4 w-4 text-blue-600" />
                {totals.deliveryCharge === 0 ? (
                  <span>Qualifies for complimentary local courier delivery</span>
                ) : (
                  <span>
                    Add {currency}
                    {(
                      effectiveSettings.deliverySettings.freeDeliveryThreshold - totals.subtotal
                    ).toFixed(2)}{' '}
                    more for free delivery
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span className="font-mono-num">
                    {currency}
                    {totals.subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Delivery Charge</span>
                  <span className="font-mono-num">
                    {totals.deliveryCharge === 0
                      ? 'Free'
                      : `${currency}${totals.deliveryCharge.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-bold text-zinc-950">
                  <span>Total</span>
                  <span className="font-mono-num">
                    {currency}
                    {totals.total.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleProceedToCheckout}
                className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: effectiveSettings.primaryColor }}
              >
                Proceed to Checkout
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handlePlaceOrder} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {checkoutError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                  {checkoutError}
                </div>
              )}

              {/* Delivery Address */}
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-950">1. Delivery Address</h3>
                  {customerData.addresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setUseNewAddress((v) => !v)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      {useNewAddress ? 'Use Saved Address' : '+ New Address'}
                    </button>
                  )}
                </div>

                {!useNewAddress && customerData.addresses.length > 0 ? (
                  <div className="mt-2.5 space-y-2">
                    {customerData.addresses.map((addr) => {
                      const isSelected = activeAddress?.id === addr.id;
                      return (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => setSelectedAddressId(addr.id)}
                          className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/50'
                              : 'border-zinc-200 hover:bg-zinc-50'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-zinc-950">
                            <span>{addr.label}</span>
                            <span>{addr.phone}</span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-600">
                            {addr.recipientName} · {addr.street}, {addr.city} {addr.postalCode}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Label (Home / Office)"
                      value={addrLabel}
                      onChange={(e) => setAddrLabel(e.target.value)}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Recipient Full Name"
                      value={recipientName || currentUser?.name || ''}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="Phone Number"
                      value={phone || currentUser?.phone || ''}
                      onChange={(e) => setPhone(e.target.value)}
                      className="col-span-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Street Address & Apt"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      className="col-span-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      required
                      placeholder="City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Postal Code"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-950">2. Payment Method</h3>
                <div className="mt-2.5 space-y-2">
                  {effectiveSettings.paymentSettings.codEnabled && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cod')}
                      className={`w-full flex items-center justify-between rounded-xl border p-3.5 text-left ${
                        paymentMethod === 'cod'
                          ? 'border-blue-600 bg-blue-50/50'
                          : 'border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-zinc-950">Cash on Delivery</p>
                        <p className="text-xs text-zinc-500">
                          Pay courier upon package verification
                        </p>
                      </div>
                      <span className="text-xs font-medium text-zinc-700">COD</span>
                    </button>
                  )}

                  {effectiveSettings.paymentSettings.onlinePaymentEnabled && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('online_card')}
                      className={`w-full flex items-center justify-between rounded-xl border p-3.5 text-left ${
                        paymentMethod === 'online_card'
                          ? 'border-blue-600 bg-blue-50/50'
                          : 'border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-zinc-950">
                          Online Card Payment ({effectiveSettings.paymentSettings.gatewayProvider})
                        </p>
                        <p className="text-xs text-zinc-500">
                          Tokenized processing — raw card numbers are never stored
                        </p>
                      </div>
                      <CreditCard className="h-4 w-4 text-zinc-700" />
                    </button>
                  )}

                  {effectiveSettings.paymentSettings.upiEnabled && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('upi_instant')}
                      className={`w-full flex items-center justify-between rounded-xl border p-3.5 text-left ${
                        paymentMethod === 'upi_instant'
                          ? 'border-blue-600 bg-blue-50/50'
                          : 'border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-zinc-950">Instant Bank / UPI</p>
                        <p className="text-xs text-zinc-500">Direct instant settlement</p>
                      </div>
                      <ShieldCheck className="h-4 w-4 text-zinc-700" />
                    </button>
                  )}
                </div>

                {paymentMethod === 'online_card' && (
                  <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                    <p className="text-xs text-zinc-600">
                      Test tip: cards ending in <span className="font-mono-num">0000</span> or CVV{' '}
                      <span className="font-mono-num">000</span> simulate a bank decline.
                    </p>
                    <input
                      type="text"
                      required
                      placeholder="Cardholder Name"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Card Number (16 digits)"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      maxLength={19}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-mono-num"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="MM/YY"
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                        maxLength={5}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-mono-num"
                      />
                      <input
                        type="password"
                        required
                        placeholder="CVV"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value)}
                        maxLength={4}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-mono-num"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50 p-6 space-y-3">
              <div className="flex justify-between text-base font-bold text-zinc-950">
                <span>Order Total</span>
                <span className="font-mono-num">
                  {currency}
                  {totals.total.toFixed(2)}
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-white"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: effectiveSettings.primaryColor }}
                >
                  {busy ? 'Authorizing...' : `Place Order (${currency}${totals.total.toFixed(2)})`}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
