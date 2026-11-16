import type {
  AppSettings,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  Shop,
  User,
  UserRole,
} from '../types/techora';

export function calculateDiscountedPrice(price: number, discountPercent: number): number {
  const safePrice = Math.max(0, Number(price) || 0);
  const safeDiscount = Math.min(90, Math.max(0, Number(discountPercent) || 0));
  return Number((safePrice * (1 - safeDiscount / 100)).toFixed(2));
}

export interface OrderTotalCalculation {
  subtotal: number;
  discountSavings: number;
  deliveryCharge: number;
  platformCommission: number;
  sellerPayout: number;
  total: number;
}

export function calculateOrderTotals(
  items: Array<{ price: number; discountPercent: number; quantity: number }>,
  deliveryConfig: { baseDeliveryCharge: number; freeDeliveryThreshold: number },
  commissionPercent: number,
): OrderTotalCalculation {
  let rawSubtotal = 0;
  let discountedSubtotal = 0;

  for (const item of items) {
    const qty = Math.max(1, Math.floor(item.quantity));
    const unitRaw = Math.max(0, item.price);
    const unitFinal = calculateDiscountedPrice(unitRaw, item.discountPercent);
    rawSubtotal += unitRaw * qty;
    discountedSubtotal += unitFinal * qty;
  }

  const subtotal = Number(discountedSubtotal.toFixed(2));
  const discountSavings = Number(Math.max(0, rawSubtotal - discountedSubtotal).toFixed(2));
  const deliveryCharge =
    subtotal >= deliveryConfig.freeDeliveryThreshold || subtotal === 0
      ? 0
      : Number(Math.max(0, deliveryConfig.baseDeliveryCharge).toFixed(2));

  const safeCommissionRate = Math.min(50, Math.max(0, commissionPercent));
  const platformCommission = Number(((subtotal * safeCommissionRate) / 100).toFixed(2));
  const sellerPayout = Number(Math.max(0, subtotal - platformCommission).toFixed(2));
  const total = Number((subtotal + deliveryCharge).toFixed(2));

  return {
    subtotal,
    discountSavings,
    deliveryCharge,
    platformCommission,
    sellerPayout,
    total,
  };
}

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  rejected: [],
};

export function validateOrderTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
  actorRole: UserRole,
): { valid: boolean; reason?: string } {
  if (currentStatus === nextStatus) {
    return { valid: false, reason: 'Order is already in this status.' };
  }

  const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(nextStatus)) {
    return {
      valid: false,
      reason: `Cannot transition order from ${currentStatus} to ${nextStatus}.`,
    };
  }

  if (actorRole === 'customer') {
    if (nextStatus !== 'cancelled' || (currentStatus !== 'pending' && currentStatus !== 'confirmed')) {
      return { valid: false, reason: 'Customers can only cancel pending or confirmed orders.' };
    }
  }

  if (actorRole === 'seller') {
    if (nextStatus === 'cancelled') {
      return { valid: false, reason: 'Sellers should reject orders rather than cancel them.' };
    }
  }

  return { valid: true };
}

export interface CheckoutValidationInput {
  items: Array<{ productId: string; quantity: number }>;
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  postalCode: string;
  paymentMethod: PaymentMethod;
  cardTokenRef?: string;
  cardLast4?: string;
}

export function validateCheckoutPayload(input: CheckoutValidationInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!input.items || input.items.length === 0) {
    errors.push('Your shopping cart is empty.');
  } else {
    for (const item of input.items) {
      if (!item.productId || item.quantity <= 0) {
        errors.push('Every cart item must have a valid product and quantity of at least 1.');
      }
    }
  }

  if (!input.recipientName || input.recipientName.trim().length < 2) {
    errors.push('Recipient full name is required.');
  }
  if (!input.phone || input.phone.replace(/\D/g, '').length < 7) {
    errors.push('A valid delivery contact phone number is required.');
  }
  if (!input.street || input.street.trim().length < 4) {
    errors.push('Delivery street address is required.');
  }
  if (!input.city || input.city.trim().length < 2) {
    errors.push('Delivery city is required.');
  }
  if (!input.postalCode || input.postalCode.trim().length < 3) {
    errors.push('Delivery postal code is required.');
  }

  if (input.paymentMethod === 'online_card') {
    if (!input.cardTokenRef || !input.cardLast4 || !/^\d{4}$/.test(input.cardLast4)) {
      errors.push('Online card payments must be tokenized before submission.');
    }
    if (input.cardTokenRef && /\d{13,19}/.test(input.cardTokenRef)) {
      errors.push('Raw card numbers are never allowed in order payloads.');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function containsRawCardNumber(value: string): boolean {
  const digits = value.replace(/[\s-]/g, '');
  return /^\d{13,19}$/.test(digits);
}

export interface AnalyticsSummary {
  totalShops: number;
  activeShops: number;
  pendingShopApprovals: number;
  totalCustomers: number;
  totalSellers: number;
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  totalPlatformCommission: number;
  shopPerformance: Array<{
    shopId: string;
    shopName: string;
    orderCount: number;
    revenue: number;
  }>;
  productPerformance: Array<{
    productId: string;
    productName: string;
    unitsSold: number;
    revenue: number;
  }>;
  monthlyRevenue: Array<{
    month: string;
    revenue: number;
    orders: number;
  }>;
}

export function computeAnalyticsSummary(
  orders: Order[],
  shops: Shop[],
  products: Product[],
  users: User[],
): AnalyticsSummary {
  const validOrders = orders.filter(
    (o) => o.orderStatus !== 'cancelled' && o.orderStatus !== 'rejected',
  );

  const totalRevenue = Number(
    validOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2),
  );
  const totalPlatformCommission = Number(
    validOrders.reduce((sum, o) => sum + o.platformCommission, 0).toFixed(2),
  );

  const shopPerfMap = new Map<string, { shopId: string; shopName: string; orderCount: number; revenue: number }>();
  for (const s of shops) {
    shopPerfMap.set(s.id, { shopId: s.id, shopName: s.name, orderCount: 0, revenue: 0 });
  }
  for (const o of validOrders) {
    const existing = shopPerfMap.get(o.shopId) || {
      shopId: o.shopId,
      shopName: o.shopName,
      orderCount: 0,
      revenue: 0,
    };
    existing.orderCount += 1;
    existing.revenue = Number((existing.revenue + o.total).toFixed(2));
    shopPerfMap.set(o.shopId, existing);
  }

  const productPerfMap = new Map<string, { productId: string; productName: string; unitsSold: number; revenue: number }>();
  for (const o of validOrders) {
    for (const item of o.items) {
      const existing = productPerfMap.get(item.productId) || {
        productId: item.productId,
        productName: item.productName,
        unitsSold: 0,
        revenue: 0,
      };
      existing.unitsSold += item.quantity;
      existing.revenue = Number(
        (existing.revenue + item.finalUnitPrice * item.quantity).toFixed(2),
      );
      productPerfMap.set(item.productId, existing);
    }
  }

  const monthMap = new Map<string, { month: string; revenue: number; orders: number }>();
  for (const o of validOrders) {
    const d = new Date(o.createdAt);
    const key = Number.isNaN(d.getTime())
      ? '2026-11'
      : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const existing = monthMap.get(key) || { month: key, revenue: 0, orders: 0 };
    existing.revenue = Number((existing.revenue + o.total).toFixed(2));
    existing.orders += 1;
    monthMap.set(key, existing);
  }

  return {
    totalShops: shops.length,
    activeShops: shops.filter((s) => s.status === 'approved' && s.isOpen).length,
    pendingShopApprovals: shops.filter((s) => s.status === 'pending').length,
    totalCustomers: users.filter((u) => u.role === 'customer').length,
    totalSellers: users.filter((u) => u.role === 'seller').length,
    totalProducts: products.length,
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => o.orderStatus === 'pending').length,
    confirmedOrders: orders.filter((o) => o.orderStatus === 'confirmed').length,
    shippedOrders: orders.filter((o) => o.orderStatus === 'shipped').length,
    deliveredOrders: orders.filter((o) => o.orderStatus === 'delivered').length,
    cancelledOrders: orders.filter(
      (o) => o.orderStatus === 'cancelled' || o.orderStatus === 'rejected',
    ).length,
    totalRevenue,
    totalPlatformCommission,
    shopPerformance: Array.from(shopPerfMap.values()).sort((a, b) => b.revenue - a.revenue),
    productPerformance: Array.from(productPerfMap.values()).sort((a, b) => b.revenue - a.revenue),
    monthlyRevenue: Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
  };
}

export function sanitizeHexColor(hex: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex.trim()) ? hex.trim() : fallback;
}

export function sanitizeAppSettings(
  incoming: Partial<AppSettings>,
  current: AppSettings,
): AppSettings {
  const merged: AppSettings = {
    ...current,
    ...incoming,
    appDisplayName: (incoming.appDisplayName ?? current.appDisplayName).trim().slice(0, 40) || 'TECHORA',
    primaryColor: sanitizeHexColor(incoming.primaryColor ?? current.primaryColor, current.primaryColor),
    secondaryColor: sanitizeHexColor(incoming.secondaryColor ?? current.secondaryColor, current.secondaryColor),
    backgroundColor: sanitizeHexColor(incoming.backgroundColor ?? current.backgroundColor, current.backgroundColor),
    shopSettings: { ...current.shopSettings, ...(incoming.shopSettings || {}) },
    productSettings: { ...current.productSettings, ...(incoming.productSettings || {}) },
    paymentSettings: {
      ...current.paymentSettings,
      ...(incoming.paymentSettings || {}),
      platformCommissionPercent: Math.min(
        40,
        Math.max(
          0,
          Number(
            incoming.paymentSettings?.platformCommissionPercent ??
              current.paymentSettings.platformCommissionPercent,
          ),
        ),
      ),
    },
    deliverySettings: {
      ...current.deliverySettings,
      ...(incoming.deliverySettings || {}),
      baseDeliveryCharge: Math.max(
        0,
        Number(
          incoming.deliverySettings?.baseDeliveryCharge ??
            current.deliverySettings.baseDeliveryCharge,
        ),
      ),
      freeDeliveryThreshold: Math.max(
        0,
        Number(
          incoming.deliverySettings?.freeDeliveryThreshold ??
            current.deliverySettings.freeDeliveryThreshold,
        ),
      ),
    },
    notificationSettings: {
      ...current.notificationSettings,
      ...(incoming.notificationSettings || {}),
    },
    permissionSettings: {
      ...current.permissionSettings,
      ...(incoming.permissionSettings || {}),
    },
    securitySettings: {
      ...current.securitySettings,
      ...(incoming.securitySettings || {}),
    },
    databaseSettings: {
      ...current.databaseSettings,
      ...(incoming.databaseSettings || {}),
    },
  };
  return merged;
}
