import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDiscountedPrice,
  calculateOrderTotals,
  computeAnalyticsSummary,
  containsRawCardNumber,
  sanitizeAppSettings,
  validateCheckoutPayload,
  validateOrderTransition,
} from './commerce';
import { INITIAL_SEED } from '../data/seed';

test('calculateDiscountedPrice applies bounded percentage cleanly', () => {
  assert.equal(calculateDiscountedPrice(200, 15), 170);
  assert.equal(calculateDiscountedPrice(99.99, 0), 99.99);
  assert.equal(calculateDiscountedPrice(100, 95), 10); // capped at 90%
});

test('calculateOrderTotals computes free delivery threshold and platform commission', () => {
  const resultWithDelivery = calculateOrderTotals(
    [{ price: 100, discountPercent: 10, quantity: 1 }],
    { baseDeliveryCharge: 12, freeDeliveryThreshold: 150 },
    10,
  );
  assert.equal(resultWithDelivery.subtotal, 90);
  assert.equal(resultWithDelivery.discountSavings, 10);
  assert.equal(resultWithDelivery.deliveryCharge, 12);
  assert.equal(resultWithDelivery.platformCommission, 9);
  assert.equal(resultWithDelivery.sellerPayout, 81);
  assert.equal(resultWithDelivery.total, 102);

  const resultFreeDelivery = calculateOrderTotals(
    [{ price: 200, discountPercent: 0, quantity: 1 }],
    { baseDeliveryCharge: 12, freeDeliveryThreshold: 150 },
    10,
  );
  assert.equal(resultFreeDelivery.deliveryCharge, 0);
  assert.equal(resultFreeDelivery.total, 200);
});

test('validateOrderTransition enforces valid state machine and role permissions', () => {
  assert.equal(validateOrderTransition('pending', 'confirmed', 'seller').valid, true);
  assert.equal(validateOrderTransition('pending', 'delivered', 'seller').valid, false);
  assert.equal(validateOrderTransition('delivered', 'cancelled', 'super_admin').valid, false);
  assert.equal(validateOrderTransition('pending', 'cancelled', 'customer').valid, true);
  assert.equal(validateOrderTransition('shipped', 'cancelled', 'customer').valid, false);
});

test('validateCheckoutPayload rejects empty cart and raw card numbers', () => {
  const bad = validateCheckoutPayload({
    items: [],
    recipientName: 'A',
    phone: '123',
    street: 'x',
    city: '',
    postalCode: '',
    paymentMethod: 'online_card',
    cardTokenRef: '4111111111111111',
    cardLast4: '1111',
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.length >= 4);
  assert.equal(containsRawCardNumber('4111-1111-1111-1111'), true);

  const good = validateCheckoutPayload({
    items: [{ productId: 'prod-1', quantity: 2 }],
    recipientName: 'Maya Lin',
    phone: '+1 415 555 0199',
    street: '742 Evergreen Terrace',
    city: 'San Francisco',
    postalCode: '94107',
    paymentMethod: 'online_card',
    cardTokenRef: 'tok_visa_9821a',
    cardLast4: '4242',
  });
  assert.equal(good.valid, true);
});

test('computeAnalyticsSummary aggregates revenue excluding cancelled orders', () => {
  const summary = computeAnalyticsSummary(
    INITIAL_SEED.orders,
    INITIAL_SEED.shops,
    INITIAL_SEED.products,
    INITIAL_SEED.users,
  );
  assert.equal(summary.totalShops, INITIAL_SEED.shops.length);
  assert.equal(summary.totalProducts, INITIAL_SEED.products.length);
  assert.ok(summary.totalRevenue > 0);
  assert.ok(summary.shopPerformance.length > 0);
});

test('sanitizeAppSettings clamps bounds and preserves valid hex colors', () => {
  const next = sanitizeAppSettings(
    {
      appDisplayName: '  TECHORA STUDIO  ',
      primaryColor: 'not-a-hex',
      paymentSettings: {
        ...INITIAL_SEED.appSettings.paymentSettings,
        platformCommissionPercent: 85,
      },
    },
    INITIAL_SEED.appSettings,
  );
  assert.equal(next.appDisplayName, 'TECHORA STUDIO');
  assert.equal(next.primaryColor, INITIAL_SEED.appSettings.primaryColor);
  assert.equal(next.paymentSettings.platformCommissionPercent, 40);
});
