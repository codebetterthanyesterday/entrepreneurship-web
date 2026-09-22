import { auth } from "@/lib/auth";
import { ButtonLink } from "@/components/ui/button";
import { NoticePage } from "@/components/site/notice-page";

export default async function ForbiddenPage() {
  const session = await auth();
  const role = session?.user?.role;

  // Send them back to the area they are actually allowed into, rather than to a
  // generic home page they would have to navigate out of again.
  let href = "/";
  if (role === "ADMIN") href = "/admin";
  else if (role === "KASIR") href = "/kasir";
  else if (role === "DAPUR") href = "/dapur";

  return (
    <NoticePage
      eyebrow="403"
      title="Ini bukan bagian kamu."
      description="Kamu login dengan peran lain, dan halaman itu di luar jangkauannya. Nggak ada yang rusak — cuma salah pintu."
    >
      <ButtonLink href={href} className="bg-white text-ink-deep hover:bg-pink-soft">
        Balik ke tempat kerja
      </ButtonLink>
    </NoticePage>
  );
}
