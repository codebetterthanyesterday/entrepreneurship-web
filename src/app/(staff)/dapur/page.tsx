import { requireRole, toActor } from "@/lib/session";
import { findKitchenQueue, toKitchenTicket } from "@/lib/queries/order.query";
import { canTransition } from "@/lib/services/order.service";
import { KitchenBoard } from "@/components/dapur/kitchen-board";
import { pageTitle } from "@/lib/brand";
import { PageHead } from "@/components/staff/page-head";

export const metadata = {
  title: pageTitle("Dapur"),
};

// The queue changes every time a cashier rings something up, and it is not read
// through `fetch`, so Next would otherwise prerender this at build time.
export const dynamic = "force-dynamic";

export default async function DapurPage() {
  const user = await requireRole("DAPUR", "ADMIN");

  // The board polls from the browser, but it starts from a queue rendered here
  // — a kitchen screen that shows nothing for its first five seconds reads as
  // "no orders" to whoever is standing in front of it.
  const orders = await findKitchenQueue();

  // Whether this account may work the tickets, read from the transition table
  // itself so the screen cannot drift from what the server enforces. DAPUR and
  // ADMIN may (an admin covers the pass during a break); anyone else would get
  // the buttons drawn disabled with the reason, rather than failing on a tap.
  const canAct = canTransition("IN_QUEUE", "IN_PROGRESS", toActor(user).role);

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        className="mb-0"
        tag="Kitchen castle"
        title={`Dapur ${user.name}`}
        lede="Kerjakan dari yang paling lama nunggu"
      />

      <KitchenBoard initialTickets={orders.map(toKitchenTicket)} canAct={canAct} />
    </div>
  );
}
