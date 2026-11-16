import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { INITIAL_SEED } from '../data/seed';
import type {
  Address,
  AppSettings,
  CartItem,
  Category,
  NotificationItem,
  Order,
  PaymentRecord,
  Product,
  Review,
  Shop,
  SupportTicket,
  User,
  UserRole,
} from '../types/techora';
import type { AnalyticsSummary } from '../utils/commerce';

export type AppView =
  | 'home'
  | 'shops'
  | 'orders'
  | 'account'
  | 'support'
  | 'seller'
  | 'admin';

interface AdminDataset {
  users: User[];
  shops: Shop[];
  categories: Category[];
  products: Product[];
  orders: Order[];
  payments: PaymentRecord[];
  notifications: NotificationItem[];
  supportTickets: SupportTicket[];
  analytics: AnalyticsSummary;
}

interface SellerDataset {
  shops: Shop[];
  products: Product[];
  orders: Order[];
  payments: PaymentRecord[];
  notifications: NotificationItem[];
}

interface CustomerDataset {
  orders: Order[];
  payments: PaymentRecord[];
  addresses: Address[];
  wishlist: string[];
  notifications: NotificationItem[];
  tickets: SupportTicket[];
}

interface TechoraContextValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  toast: string | null;
  showToast: (msg: string) => void;
  token: string | null;
  currentUser: User | null;
  activeView: AppView;
  setActiveView: (v: AppView) => void;

  // Storefront & settings (supports live preview override!)
  appSettings: AppSettings;
  previewSettings: AppSettings | null;
  setPreviewSettings: (s: AppSettings | null) => void;
  effectiveSettings: AppSettings;

  categories: Category[];
  shops: Shop[];
  products: Product[];
  reviews: Review[];
  promoNotifications: NotificationItem[];

  // Role-scoped datasets
  customerData: CustomerDataset;
  sellerData: SellerDataset;
  adminData: AdminDataset | null;

  // Cart
  cart: CartItem[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (productId: string, quantity?: number) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartCount: number;

  // Modals
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;
  selectedShopId: string | null;
  setSelectedShopId: (id: string | null) => void;

  // Actions
  refreshAll: () => Promise<void>;
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
  loginWithDemoRole: (role: UserRole) => Promise<void>;
  logout: () => void;
  toggleWishlist: (productId: string) => Promise<void>;
}

const TechoraContext = createContext<TechoraContextValue | null>(null);

const TOKEN_STORAGE_KEY = 'techora_auth_token';
const CART_STORAGE_KEY = 'techora_cart_items';

export function TechoraProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<AppView>('home');

  const [appSettings, setAppSettings] = useState<AppSettings>(INITIAL_SEED.appSettings);
  const [previewSettings, setPreviewSettings] = useState<AppSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>(INITIAL_SEED.categories);
  const [shops, setShops] = useState<Shop[]>(INITIAL_SEED.shops.filter((s) => s.status === 'approved'));
  const [products, setProducts] = useState<Product[]>(INITIAL_SEED.products);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_SEED.reviews);
  const [promoNotifications, setPromoNotifications] = useState<NotificationItem[]>([]);

  const [customerData, setCustomerData] = useState<CustomerDataset>({
    orders: [],
    payments: [],
    addresses: [],
    wishlist: [],
    notifications: [],
    tickets: [],
  });
  const [sellerData, setSellerData] = useState<SellerDataset>({
    shops: [],
    products: [],
    orders: [],
    payments: [],
    notifications: [],
  });
  const [adminData, setAdminData] = useState<AdminDataset | null>(null);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3600);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage errors
    }
  }, [cart]);

  const apiFetch = useCallback(
    async <T = unknown>(url: string, init: RequestInit = {}): Promise<T> => {
      const headers = new Headers(init.headers);
      if (!headers.has('Content-Type') && init.body) {
        headers.set('Content-Type', 'application/json');
      }
      const activeToken = localStorage.getItem(TOKEN_STORAGE_KEY) || token;
      if (activeToken) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }
      const res = await fetch(url, { ...init, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = (data as { error?: string }).error || `Request failed (${res.status})`;
        throw new Error(message);
      }
      return data as T;
    },
    [token],
  );

  const refreshAll = useCallback(async () => {
    try {
      const boot = await apiFetch<{
        appSettings: AppSettings;
        categories: Category[];
        shops: Shop[];
        products: Product[];
        reviews: Review[];
        promoNotifications: NotificationItem[];
      }>('/api/bootstrap');

      setAppSettings(boot.appSettings);
      setCategories(boot.categories);
      setShops(boot.shops);
      setProducts(boot.products);
      setReviews(boot.reviews);
      setPromoNotifications(boot.promoNotifications);

      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        try {
          const meRes = await apiFetch<{ user: User }>('/api/auth/me');
          setCurrentUser(meRes.user);
          setToken(storedToken);

          const custRes = await apiFetch<CustomerDataset>('/api/customer/state');
          setCustomerData(custRes);

          if (meRes.user.role === 'seller') {
            const sellRes = await apiFetch<SellerDataset>('/api/seller/state');
            setSellerData(sellRes);
            setAdminData(null);
          } else if (meRes.user.role === 'admin' || meRes.user.role === 'super_admin') {
            const admRes = await apiFetch<AdminDataset & { appSettings: AppSettings }>(
              '/api/admin/state',
            );
            setAdminData(admRes);
          } else {
            setAdminData(null);
          }
        } catch {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setCurrentUser(null);
          setAdminData(null);
        }
      } else {
        setCurrentUser(null);
        setAdminData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to TECHORA server.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const effectiveSettings = useMemo(
    () => previewSettings || appSettings,
    [previewSettings, appSettings],
  );

  // Apply dynamic branding CSS variables whenever effectiveSettings changes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', effectiveSettings.primaryColor);
    root.style.setProperty('--brand-secondary', effectiveSettings.secondaryColor);
    root.style.setProperty('--brand-bg', effectiveSettings.backgroundColor);
    root.style.setProperty(
      '--brand-font-display',
      `"${effectiveSettings.fontStyle}", system-ui, sans-serif`,
    );
    document.title = `${effectiveSettings.appDisplayName} — Multi-Vendor Commerce`;
  }, [effectiveSettings]);

  const loginWithDemoRole = useCallback(
    async (role: UserRole) => {
      try {
        setError(null);
        const res = await apiFetch<{ token: string; user: User }>('/api/auth/demo-login', {
          method: 'POST',
          body: JSON.stringify({ role }),
        });
        localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
        setToken(res.token);
        setCurrentUser(res.user);
        setAuthModalOpen(false);
        await refreshAll();
        if (role === 'seller') setActiveView('seller');
        else if (role === 'super_admin' || role === 'admin') setActiveView('admin');
        else setActiveView('home');
        showToast(`Signed in as ${res.user.name} (${role.replace('_', ' ')})`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign-in failed.');
      }
    },
    [apiFetch, refreshAll, showToast],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setCurrentUser(null);
    setAdminData(null);
    setSellerData({ shops: [], products: [], orders: [], payments: [], notifications: [] });
    setCustomerData({
      orders: [],
      payments: [],
      addresses: [],
      wishlist: [],
      notifications: [],
      tickets: [],
    });
    setActiveView('home');
    showToast('Signed out of TECHORA');
  }, [showToast]);

  const addToCart = useCallback(
    (productId: string, quantity = 1) => {
      const prod = products.find((p) => p.id === productId);
      if (!prod) return;
      const shop = shops.find((s) => s.id === prod.shopId);
      if (shop && !shop.isOpen) {
        setError(`${shop.name} is currently closed and not accepting new orders.`);
        return;
      }
      if (prod.stock <= 0) {
        setError(`${prod.name} is currently out of stock.`);
        return;
      }
      setCart((prev) => {
        const existing = prev.find((c) => c.productId === productId);
        if (existing) {
          const nextQty = Math.min(prod.stock, existing.quantity + quantity);
          return prev.map((c) => (c.productId === productId ? { ...c, quantity: nextQty } : c));
        }
        return [...prev, { productId, quantity: Math.min(prod.stock, quantity) }];
      });
      showToast(`Added ${prod.name} to cart`);
    },
    [products, shops, showToast],
  );

  const updateCartQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        setCart((prev) => prev.filter((c) => c.productId !== productId));
        return;
      }
      const prod = products.find((p) => p.id === productId);
      const maxStock = prod ? prod.stock : 99;
      setCart((prev) =>
        prev.map((c) =>
          c.productId === productId ? { ...c, quantity: Math.min(maxStock, quantity) } : c,
        ),
      );
    },
    [products],
  );

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!currentUser) {
        setAuthModalOpen(true);
        showToast('Sign in to save items to your wishlist');
        return;
      }
      try {
        const res = await apiFetch<{ wishlist: string[] }>('/api/customer/wishlist/toggle', {
          method: 'POST',
          body: JSON.stringify({ productId }),
        });
        setCustomerData((prev) => ({ ...prev, wishlist: res.wishlist }));
        showToast(
          res.wishlist.includes(productId) ? 'Saved to wishlist' : 'Removed from wishlist',
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to update wishlist.');
      }
    },
    [apiFetch, currentUser, showToast],
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  return (
    <TechoraContext.Provider
      value={{
        loading,
        error,
        clearError,
        toast,
        showToast,
        token,
        currentUser,
        activeView,
        setActiveView,
        appSettings,
        previewSettings,
        setPreviewSettings,
        effectiveSettings,
        categories,
        shops,
        products,
        reviews,
        promoNotifications,
        customerData,
        sellerData,
        adminData,
        cart,
        cartOpen,
        setCartOpen,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartCount,
        authModalOpen,
        setAuthModalOpen,
        selectedProductId,
        setSelectedProductId,
        selectedShopId,
        setSelectedShopId,
        refreshAll,
        apiFetch,
        loginWithDemoRole,
        logout,
        toggleWishlist,
      }}
    >
      {children}
    </TechoraContext.Provider>
  );
}

export function useTechora(): TechoraContextValue {
  const ctx = useContext(TechoraContext);
  if (!ctx) {
    throw new Error('useTechora must be used inside TechoraProvider');
  }
  return ctx;
}
