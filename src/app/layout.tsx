import { Fredoka, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import type { Metadata } from "next";

/*
 * PLACEHOLDER IDENTITY: the typefaces.
 *
 * The other half of the brand — its colours are the block at the top of
 * `globals.css`, its name is `src/lib/brand.ts`. To rebrand, swap the two
 * imports and the two calls below; the variable names stay, so nothing
 * downstream changes.
 *
 * Display: headings and figures. Body: everything else.
 */
const displayFont = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
});

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

import { ToastProvider } from "@/components/ui/use-toast";
import { Toast } from "@/components/ui/toast";

import type { Viewport } from "next";
import { pageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitle(),
  description: "Sistem Pemesanan F&B",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <ToastProvider>
          {children}
          <Toast />
        </ToastProvider>
      </body>
    </html>
  );
}
