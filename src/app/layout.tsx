import {
  Fredoka,
  Nunito,
  Plus_Jakarta_Sans,
  Rubik,
  Silkscreen,
  Space_Mono,
} from "next/font/google";
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

/*
 * THE SNACK KINGDOM TYPEFACES — the customer side only.
 *
 * The retro-game theme the customer pages wear (`[data-theme="kingdom"]` in
 * `globals.css`, shapes in `(public)/kingdom.css`) sets its own four faces:
 * a heavy display, a rounded body, a mono for labels and a pixel face for the
 * splash screen. They are declared here rather than in the public layout
 * because sheets and the toast are portalled into <body>, outside that layout's
 * wrapper, and have to find the variables too. A browser only downloads a face
 * it actually renders, so the staff screens never fetch these.
 */
const kingdomHead = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-k-head",
});

const kingdomBody = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-k-body",
});

const kingdomMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-k-mono",
});

const kingdomPixel = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-k-pixel",
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
      <body
        className={`${displayFont.variable} ${bodyFont.variable} ${kingdomHead.variable} ${kingdomBody.variable} ${kingdomMono.variable} ${kingdomPixel.variable}`}
      >
        <ToastProvider>
          {children}
          <Toast />
        </ToastProvider>
      </body>
    </html>
  );
}
