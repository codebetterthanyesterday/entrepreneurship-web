import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";
import { BRAND_NAME, pageTitle } from "@/lib/brand";

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
        {/* Brand */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <span className="w-2.5 h-2.5 bg-pink rounded-full" aria-hidden="true" />
          <h1 className="font-display font-semibold text-xl text-pink-deep">
            {BRAND_NAME}
          </h1>
        </div>

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
