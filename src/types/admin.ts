export type PrepType = "READY_TO_SERVE" | "NEEDS_PREP";

/** Plain, serialisable product row handed from the server page to the client UI. */
export interface AdminProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  prepType: PrepType;
  isActive: boolean;
  imageUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  sold: number;
}

export interface AdminCategory {
  id: string;
  name: string;
}

export interface AdminPickupSlot {
  id: string;
  label: string;
  quota: number;
  /** Places already taken by live orders; the quota cannot go below it. */
  booked: number;
  sortOrder: number;
  isActive: boolean;
}

export interface AdminStoreSettings {
  preorderOpen: boolean;
  boothOpen: boolean;
  lowStockThreshold: number;
  qrisImageUrl: string | null;
  adminWhatsapp: string | null;
}

/** A catalogue row as the customer-facing pages see it. */
export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  prepType: PrepType;
  imageUrl: string | null;
  categoryName: string | null;
}
