import localFont from "next/font/local";
import "./globals.css";
import type { Metadata } from "next";

/*
 * The typefaces, served from this repo (`src/app/fonts/`, latin subset, each
 * with its OFL licence beside it) rather than through `next/font/google`.
 *
 * `next/font/google` downloads the stylesheet from Google at build time, and
 * Google sometimes answers with `/l/font?kit=…&skey=…` URLs that Turbopack
 * cannot parse ("next/font/google queries have exactly one entry"): the build
 * or dev server then fails on a response nobody controls. Local files make
 * every build the same. To refresh them, fetch the latin block of
 * fonts.googleapis.com/css2 with a modern browser's user agent.
 *
 * PLACEHOLDER IDENTITY: the brand's colours are the block at the top of
 * `globals.css`, its name is `src/lib/brand.ts`. To rebrand, swap the files and
 * the two calls below; the variable names stay, so nothing downstream changes.
 *
 * Display: headings and figures. Body: everything else.
 */
const displayFont = localFont({
  src: "./fonts/fredoka-latin-400-600.woff2",
  weight: "400 600",
  variable: "--font-display",
});

const bodyFont = localFont({
  src: "./fonts/plus-jakarta-sans-latin-400-700.woff2",
  weight: "400 700",
  variable: "--font-body",
});

/*
 * THE SNACK KINGDOM TYPEFACES — the customer side only.
 *
 * The retro-game theme the customer pages wear (`[data-theme="kingdom"]` in
 * `globals.css`, shapes in `kingdom.css`) sets its own four faces:
 * a heavy display, a rounded body, a mono for labels and a pixel face for the
 * splash screen. They are declared here rather than in the public layout
 * because sheets and the toast are portalled into <body>, outside that layout's
 * wrapper, and have to find the variables too. A browser only downloads a face
 * it actually renders, so the staff screens never fetch these.
 */
const kingdomHead = localFont({
  src: "./fonts/rubik-latin-700-900.woff2",
  weight: "700 900",
  variable: "--font-k-head",
});

const kingdomBody = localFont({
  src: "./fonts/nunito-latin-400-800.woff2",
  weight: "400 800",
  variable: "--font-k-body",
});

const kingdomMono = localFont({
  src: [
    { path: "./fonts/space-mono-latin-400.woff2", weight: "400" },
    { path: "./fonts/space-mono-latin-700.woff2", weight: "700" },
  ],
  variable: "--font-k-mono",
});

const kingdomPixel = localFont({
  src: [
    { path: "./fonts/silkscreen-latin-400.woff2", weight: "400" },
    { path: "./fonts/silkscreen-latin-700.woff2", weight: "700" },
  ],
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
