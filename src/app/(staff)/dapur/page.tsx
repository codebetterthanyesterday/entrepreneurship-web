import { requireRole, toActor } from "@/lib/session";
import { findKitchenQueue, toKitchenTicket } from "@/lib/queries/order.query";
import { canTransition } from "@/lib/services/order.service";
import { KitchenBoard } from "@/components/dapur/kitchen-board";
import { pageTitle } from "@/lib/brand";

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

  // Admins may open this board, but chapter 3 gives every kitchen edge to DAPUR
  // alone — so for them the buttons are drawn disabled with the reason rather
  // than left to fail on the first tap. Read from the transition table itself,
  // so the screen cannot drift away from what the server enforces.
  const canAct = canTransition("IN_QUEUE", "IN_PROGRESS", toActor(user).role);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
          Dapur {user.name}
        </h1>
        <p className="text-sm text-ink-soft">Kerjakan dari yang paling lama nunggu</p>
      </div>

      <KitchenBoard initialTickets={orders.map(toKitchenTicket)} canAct={canAct} />
    </div>
  );
}
