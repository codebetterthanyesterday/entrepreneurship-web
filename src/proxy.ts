import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { gateStaffRequest, staffLoginPath } from "@/lib/staff-entrance";
import { orderPageNumber } from "@/lib/order-number";
import { orderNumberExists } from "@/lib/queries/order.query";

/**
 * An address no route matches. Rewriting to it makes Next answer with the
 * site's own 404 page and status, byte for byte what any mistyped address
 * gets, so a hidden staff screen cannot be told apart from a missing one.
 */
const NOWHERE = "/__tidak-ada";

export const proxy = auth(async (req) => {
  // Siapa boleh ke mana, dan apa yang disembunyikan dari pengunjung tanpa sesi,
  // ada di `@/lib/staff-entrance` (dan tabel peran di `@/lib/routes`), supaya
  // bisa diuji tanpa server.
  const decision = gateStaffRequest(req.nextUrl.pathname, {
    role: req.auth ? (req.auth.user?.role ?? "") : undefined,
    loginPath: staffLoginPath(),
  });

  switch (decision.kind) {
    case "rewrite": {
      const target = new URL(decision.to, req.nextUrl);
      target.search = req.nextUrl.search;
      return NextResponse.rewrite(target);
    }
    case "not-found":
      return NextResponse.rewrite(new URL(NOWHERE, req.nextUrl));
    case "redirect":
      return NextResponse.redirect(new URL(decision.to, req.nextUrl));
    case "next":
      break;
  }

  // An order page for an order that does not exist answers a real 404. The
  // page itself streams (the public `loading.tsx`), and a streamed response
  // has sent its 200 before the page can find out the order is missing.
  // If the lookup itself fails, the page goes ahead and handles a missing
  // order on its own: a soft 404 beats an error page.
  const number = orderPageNumber(req.nextUrl.pathname);
  if (number !== undefined) {
    const missing = number === null || !(await orderNumberExists(number).catch(() => true));
    if (missing) return NextResponse.rewrite(new URL(NOWHERE, req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Kecualikan file statis Next.js, API routes, dan file dari folder public
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
