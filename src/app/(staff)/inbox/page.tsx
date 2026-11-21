import { inboxFor } from "@/lib/services/inbox.service";
import { requireRole } from "@/lib/session";
import { pageTitle } from "@/lib/brand";
import { PageHead } from "@/components/staff/page-head";
import { InboxList } from "@/components/staff/inbox-list";
import type { UserRole } from "@/types/order";

export const metadata = {
  title: pageTitle("Inbox"),
};

// What needs doing changes by the minute; never prerendered.
export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await requireRole("KASIR", "DAPUR", "ADMIN");
  const items = await inboxFor({ id: user.id, role: user.role as UserRole });

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        className="mb-0"
        tag="Quest board"
        title="Inbox"
        lede="Yang perlu ditangani sekarang. Ketuk satu buat langsung ke layarnya; begitu beres, hilang sendiri."
      />
      <InboxList initial={items} />
    </div>
  );
}
