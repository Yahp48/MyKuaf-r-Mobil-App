export type BusinessType = "SALON" | "SELLER";

export interface Business {
  id: string;
  type: BusinessType;
  status: "ACTIVE" | "SUSPENDED";
  displayName: string;
  legalName: string;
  taxNumber: string;
  taxOffice: string;
  mersisNo: string | null;
  kepAddress: string | null;
  address: string;
  city: string;
  district: string;
  postalCode: string | null;
  phone: string;
  email: string;
  iban: string | null;
  shippingFee: number;
  freeShippingThreshold: number;
  returnPolicy: string | null;
  logoUrl: string | null;
  storeDescription: string | null;
  verificationStatus: VerificationStatus;
  verificationNote: string | null;
  hasTaxCertificate: boolean;
  createdAt: string;
}

export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

export interface Owner {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface SalonProfile {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  district: string | null;
  phone: string | null;
  website: string | null;
  latitude: number;
  longitude: number;
  coverImageUrl: string | null;
  photos: string[];
  kind: "HAIR" | "BEAUTY" | "NAIL" | "SKIN" | "MASSAGE" | "BROW_LASH" | "MAKEUP";
  whatsapp: string | null;
  firstVisitDiscountPercent: number | null;
  isActive: boolean;
  slotIntervalMinutes: number;
  bookingLeadMinutes: number;
  bookingHorizonDays: number;
  cancellationWindowHours: number;
  autoConfirm: boolean;
  rating: number;
  ratingCount: number;
}

export interface Session {
  owner: Owner;
  /** Yönetici oturumunda null'dur; işletme sayfaları yöneticiye hiç açılmaz (RequireBusiness yönlendirir). */
  business: Business;
  salon: SalonProfile | null;
  isAdmin?: boolean;
}

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export interface Appointment {
  id: string;
  code: string;
  status: AppointmentStatus;
  source: "APP" | "MANUAL";
  startsAt: string;
  endsAt: string;
  date: string;
  time: string;
  endTime: string;
  durationMinutes: number;
  total: number;
  customer: { name: string; phone: string | null; isAppUser: boolean };
  customerNote: string | null;
  businessNote: string | null;
  staff: { id: string; name: string; title: string | null };
  services: { id: string; name: string; price: number; durationMinutes: number }[];
  review: { rating: number; comment: string | null } | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface Staff {
  id: string;
  name: string;
  title: string | null;
  avatarUrl: string | null;
  specialties: string[];
  bio: string | null;
  isActive: boolean;
  sortOrder: number;
  monthCompleted?: number;
  monthRevenue?: number;
  upcomingCount?: number;
}

export interface Service {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  durationMinutes: number;
  price: number;
  isActive: boolean;
  sortOrder: number;
  discount: {
    percent: number;
    price: number;
    startsOn: string;
    endsOn: string;
    status: "ACTIVE" | "SCHEDULED" | "ENDED";
  } | null;
  /** Fiyat artışından sonra indirim başlatılabilecek ilk gün (YYYY-AA-GG); kısıt yoksa null */
  discountAllowedFrom: string | null;
}

export interface ServicePackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  listPrice: number;
  isActive: boolean;
  sortOrder: number;
  services: { id: string; name: string; price: number }[];
}

export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: "CARD" | "WALLET";
  subtotal: number;
  shipping: number;
  total: number;
  shippingAddress: {
    title: string;
    fullName: string;
    phone: string;
    city: string;
    district: string;
    line: string;
    postalCode: string | null;
  };
  carrier: string | null;
  trackingNumber: string | null;
  items: {
    productId: string;
    name: string;
    image: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  itemCount: number;
  cancelReason: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  customerEmail?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  sku: string | null;
  category: { id: string; name: string };
  price: number;
  compareAtPrice: number | null;
  stock: number;
  images: string[];
  features: string[];
  isActive: boolean;
  rating: number;
  ratingCount: number;
  sold30d?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}
