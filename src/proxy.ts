import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { mayReach, protectedAreaOf } from "@/lib/routes";

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;
  const { pathname } = req.nextUrl;

  // Cek apakah route ini diproteksi. Tabelnya ada di `@/lib/routes`, dibagi
  // dengan navigasi, supaya menu tidak pernah menawarkan layar yang justru
  // dibuang ke /403 oleh proxy ini.
  if (protectedAreaOf(pathname) !== null) {
    if (!isLoggedIn) {
      // Redirect to login if not logged in
      const callbackUrl = encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, req.nextUrl));
    }

    if (userRole && !mayReach(userRole, pathname)) {
      // Redirect to 403 if role doesn't match
      return NextResponse.redirect(new URL("/403", req.nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Kecualikan file statis Next.js, API routes, dan file dari folder public
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
