import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { INITIAL_SEED, type DatabaseState } from './src/data/seed';
import type {
  Address,
  Category,
  NotificationItem,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentRecord,
  Product,
  Review,
  Shop,
  SupportTicket,
  User,
  UserRole,
} from './src/types/techora';
import {
  calculateDiscountedPrice,
  calculateOrderTotals,
  computeAnalyticsSummary,
  containsRawCardNumber,
  sanitizeAppSettings,
  validateCheckoutPayload,
  validateOrderTransition,
} from './src/utils/commerce';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'techora-db.json');
const TOKEN_SECRET = process.env.TECHORA_AUTH_SECRET || 'techora-local-platform-secret-2026';

// Ephemeral OTP store (in-memory with 10-minute expiry)
const otpStore = new Map<string, { code: string; expiresAt: number }>();

function ensureDb(): DatabaseState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seeded = structuredClone(INITIAL_SEED);
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), 'utf-8');
    return seeded;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as DatabaseState;
    if (!parsed || !Array.isArray(parsed.users) || !parsed.appSettings) {
      throw new Error('Corrupt DB structure');
    }
    return parsed;
  } catch {
    const seeded = structuredClone(INITIAL_SEED);
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), 'utf-8');
    return seeded;
  }
}

let dbState: DatabaseState = ensureDb();

function persistDb(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(dbState, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_FILE);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored?: string): boolean {
  if (!stored || !stored.includes(':')) {
    return password === 'techora123';
  }
  const [salt, key] = stored.split(':');
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function signToken(user: User): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      role: user.role,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): { sub: string; role: UserRole } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      sub: string;
      role: UserRole;
      exp: number;
    };
    if (Date.now() > parsed.exp) return null;
    return { sub: parsed.sub, role: parsed.role };
  } catch {
    return null;
  }
}

function sanitizeUser(u: User): Omit<User, 'passwordHash'> {
  const { passwordHash: _removed, ...safe } = u;
  return safe;
}

interface AuthedRequest extends Request {
  authUser?: User;
}

function attachAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    const verified = verifyToken(token);
    if (verified) {
      const user = dbState.users.find((u) => u.id === verified.sub);
      if (user && user.status === 'active') {
        req.authUser = user;
      }
    }
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
    return;
  }
  if (req.authUser.status === 'suspended') {
    res.status(403).json({ error: 'This account has been suspended. Contact TECHORA support.' });
    return;
  }
  next();
}

function requireRoles(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ error: 'Insufficient permissions for this operation.' });
      return;
    }
    next();
  };
}

function pushNotification(item: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'>): void {
  dbState.notifications.unshift({
    ...item,
    id: `notif-${crypto.randomUUID().slice(0, 8)}`,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
  if (dbState.notifications.length > 200) {
    dbState.notifications = dbState.notifications.slice(0, 200);
  }
}

function recalcProductRating(productId: string): void {
  const revs = dbState.reviews.filter((r) => r.productId === productId);
  const prod = dbState.products.find((p) => p.id === productId);
  if (!prod) return;
  if (revs.length === 0) return;
  const avg = revs.reduce((s, r) => s + r.rating, 0) / revs.length;
  prod.rating = Number(avg.toFixed(1));
  prod.reviewCount = revs.length;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use(attachAuth);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'techora-platform', timestamp: new Date().toISOString() });
  });

  // Public bootstrap (storefront data only; never leaks private PII)
  app.get('/api/bootstrap', (_req, res) => {
    res.json({
      appSettings: dbState.appSettings,
      categories: dbState.categories
        .filter((c) => c.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
      shops: dbState.shops.filter((s) => s.status === 'approved'),
      products: dbState.products.filter((p) => {
        if (!p.isActive) return false;
        const shop = dbState.shops.find((s) => s.id === p.shopId);
        return shop?.status === 'approved';
      }),
      reviews: dbState.reviews,
      promoNotifications: dbState.notifications.filter((n) => n.targetRole === 'all'),
    });
  });

  // Auth: Send OTP
  app.post('/api/auth/send-otp', (req, res) => {
    const contact = String(req.body?.contact || '').trim().toLowerCase();
    if (!contact || contact.length < 5) {
      res.status(400).json({ error: 'Please provide a valid email or mobile number.' });
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(contact, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
    res.json({
      message: `Verification code generated for ${contact}.`,
      // Returned in local development so OTP verification can be tested end-to-end without SMS gateway
      verificationCodePreview: code,
    });
  });

  // Auth: Verify OTP
  app.post('/api/auth/verify-otp', (req: AuthedRequest, res) => {
    const contact = String(req.body?.contact || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    const entry = otpStore.get(contact);
    if (!entry || Date.now() > entry.expiresAt || entry.code !== code) {
      res.status(400).json({ error: 'Invalid or expired 6-digit OTP code.' });
      return;
    }
    otpStore.delete(contact);
    if (req.authUser) {
      req.authUser.otpVerified = true;
      persistDb();
    }
    res.json({ verified: true });
  });

  // Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const user = dbState.users.find((u) => u.email.toLowerCase() === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    if (user.status === 'suspended') {
      res.status(403).json({ error: 'Your account is suspended. Please contact support.' });
      return;
    }
    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  });

  // Auth: Register (Customer or Seller)
  app.post('/api/auth/register', (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const password = String(req.body?.password || '');
    const requestedRole = req.body?.role === 'seller' ? 'seller' : 'customer';
    const otpVerified = Boolean(req.body?.otpVerified);

    if (name.length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    if (dbState.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const newUser: User = {
      id: `user-${crypto.randomUUID().slice(0, 8)}`,
      name,
      email,
      phone: phone || '+1 415 555 0000',
      passwordHash: hashPassword(password),
      role: requestedRole,
      status: 'active',
      emailVerified: true,
      otpVerified,
      addresses: [],
      wishlist: [],
      createdAt: new Date().toISOString(),
    };
    dbState.users.push(newUser);

    if (requestedRole === 'seller') {
      pushNotification({
        targetRole: 'super_admin',
        title: 'New Seller Registered',
        message: `${name} (${email}) created a seller account.`,
        type: 'seller',
      });
    }

    persistDb();
    const token = signToken(newUser);
    res.status(201).json({ token, user: sanitizeUser(newUser) });
  });

  // Auth: Quick Demo Switch (restricted strictly to pre-seeded demo accounts)
  app.post('/api/auth/demo-login', (req, res) => {
    const role = String(req.body?.role || '');
    const user = dbState.users.find((u) => u.role === role && u.status === 'active');
    if (!user) {
      res.status(404).json({ error: 'Demo account for selected role is unavailable.' });
      return;
    }
    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: sanitizeUser(req.authUser!) });
  });

  app.put('/api/auth/profile', requireAuth, (req: AuthedRequest, res) => {
    const name = String(req.body?.name || '').trim();
    const phone = String(req.body?.phone || '').trim();
    if (name.length < 2) {
      res.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }
    req.authUser!.name = name;
    if (phone) req.authUser!.phone = phone;
    persistDb();
    res.json({ user: sanitizeUser(req.authUser!) });
  });

  // Customer State
  app.get('/api/customer/state', requireAuth, (req: AuthedRequest, res) => {
    const uid = req.authUser!.id;
    const role = req.authUser!.role;
    const orders = dbState.orders
      .filter((o) => o.customerId === uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const payments = dbState.payments
      .filter((p) => p.customerId === uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const notifications = dbState.notifications.filter(
      (n) =>
        n.targetUserId === uid ||
        n.targetRole === 'all' ||
        n.targetRole === role,
    );
    const tickets = dbState.supportTickets.filter((t) => t.userId === uid);
    res.json({
      orders,
      payments,
      addresses: req.authUser!.addresses,
      wishlist: req.authUser!.wishlist,
      notifications,
      tickets,
    });
  });

  // Customer Address Book CRUD
  app.post('/api/customer/addresses', requireAuth, (req: AuthedRequest, res) => {
    const { label, recipientName, phone, street, city, postalCode, isDefault } = req.body || {};
    if (!recipientName || !phone || !street || !city || !postalCode) {
      res.status(400).json({ error: 'All address fields are required.' });
      return;
    }
    const newAddr: Address = {
      id: `addr-${crypto.randomUUID().slice(0, 8)}`,
      label: String(label || 'Delivery').trim(),
      recipientName: String(recipientName).trim(),
      phone: String(phone).trim(),
      street: String(street).trim(),
      city: String(city).trim(),
      postalCode: String(postalCode).trim(),
      isDefault: Boolean(isDefault) || req.authUser!.addresses.length === 0,
    };
    if (newAddr.isDefault) {
      req.authUser!.addresses.forEach((a) => {
        a.isDefault = false;
      });
    }
    req.authUser!.addresses.push(newAddr);
    persistDb();
    res.status(201).json({ addresses: req.authUser!.addresses });
  });

  app.delete('/api/customer/addresses/:id', requireAuth, (req: AuthedRequest, res) => {
    const id = req.params.id;
    req.authUser!.addresses = req.authUser!.addresses.filter((a) => a.id !== id);
    persistDb();
    res.json({ addresses: req.authUser!.addresses });
  });

  // Wishlist Toggle
  app.post('/api/customer/wishlist/toggle', requireAuth, (req: AuthedRequest, res) => {
    const productId = String(req.body?.productId || '');
    if (!dbState.products.some((p) => p.id === productId)) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const idx = req.authUser!.wishlist.indexOf(productId);
    if (idx >= 0) {
      req.authUser!.wishlist.splice(idx, 1);
    } else {
      req.authUser!.wishlist.push(productId);
    }
    persistDb();
    res.json({ wishlist: req.authUser!.wishlist });
  });

  // Payment Tokenization (Never stores raw card PAN/CVV!)
  app.post('/api/payments/tokenize', requireAuth, (req, res) => {
    const rawNumber = String(req.body?.cardNumber || '').replace(/[\s-]/g, '');
    const expiry = String(req.body?.expiry || '').trim();
    const cvv = String(req.body?.cvv || '').trim();
    const holder = String(req.body?.cardHolder || '').trim();

    if (!/^\d{13,19}$/.test(rawNumber)) {
      res.status(400).json({ error: 'Please enter a valid 13-19 digit card number.' });
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      res.status(400).json({ error: 'Please enter card expiry in MM/YY format.' });
      return;
    }
    if (!/^\d{3,4}$/.test(cvv)) {
      res.status(400).json({ error: 'Please enter a valid 3 or 4 digit security code.' });
      return;
    }
    if (holder.length < 2) {
      res.status(400).json({ error: 'Cardholder name is required.' });
      return;
    }

    // Honest payment gateway decline simulation for test cards ending in 0000 or CVV 000
    if (rawNumber.endsWith('0000') || cvv === '000') {
      res.status(402).json({
        error: 'Payment declined by issuing bank. Please verify card details or use Cash on Delivery.',
      });
      return;
    }

    const last4 = rawNumber.slice(-4);
    const brand = rawNumber.startsWith('4')
      ? 'Visa'
      : rawNumber.startsWith('5')
        ? 'Mastercard'
        : 'Card';
    const tokenRef = `pay_tok_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

    res.json({
      gatewayRef: tokenRef,
      cardLast4: last4,
      cardBrand: brand,
    });
  });

  // Place Order (groups cart items by Shop cleanly, checks stock, enforces non-raw payment)
  app.post('/api/orders', requireAuth, (req: AuthedRequest, res) => {
    const body = req.body || {};
    const validation = validateCheckoutPayload({
      items: body.items || [],
      recipientName: body.deliveryAddress?.recipientName || '',
      phone: body.deliveryAddress?.phone || '',
      street: body.deliveryAddress?.street || '',
      city: body.deliveryAddress?.city || '',
      postalCode: body.deliveryAddress?.postalCode || '',
      paymentMethod: body.paymentMethod,
      cardTokenRef: body.cardTokenRef,
      cardLast4: body.cardLast4,
    });

    if (!validation.valid) {
      res.status(400).json({ error: validation.errors[0], errors: validation.errors });
      return;
    }

    if (
      (body.cardTokenRef && containsRawCardNumber(String(body.cardTokenRef))) ||
      body.cardNumber ||
      body.cvv
    ) {
      res.status(400).json({ error: 'Security violation: raw card credentials cannot be sent to orders.' });
      return;
    }

    const method: PaymentMethod = body.paymentMethod;
    if (method === 'cod' && !dbState.appSettings.paymentSettings.codEnabled) {
      res.status(400).json({ error: 'Cash on Delivery is currently disabled by platform settings.' });
      return;
    }
    if (method === 'online_card' && !dbState.appSettings.paymentSettings.onlinePaymentEnabled) {
      res.status(400).json({ error: 'Online card payments are currently disabled.' });
      return;
    }

    // Group items by shopId and validate stock
    const grouped = new Map<string, Array<{ product: Product; shop: Shop; quantity: number }>>();
    for (const reqItem of body.items as Array<{ productId: string; quantity: number }>) {
      const product = dbState.products.find((p) => p.id === reqItem.productId && p.isActive);
      if (!product) {
        res.status(404).json({ error: `Product ${reqItem.productId} is no longer available.` });
        return;
      }
      const shop = dbState.shops.find((s) => s.id === product.shopId && s.status === 'approved');
      if (!shop) {
        res.status(400).json({ error: `Shop for ${product.name} is currently unavailable.` });
        return;
      }
      if (!shop.isOpen) {
        res.status(400).json({ error: `${shop.name} is currently closed and not accepting orders.` });
        return;
      }
      const qty = Math.floor(Number(reqItem.quantity));
      if (qty <= 0 || product.stock < qty) {
        res.status(400).json({
          error: `Insufficient stock for ${product.name}. Available: ${product.stock}.`,
        });
        return;
      }
      const list = grouped.get(shop.id) || [];
      list.push({ product, shop, quantity: qty });
      grouped.set(shop.id, list);
    }

    const createdOrders: Order[] = [];
    const createdPayments: PaymentRecord[] = [];
    const now = new Date().toISOString();

    for (const [shopId, entries] of grouped.entries()) {
      const shop = entries[0].shop;
      const commissionRate =
        shop.commissionOverride ?? dbState.appSettings.paymentSettings.platformCommissionPercent;

      const calc = calculateOrderTotals(
        entries.map((e) => ({
          price: e.product.price,
          discountPercent: e.product.discountPercent,
          quantity: e.quantity,
        })),
        dbState.appSettings.deliverySettings,
        commissionRate,
      );

      // Decrement stock
      for (const e of entries) {
        e.product.stock -= e.quantity;
      }

      const orderItems: OrderItem[] = entries.map((e) => ({
        productId: e.product.id,
        productName: e.product.name,
        shopId: shop.id,
        shopName: shop.name,
        unitPrice: e.product.price,
        discountPercent: e.product.discountPercent,
        finalUnitPrice: calculateDiscountedPrice(e.product.price, e.product.discountPercent),
        quantity: e.quantity,
        image: e.product.images[0] || '',
      }));

      const seq = 1004 + dbState.orders.length;
      const orderId = `ord-${crypto.randomUUID().slice(0, 8)}`;
      const orderNumber = `TCH-2026-${seq}`;
      const isOnlinePaid = method === 'online_card' || method === 'upi_instant';
      const paymentRef =
        method === 'online_card'
          ? String(body.cardTokenRef)
          : method === 'upi_instant'
            ? `upi_${crypto.randomUUID().slice(0, 10)}`
            : `cod_${seq}`;

      const newOrder: Order = {
        id: orderId,
        orderNumber,
        customerId: req.authUser!.id,
        customerName: req.authUser!.name,
        customerPhone: String(body.deliveryAddress.phone).trim(),
        customerEmail: req.authUser!.email,
        shopId: shop.id,
        shopName: shop.name,
        items: orderItems,
        subtotal: calc.subtotal,
        discountSavings: calc.discountSavings,
        deliveryCharge: calc.deliveryCharge,
        platformCommission: calc.platformCommission,
        sellerPayout: calc.sellerPayout,
        total: calc.total,
        paymentMethod: method,
        paymentStatus: isOnlinePaid ? 'paid' : 'pending',
        paymentRef,
        orderStatus: 'pending',
        deliveryAddress: {
          id: body.deliveryAddress.id || `addr-${crypto.randomUUID().slice(0, 6)}`,
          label: body.deliveryAddress.label || 'Delivery',
          recipientName: String(body.deliveryAddress.recipientName).trim(),
          phone: String(body.deliveryAddress.phone).trim(),
          street: String(body.deliveryAddress.street).trim(),
          city: String(body.deliveryAddress.city).trim(),
          postalCode: String(body.deliveryAddress.postalCode).trim(),
          isDefault: false,
        },
        timeline: [
          {
            status: 'pending',
            note: isOnlinePaid
              ? `Order placed and payment authorized (${paymentRef}).`
              : 'Order placed with Cash on Delivery.',
            timestamp: now,
            actor: req.authUser!.name,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      const newPayment: PaymentRecord = {
        id: `pay-${crypto.randomUUID().slice(0, 8)}`,
        orderId,
        orderNumber,
        customerId: req.authUser!.id,
        customerName: req.authUser!.name,
        shopId: shop.id,
        shopName: shop.name,
        amount: calc.total,
        platformCommission: calc.platformCommission,
        sellerNet: calc.sellerPayout,
        method,
        status: isOnlinePaid ? 'paid' : 'pending',
        gatewayRef: paymentRef,
        cardLast4: body.cardLast4 ? String(body.cardLast4) : undefined,
        cardBrand: body.cardBrand ? String(body.cardBrand) : undefined,
        createdAt: now,
      };

      dbState.orders.unshift(newOrder);
      dbState.payments.unshift(newPayment);
      createdOrders.push(newOrder);
      createdPayments.push(newPayment);

      if (dbState.appSettings.notificationSettings.notifySellerOnOrder) {
        pushNotification({
          targetRole: 'seller',
          targetUserId: shop.ownerId,
          title: `New Order ${orderNumber}`,
          message: `${req.authUser!.name} placed an order for ${dbState.appSettings.paymentSettings.currencySymbol}${calc.total.toFixed(2)}.`,
          type: 'order',
        });
      }
      if (dbState.appSettings.notificationSettings.notifyOnNewOrder) {
        pushNotification({
          targetRole: 'super_admin',
          title: `Order ${orderNumber} Placed`,
          message: `Shop: ${shop.name} · Total: ${dbState.appSettings.paymentSettings.currencySymbol}${calc.total.toFixed(2)}.`,
          type: 'order',
        });
      }
    }

    persistDb();
    res.status(201).json({ orders: createdOrders, payments: createdPayments });
  });

  // Update Order Status (Seller, Admin, Super Admin, or Customer cancellation)
  app.put('/api/orders/:id/status', requireAuth, (req: AuthedRequest, res) => {
    const order = dbState.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const user = req.authUser!;
    const shop = dbState.shops.find((s) => s.id === order.shopId);
    const isAdmin = user.role === 'super_admin' || user.role === 'admin';
    const isSellerOwner = user.role === 'seller' && shop?.ownerId === user.id;
    const isCustomerOwner = order.customerId === user.id;

    if (!isAdmin && !isSellerOwner && !isCustomerOwner) {
      res.status(403).json({ error: 'Not authorized to update this order.' });
      return;
    }

    const nextStatus = req.body?.status as OrderStatus;
    const check = validateOrderTransition(order.orderStatus, nextStatus, user.role);
    if (!check.valid) {
      res.status(400).json({ error: check.reason });
      return;
    }

    const now = new Date().toISOString();
    order.orderStatus = nextStatus;
    order.updatedAt = now;

    if (nextStatus === 'shipped') {
      const dp = req.body?.deliveryPartner || {};
      order.deliveryPartner = {
        name: String(dp.name || dbState.appSettings.deliverySettings.defaultPartnerName),
        phone: String(dp.phone || dbState.appSettings.deliverySettings.defaultPartnerPhone),
        trackingCode: String(
          dp.trackingCode || `TCH-${Math.floor(10000 + Math.random() * 89999)}`,
        ),
        estimatedEta: String(dp.estimatedEta || dbState.appSettings.deliverySettings.defaultEtaText),
      };
    }

    if (nextStatus === 'delivered' && order.paymentMethod === 'cod') {
      order.paymentStatus = 'paid';
      const pay = dbState.payments.find((p) => p.orderId === order.id);
      if (pay) pay.status = 'paid';
    }

    if (nextStatus === 'cancelled' || nextStatus === 'rejected') {
      // Restore inventory stock
      for (const item of order.items) {
        const prod = dbState.products.find((p) => p.id === item.productId);
        if (prod) prod.stock += item.quantity;
      }
      if (order.paymentStatus === 'paid') {
        order.paymentStatus = 'refund_requested';
        const pay = dbState.payments.find((p) => p.orderId === order.id);
        if (pay) pay.status = 'refund_requested';
      }
    }

    const note =
      String(req.body?.note || '').trim() ||
      `Order marked ${nextStatus} by ${user.name}.`;

    order.timeline.push({
      status: nextStatus,
      note,
      timestamp: now,
      actor: user.name,
    });

    if (dbState.appSettings.notificationSettings.notifyCustomerOnStatusChange) {
      pushNotification({
        targetRole: 'customer',
        targetUserId: order.customerId,
        title: `Order ${order.orderNumber} ${nextStatus.toUpperCase()}`,
        message: note,
        type: 'order',
      });
    }

    persistDb();
    res.json({ order });
  });

  // Reviews
  app.post('/api/reviews', requireAuth, (req: AuthedRequest, res) => {
    if (!dbState.appSettings.productSettings.allowCustomerReviews) {
      res.status(403).json({ error: 'Customer reviews are currently disabled.' });
      return;
    }
    const { productId, rating, comment } = req.body || {};
    const product = dbState.products.find((p) => p.id === productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const numericRating = Math.min(5, Math.max(1, Number(rating) || 5));
    const cleanComment = String(comment || '').trim();
    if (cleanComment.length < 4) {
      res.status(400).json({ error: 'Please write at least 4 characters in your review.' });
      return;
    }
    const review: Review = {
      id: `rev-${crypto.randomUUID().slice(0, 8)}`,
      productId: product.id,
      shopId: product.shopId,
      customerId: req.authUser!.id,
      customerName: req.authUser!.name,
      rating: numericRating,
      comment: cleanComment,
      createdAt: new Date().toISOString(),
    };
    dbState.reviews.unshift(review);
    recalcProductRating(product.id);
    persistDb();
    res.status(201).json({ review, product });
  });

  // Support Tickets
  app.post('/api/support', requireAuth, (req: AuthedRequest, res) => {
    const subject = String(req.body?.subject || '').trim();
    const message = String(req.body?.message || '').trim();
    if (subject.length < 3 || message.length < 8) {
      res.status(400).json({ error: 'Please include a clear subject and description.' });
      return;
    }
    const ticket: SupportTicket = {
      id: `tick-${crypto.randomUUID().slice(0, 8)}`,
      userId: req.authUser!.id,
      userName: req.authUser!.name,
      userEmail: req.authUser!.email,
      subject,
      message,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    dbState.supportTickets.unshift(ticket);
    pushNotification({
      targetRole: 'super_admin',
      title: 'New Support Request',
      message: `${req.authUser!.name}: ${subject}`,
      type: 'system',
    });
    persistDb();
    res.status(201).json({ ticket });
  });

  // Mark Notification Read
  app.put('/api/notifications/:id/read', requireAuth, (req, res) => {
    const notif = dbState.notifications.find((n) => n.id === req.params.id);
    if (notif) {
      notif.isRead = true;
      persistDb();
    }
    res.json({ ok: true });
  });

  // ================= SELLER DASHBOARD ROUTES =================
  app.get('/api/seller/state', requireRoles('seller', 'admin', 'super_admin'), (req: AuthedRequest, res) => {
    const uid = req.authUser!.id;
    const myShops = dbState.shops.filter((s) => s.ownerId === uid);
    const myShopIds = new Set(myShops.map((s) => s.id));
    const myProducts = dbState.products.filter((p) => myShopIds.has(p.shopId));
    const myOrders = dbState.orders
      .filter((o) => myShopIds.has(o.shopId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const myPayments = dbState.payments
      .filter((p) => myShopIds.has(p.shopId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const notifications = dbState.notifications.filter(
      (n) => n.targetUserId === uid || n.targetRole === 'seller' || n.targetRole === 'all',
    );
    res.json({
      shops: myShops,
      products: myProducts,
      orders: myOrders,
      payments: myPayments,
      notifications,
    });
  });

  // Create Shop (Seller or Admin)
  app.post('/api/shops', requireRoles('seller', 'admin', 'super_admin'), (req: AuthedRequest, res) => {
    const { name, description, address, city, phone, category, bannerUrl, logoText } = req.body || {};
    if (!name || !description || !address || !city || !phone) {
      res.status(400).json({ error: 'Shop name, description, address, city, and phone are required.' });
      return;
    }
    const isAdmin = req.authUser!.role === 'super_admin' || req.authUser!.role === 'admin';
    const autoApprove = isAdmin || dbState.appSettings.shopSettings.autoApproveSellers;
    const cleanName = String(name).trim();
    const shop: Shop = {
      id: `shop-${crypto.randomUUID().slice(0, 8)}`,
      ownerId: String(req.body?.ownerId && isAdmin ? req.body.ownerId : req.authUser!.id),
      name: cleanName,
      slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      logoText: String(logoText || cleanName.slice(0, 2).toUpperCase()),
      bannerUrl: String(bannerUrl || '/src/assets/images/shop_banner_urban_audio_1794818828912.jpg'),
      description: String(description).trim(),
      address: String(address).trim(),
      city: String(city).trim(),
      phone: String(phone).trim(),
      category: String(category || 'Audio & Sound'),
      isOpen: autoApprove,
      status: autoApprove ? 'approved' : 'pending',
      rating: 5.0,
      reviewCount: 0,
      createdAt: new Date().toISOString(),
    };
    dbState.shops.push(shop);
    if (!autoApprove) {
      pushNotification({
        targetRole: 'super_admin',
        title: 'Shop Application Pending',
        message: `${shop.name} requested marketplace approval.`,
        type: 'seller',
      });
    }
    persistDb();
    res.status(201).json({ shop });
  });

  // Update Shop
  app.put('/api/shops/:id', requireRoles('seller', 'admin', 'super_admin'), (req: AuthedRequest, res) => {
    const shop = dbState.shops.find((s) => s.id === req.params.id);
    if (!shop) {
      res.status(404).json({ error: 'Shop not found.' });
      return;
    }
    const isAdmin = req.authUser!.role === 'super_admin' || req.authUser!.role === 'admin';
    if (!isAdmin && shop.ownerId !== req.authUser!.id) {
      res.status(403).json({ error: 'Sellers can only update their own shops.' });
      return;
    }
    const fields = ['name', 'description', 'address', 'city', 'phone', 'category', 'bannerUrl', 'logoText'] as const;
    for (const f of fields) {
      if (typeof req.body?.[f] === 'string' && req.body[f].trim()) {
        (shop as unknown as Record<string, unknown>)[f] = req.body[f].trim();
      }
    }
    if (isAdmin && typeof req.body?.commissionOverride === 'number') {
      shop.commissionOverride = req.body.commissionOverride;
    }
    persistDb();
    res.json({ shop });
  });

  // Toggle Shop Open/Close
  app.put('/api/shops/:id/toggle-open', requireRoles('seller', 'admin', 'super_admin'), (req: AuthedRequest, res) => {
    const shop = dbState.shops.find((s) => s.id === req.params.id);
    if (!shop) {
      res.status(404).json({ error: 'Shop not found.' });
      return;
    }
    const isAdmin = req.authUser!.role === 'super_admin' || req.authUser!.role === 'admin';
    if (!isAdmin && shop.ownerId !== req.authUser!.id) {
      res.status(403).json({ error: 'Not authorized.' });
      return;
    }
    if (!isAdmin && !dbState.appSettings.shopSettings.allowSellerSelfClose) {
      res.status(403).json({ error: 'Platform policy restricts self-closing shops.' });
      return;
    }
    shop.isOpen = !shop.isOpen;
    persistDb();
    res.json({ shop });
  });

  // Product CRUD (Seller owns shop OR Admin)
  app.post('/api/products', requireRoles('seller', 'admin', 'super_admin'), (req: AuthedRequest, res) => {
    const { shopId, name, description, category, price, discountPercent, stock, images, specs } =
      req.body || {};
    const shop = dbState.shops.find((s) => s.id === shopId);
    if (!shop) {
      res.status(404).json({ error: 'Target shop not found.' });
      return;
    }
    const isAdmin = req.authUser!.role === 'super_admin' || req.authUser!.role === 'admin';
    if (!isAdmin && shop.ownerId !== req.authUser!.id) {
      res.status(403).json({ error: 'Sellers can only add products to their own shops.' });
      return;
    }
    if (!name || Number(price) <= 0) {
      res.status(400).json({ error: 'Product name and a positive price are required.' });
      return;
    }
    const maxDiscount = dbState.appSettings.productSettings.maxDiscountPercent;
    const product: Product = {
      id: `prod-${crypto.randomUUID().slice(0, 8)}`,
      shopId: shop.id,
      name: String(name).trim(),
      description: String(description || 'Local studio hardware product.').trim(),
      category: String(category || shop.category),
      price: Number(Number(price).toFixed(2)),
      discountPercent: Math.min(maxDiscount, Math.max(0, Number(discountPercent) || 0)),
      stock: Math.max(0, Math.floor(Number(stock) || 0)),
      images:
        Array.isArray(images) && images.length > 0
          ? images
          : ['/src/assets/images/product_wireless_headphones_1794818826813.jpg'],
      specs: Array.isArray(specs) ? specs : ['Verified Local Warranty', 'Ready for Dispatch'],
      rating: 5.0,
      reviewCount: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    dbState.products.unshift(product);
    persistDb();
    res.status(201).json({ product });
  });

  app.put('/api/products/:id', requireRoles('seller', 'admin', 'super_admin'), (req: AuthedRequest, res) => {
    const product = dbState.products.find((p) => p.id === req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const shop = dbState.shops.find((s) => s.id === product.shopId);
    const isAdmin = req.authUser!.role === 'super_admin' || req.authUser!.role === 'admin';
    if (!isAdmin && shop?.ownerId !== req.authUser!.id) {
      res.status(403).json({ error: 'Not authorized to edit this product.' });
      return;
    }
    const b = req.body || {};
    if (typeof b.name === 'string' && b.name.trim()) product.name = b.name.trim();
    if (typeof b.description === 'string') product.description = b.description.trim();
    if (typeof b.category === 'string' && b.category.trim()) product.category = b.category.trim();
    if (typeof b.price === 'number' && b.price > 0) product.price = Number(b.price.toFixed(2));
    if (typeof b.discountPercent === 'number') {
      product.discountPercent = Math.min(
        dbState.appSettings.productSettings.maxDiscountPercent,
        Math.max(0, b.discountPercent),
      );
    }
    if (typeof b.stock === 'number') product.stock = Math.max(0, Math.floor(b.stock));
    if (typeof b.isActive === 'boolean') product.isActive = b.isActive;
    if (Array.isArray(b.images) && b.images.length > 0) product.images = b.images;
    if (Array.isArray(b.specs)) product.specs = b.specs;
    persistDb();
    res.json({ product });
  });

  app.delete('/api/products/:id', requireRoles('seller', 'admin', 'super_admin'), (req: AuthedRequest, res) => {
    const idx = dbState.products.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const product = dbState.products[idx];
    const shop = dbState.shops.find((s) => s.id === product.shopId);
    const isAdmin = req.authUser!.role === 'super_admin' || req.authUser!.role === 'admin';
    if (!isAdmin && shop?.ownerId !== req.authUser!.id) {
      res.status(403).json({ error: 'Not authorized to delete this product.' });
      return;
    }
    dbState.products.splice(idx, 1);
    persistDb();
    res.json({ deletedId: product.id });
  });

  // ================= SUPER ADMIN & ADMIN ROUTES =================
  app.get('/api/admin/state', requireRoles('super_admin', 'admin'), (req: AuthedRequest, res) => {
    const analytics = computeAnalyticsSummary(
      dbState.orders,
      dbState.shops,
      dbState.products,
      dbState.users,
    );
    res.json({
      users: dbState.users.map(sanitizeUser),
      shops: dbState.shops,
      categories: dbState.categories.sort((a, b) => a.sortOrder - b.sortOrder),
      products: dbState.products,
      orders: dbState.orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      payments: dbState.payments.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      notifications: dbState.notifications,
      supportTickets: dbState.supportTickets,
      appSettings: dbState.appSettings,
      analytics,
    });
  });

  // Admin: Shop Status / Approval / Delete
  app.put('/api/shops/:id/status', requireRoles('super_admin', 'admin'), (req: AuthedRequest, res) => {
    if (
      req.authUser!.role === 'admin' &&
      !dbState.appSettings.permissionSettings.adminCanApproveSellers
    ) {
      res.status(403).json({ error: 'Super Admin restricted seller approval to Super Admin only.' });
      return;
    }
    const shop = dbState.shops.find((s) => s.id === req.params.id);
    if (!shop) {
      res.status(404).json({ error: 'Shop not found.' });
      return;
    }
    const status = req.body?.status as Shop['status'];
    if (!['pending', 'approved', 'rejected', 'inactive'].includes(status)) {
      res.status(400).json({ error: 'Invalid shop status.' });
      return;
    }
    shop.status = status;
    shop.isOpen = status === 'approved';
    pushNotification({
      targetRole: 'seller',
      targetUserId: shop.ownerId,
      title: `Shop ${status.toUpperCase()}`,
      message: `${shop.name} status was updated to ${status} by ${req.authUser!.name}.`,
      type: 'seller',
    });
    persistDb();
    res.json({ shop });
  });

  app.delete('/api/shops/:id', requireRoles('super_admin', 'admin'), (req, res) => {
    const idx = dbState.shops.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Shop not found.' });
      return;
    }
    const [removed] = dbState.shops.splice(idx, 1);
    dbState.products = dbState.products.filter((p) => p.shopId !== removed.id);
    persistDb();
    res.json({ deletedId: removed.id });
  });

  // Admin: Categories CRUD
  app.post('/api/categories', requireRoles('super_admin', 'admin'), (req, res) => {
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    if (name.length < 2) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }
    const category: Category = {
      id: `cat-${crypto.randomUUID().slice(0, 8)}`,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: description || `${name} products`,
      isActive: true,
      sortOrder: dbState.categories.length + 1,
    };
    dbState.categories.push(category);
    persistDb();
    res.status(201).json({ category });
  });

  app.put('/api/categories/:id', requireRoles('super_admin', 'admin'), (req, res) => {
    const cat = dbState.categories.find((c) => c.id === req.params.id);
    if (!cat) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    if (typeof req.body?.name === 'string' && req.body.name.trim()) cat.name = req.body.name.trim();
    if (typeof req.body?.description === 'string') cat.description = req.body.description.trim();
    if (typeof req.body?.isActive === 'boolean') cat.isActive = req.body.isActive;
    persistDb();
    res.json({ category: cat });
  });

  app.delete('/api/categories/:id', requireRoles('super_admin', 'admin'), (req, res) => {
    const idx = dbState.categories.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    const [removed] = dbState.categories.splice(idx, 1);
    persistDb();
    res.json({ deletedId: removed.id });
  });

  // Admin: User Status & Role Management
  app.put('/api/admin/users/:id/status', requireRoles('super_admin', 'admin'), (req: AuthedRequest, res) => {
    const target = dbState.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (target.id === req.authUser!.id || target.role === 'super_admin') {
      res.status(400).json({ error: 'Cannot suspend active Super Admin account.' });
      return;
    }
    target.status = req.body?.status === 'suspended' ? 'suspended' : 'active';
    persistDb();
    res.json({ user: sanitizeUser(target) });
  });

  app.put('/api/admin/users/:id/role', requireRoles('super_admin'), (req: AuthedRequest, res) => {
    const target = dbState.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (target.id === req.authUser!.id) {
      res.status(400).json({ error: 'Cannot demote your own Super Admin account.' });
      return;
    }
    const nextRole = req.body?.role as UserRole;
    if (!['admin', 'seller', 'customer'].includes(nextRole)) {
      res.status(400).json({ error: 'Invalid role selection.' });
      return;
    }
    target.role = nextRole;
    persistDb();
    res.json({ user: sanitizeUser(target) });
  });

  // Admin: Refund Management
  app.post('/api/payments/:id/refund', requireRoles('super_admin', 'admin'), (req: AuthedRequest, res) => {
    if (
      req.authUser!.role === 'admin' &&
      !dbState.appSettings.permissionSettings.adminCanIssueRefunds
    ) {
      res.status(403).json({ error: 'Refund authority is restricted to Super Admin.' });
      return;
    }
    const pay = dbState.payments.find((p) => p.id === req.params.id);
    if (!pay) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }
    if (pay.status === 'refunded') {
      res.status(400).json({ error: 'Payment is already refunded.' });
      return;
    }
    pay.status = 'refunded';
    pay.refundReason = String(req.body?.reason || 'Refund issued by platform administrator').trim();
    const order = dbState.orders.find((o) => o.id === pay.orderId);
    if (order) {
      order.paymentStatus = 'refunded';
      order.updatedAt = new Date().toISOString();
      order.timeline.push({
        status: order.orderStatus,
        note: `Refund processed (${pay.refundReason}).`,
        timestamp: new Date().toISOString(),
        actor: req.authUser!.name,
      });
      pushNotification({
        targetRole: 'customer',
        targetUserId: order.customerId,
        title: `Refund Processed for ${order.orderNumber}`,
        message: `${dbState.appSettings.paymentSettings.currencySymbol}${pay.amount.toFixed(2)} refunded via ${pay.gatewayRef}.`,
        type: 'order',
      });
    }
    persistDb();
    res.json({ payment: pay, order });
  });

  // Admin: Broadcast Notification
  app.post('/api/notifications', requireRoles('super_admin', 'admin'), (req, res) => {
    const title = String(req.body?.title || '').trim();
    const message = String(req.body?.message || '').trim();
    const targetRole = req.body?.targetRole || 'all';
    const type = req.body?.type || 'promo';
    if (title.length < 3 || message.length < 5) {
      res.status(400).json({ error: 'Notification title and message are required.' });
      return;
    }
    pushNotification({ title, message, targetRole, type });
    persistDb();
    res.status(201).json({ notification: dbState.notifications[0] });
  });

  // Admin: Resolve Support Ticket
  app.put('/api/support/:id/resolve', requireRoles('super_admin', 'admin'), (req, res) => {
    const ticket = dbState.supportTickets.find((t) => t.id === req.params.id);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }
    ticket.status = 'resolved';
    persistDb();
    res.json({ ticket });
  });

  // Admin: Complete App Customization & Settings Update
  app.put('/api/settings', requireRoles('super_admin', 'admin'), (req: AuthedRequest, res) => {
    if (
      req.authUser!.role === 'admin' &&
      !dbState.appSettings.permissionSettings.adminCanEditBranding
    ) {
      res.status(403).json({ error: 'Global branding & settings are restricted to Super Admin.' });
      return;
    }
    dbState.appSettings = sanitizeAppSettings(req.body || {}, dbState.appSettings);
    persistDb();
    res.json({ appSettings: dbState.appSettings });
  });

  // Admin: Database Backup Export & Restore
  app.get('/api/admin/backup', requireRoles('super_admin'), (_req, res) => {
    dbState.appSettings.databaseSettings.lastBackupAt = new Date().toISOString();
    persistDb();
    res.json({ backup: dbState });
  });

  app.post('/api/admin/reset-demo', requireRoles('super_admin'), (_req, res) => {
    dbState = structuredClone(INITIAL_SEED);
    persistDb();
    res.json({ ok: true, appSettings: dbState.appSettings });
  });

  // Vite or Static Frontend
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TECHORA platform server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
