import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";
import { BRAND_NAME, pageTitle } from "@/lib/brand";
import { BrandMark } from "@/components/site/brand-mark";

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
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        {/* Brand. The logo carries the name, so the heading is the logo. */}
        <h1 className="mb-7 flex justify-center">
          <BrandMark label={BRAND_NAME} className="w-36" />
        </h1>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border-[1.5px] border-line p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-display font-semibold text-ink">Masuk dulu ya</h2>
            <p className="text-sm text-ink-soft mt-1">Khusus tim internal</p>
          </div>
          
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
