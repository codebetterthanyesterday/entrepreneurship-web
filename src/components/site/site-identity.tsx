"use client";

import * as React from "react";
import { BRAND_NAME } from "@/lib/brand";

export interface SiteIdentityValue {
  brandName: string;
  tagline: string;
}

const SiteIdentityContext = React.createContext<SiteIdentityValue>({ brandName: BRAND_NAME, tagline: "" });

/**
 * The store's name and tagline from Admin → Pengaturan, for client pieces the
 * layout cannot pass them to: a route's loading screen renders inside the
 * layout but gets no props.
 */
export function SiteIdentityProvider({ value, children }: { value: SiteIdentityValue; children: React.ReactNode }) {
  return <SiteIdentityContext.Provider value={value}>{children}</SiteIdentityContext.Provider>;
}

export function useSiteIdentity(): SiteIdentityValue {
  return React.useContext(SiteIdentityContext);
}
