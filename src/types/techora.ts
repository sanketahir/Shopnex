export type UserRole = 'super_admin' | 'admin' | 'seller' | 'customer';
export type AccountStatus = 'active' | 'suspended';
export type ShopStatus = 'pending' | 'approved' | 'rejected' | 'inactive';
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

export type PaymentMethod = 'cod' | 'online_card' | 'upi_instant';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refund_requested' | 'refunded';

export interface Address {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash?: string;
  role: UserRole;
  status: AccountStatus;
  emailVerified: boolean;
  otpVerified: boolean;
  addresses: Address[];
  wishlist: string[];
  createdAt: string;
}

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  logoText: string;
  logoUrl?: string;
  bannerUrl: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  category: string;
  isOpen: boolean;
  status: ShopStatus;
  rating: number;
  reviewCount: number;
  commissionOverride?: number;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  discountPercent: number;
  stock: number;
  images: string[];
  specs: string[];
  rating: number;
  reviewCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  shopId: string;
  shopName: string;
  unitPrice: number;
  discountPercent: number;
  finalUnitPrice: number;
  quantity: number;
  image: string;
}

export interface DeliveryPartnerInfo {
  name: string;
  phone: string;
  trackingCode: string;
  estimatedEta: string;
}

export interface OrderTimelineEvent {
  status: OrderStatus;
  note: string;
  timestamp: string;
  actor: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shopId: string;
  shopName: string;
  items: OrderItem[];
  subtotal: number;
  discountSavings: number;
  deliveryCharge: number;
  platformCommission: number;
  sellerPayout: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentRef: string;
  orderStatus: OrderStatus;
  deliveryAddress: Address;
  deliveryPartner?: DeliveryPartnerInfo;
  timeline: OrderTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  shopId: string;
  shopName: string;
  amount: number;
  platformCommission: number;
  sellerNet: number;
  method: PaymentMethod;
  status: PaymentStatus;
  gatewayRef: string;
  cardLast4?: string;
  cardBrand?: string;
  refundReason?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  shopId: string;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  targetRole: UserRole | 'all';
  targetUserId?: string;
  title: string;
  message: string;
  type: 'order' | 'promo' | 'system' | 'seller';
  isRead: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface NavigationMenuItem {
  id: string;
  label: string;
  target: 'home' | 'shops' | 'orders' | 'support';
  enabled: boolean;
}

export interface AppSettings {
  // 1-9 Branding & Layout
  appDisplayName: string;
  appLogoUrl: string;
  appIconText: string;
  splashTagline: string;
  splashEnabled: boolean;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontStyle: 'Outfit' | 'Plus Jakarta Sans' | 'Manrope' | 'DM Sans' | 'Playfair Display';
  homeLayout: 'editorial' | 'catalog' | 'compact';

  // 10-13 Media, Categories & Navigation
  heroHeadline: string;
  heroSubheadline: string;
  heroBannerUrl: string;
  promotionalImages: string[];
  promoBannerText: string;
  promoBannerEnabled: boolean;
  navigationMenu: NavigationMenuItem[];

  // 14-19 Contact, Legal & Social
  contactAddress: string;
  whatsappNumber: string;
  supportEmail: string;
  socialInstagram: string;
  socialTwitter: string;
  socialLinkedIn: string;
  termsAndConditions: string;
  privacyPolicy: string;

  // Admin Settings Modules
  shopSettings: {
    autoApproveSellers: boolean;
    allowSellerSelfClose: boolean;
    maxProductsPerShop: number;
  };
  productSettings: {
    requireStockTracking: boolean;
    maxDiscountPercent: number;
    allowCustomerReviews: boolean;
  };
  paymentSettings: {
    codEnabled: boolean;
    onlinePaymentEnabled: boolean;
    upiEnabled: boolean;
    gatewayProvider: 'Stripe Connect' | 'Razorpay Marketplace' | 'Adyen MarketPay';
    platformCommissionPercent: number;
    currencyCode: string;
    currencySymbol: string;
  };
  deliverySettings: {
    baseDeliveryCharge: number;
    freeDeliveryThreshold: number;
    defaultEtaText: string;
    defaultPartnerName: string;
    defaultPartnerPhone: string;
  };
  notificationSettings: {
    notifyOnNewOrder: boolean;
    notifySellerOnOrder: boolean;
    notifyCustomerOnStatusChange: boolean;
    promotionalPushEnabled: boolean;
  };
  permissionSettings: {
    adminCanEditBranding: boolean;
    adminCanApproveSellers: boolean;
    adminCanIssueRefunds: boolean;
  };
  securitySettings: {
    requireOtpForCheckout: boolean;
    requireEmailVerification: boolean;
    sessionTimeoutMinutes: number;
  };
  databaseSettings: {
    autoBackupIntervalHours: number;
    lastBackupAt: string;
  };
}

export interface CartItem {
  productId: string;
  quantity: number;
}
