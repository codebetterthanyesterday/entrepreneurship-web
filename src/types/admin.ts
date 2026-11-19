export type PrepType = "READY_TO_SERVE" | "NEEDS_PREP";

/** Plain, serialisable product row handed from the server page to the client UI. */
export interface AdminProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  prepType: PrepType;
  isActive: boolean;
  /** The cover: the first photo, or an address pasted in before uploads. */
  imageUrl: string | null;
  /** Every uploaded photo, in order; the first is the cover. */
  images: { id: string; url: string }[];
  categoryId: string | null;
  categoryName: string | null;
  sold: number;
}

export interface AdminCategory {
  id: string;
  name: string;
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
  /** The cover: the first photo, or an address pasted in before uploads. */
  imageUrl: string | null;
  /**
   * Every photo's address, in order, for the product's own sheet. Only the
   * catalogue loads them; elsewhere the cover is enough.
   */
  images?: string[];
  categoryName: string | null;
}
