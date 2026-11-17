import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";
import { BRAND_NAME, pageTitle } from "@/lib/brand";
import { BrandMark } from "@/components/site/brand-mark";
import { KingdomRoot } from "@/components/site/kingdom-root";
import "../kingdom.css";
import "../staff.css";

export const metadata = {
  title: pageTitle("Masuk"),
};

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    // Redirect based on role
    const role = session.user.role;
    if (role === "ADMIN") redirect("/admin");
    if (role === "KASIR") redirect("/kasir");
    if (role === "DAPUR") redirect("/dapur");
    redirect("/"); // fallback
  }

  return (
    // The staff entrance: the kingdom's sky and hills, one card in the middle.
    <KingdomRoot className="s-login">
      <div className="s-login-mid">
        <div className="s-login-card">
          {/* The logo carries the name, so the heading's brand is the logo. */}
          <BrandMark label={BRAND_NAME} className="mx-auto mb-2 block w-[74px]" />

          <p className="text-center">
            <span className="k-tag k-tag-yellow">★ Staff entrance</span>
          </p>
          <h1 className="s-h1 mb-1 text-center">Masuk dulu ya</h1>
          <p className="text-center text-sm text-ink-soft">Khusus tim internal {BRAND_NAME}</p>

          <div className="mt-5">
            <LoginForm />
          </div>
        </div>
      </div>

      <div className="s-login-hills" aria-hidden="true">
        <i style={{ left: "-12%", width: "58%", background: "var(--k-grass-deep)" }} />
        <i style={{ right: "-14%", width: "62%", background: "var(--k-grass-deep)" }} />
        <i style={{ left: "26%", width: "48%", transform: "translateY(52%)" }} />
      </div>
      <div className="s-login-base" aria-hidden="true" />
      <p className="s-login-foot">{BRAND_NAME} snacks {"//"} staff only</p>
    </KingdomRoot>
  );
}
