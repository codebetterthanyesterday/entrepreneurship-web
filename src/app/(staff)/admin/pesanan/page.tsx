import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getAllOrders } from "@/lib/queries/report.query";
import { handoverView } from "@/lib/queries/order.query";
import { canTransition } from "@/lib/services/order.service";
import { ORDER_FILTERS, orderListHref, resolveOrderFilter } from "@/lib/order-filters";
import { OrderBrowser } from "@/components/admin/order-browser";
import { cn, formatRupiah } from "@/lib/utils";
import { pricedLines } from "@/lib/order-lines";
import type { AdminOrder } from "@/types/order-view";
import { pageTitle } from "@/lib/brand";
import { getSiteIdentity } from "@/lib/queries/site.query";
import { PageHead } from "@/components/staff/page-head";

export const metadata = {
  title: pageTitle("Pesanan"),
};

// The list changes as the booth trades, and it is not read through `fetch`, so
// Next would otherwise prerender it at build time.
export const dynamic = "force-dynamic";

/** The brief's threshold: beyond fifty rows the list is paginated. */
const PAGE_SIZE = 50;

/** One `?filter=` chip, rendered as a link so the list works without JS. */
function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // 44px matches the Chip primitive and the project's touch-target floor.
        // `ui-chip` is what gives it the theme's square, mono, hard-shadowed shape.
        "ui-chip inline-flex flex-none items-center justify-center px-3.5 min-h-[44px] transition-colors",
        active ? "bg-pink-deep text-white" : "bg-sand text-ink-soft hover:bg-pink-soft",
      )}
    >
      {label}
    </Link>
  );
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireRole("ADMIN");

  const params = await searchParams;
  const filterId = typeof params.filter === "string" ? params.filter : undefined;
  const pageParam = typeof params.page === "string" ? Number.parseInt(params.page, 10) : 1;

  const filter = resolveOrderFilter(filterId);

  const [{ orders, total, totalAmount, page, pageCount }, identity] = await Promise.all([
    getAllOrders({
      ...filter.where,
      page: Number.isNaN(pageParam) ? 1 : pageParam,
      pageSize: PAGE_SIZE,
    }),
    getSiteIdentity(),
  ]);

  // Plain values only — Prisma rows carry Temporal instants that cannot cross
  // the server/client boundary.
  const items: AdminOrder[] = orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    channel: order.channel,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone ?? null,
    pickupSlot: order.pickupSlot ?? null,
    ...handoverView(order),
    locationNotifiedAt: order.locationNotifiedAt?.toString() ?? null,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    hasPaymentProof: order.paymentProofUrl != null,
    notes: order.notes ?? null,
    totalAmount: order.totalAmount,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    handledByName: order.handledBy?.name ?? null,
    items: pricedLines(order).map((line) => ({
      name: line.name,
      quantity: line.quantity,
      priceAtOrder: line.priceAtOrder,
      subtotal: line.subtotal,
      contents: line.contents,
    })),
    timeline: {
      createdAt: order.createdAt.toString(),
      queuedAt: order.queuedAt?.toString() ?? null,
      startedAt: order.startedAt?.toString() ?? null,
      readyAt: order.readyAt?.toString() ?? null,
      completedAt: order.completedAt?.toString() ?? null,
    },
    // Read from the transition table rather than from a list of statuses
    // written out here, so the sheet cannot offer a cancellation the service
    // would then refuse.
    canCancel: canTransition(order.status, "CANCELLED", "ADMIN"),
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        className="mb-0"
        tag="Quest log"
        title="Pesanan"
        lede={`${total} pesanan · total ${formatRupiah(totalAmount)}`}
      />

      <nav
        aria-label="Filter pesanan"
        // One scrolling row on a phone rather than three wrapped ones; the
        // padding leaves room for the chips' hard shadows.
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2.5 pt-1 [scrollbar-width:none] tablet:flex-wrap"
      >
        {ORDER_FILTERS.map((option) => (
          <FilterChip
            key={option.id}
            label={option.label}
            // Changing the filter always goes back to page one; staying on
            // page 4 of a list that now has two pages is never what was meant.
            href={orderListHref(option.id, 1)}
            active={option.id === filter.id}
          />
        ))}
      </nav>

      <OrderBrowser orders={items} brand={identity.brandName} />

      {pageCount > 1 && (
        <nav
          aria-label="Halaman pesanan"
          className="flex items-center justify-between gap-3 pt-1"
        >
          <PageLink href={orderListHref(filter.id, page - 1)} disabled={page === 1}>
            ← Sebelumnya
          </PageLink>

          <span className="s-eyebrow tabular-nums">
            Halaman {page} dari {pageCount}
          </span>

          <PageLink href={orderListHref(filter.id, page + 1)} disabled={page === pageCount}>
            Berikutnya →
          </PageLink>
        </nav>
      )}
    </div>
  );
}

/**
 * A pagination step. At either end it is rendered as plain text rather than a
 * dead link — a link that goes nowhere is still reachable by keyboard and still
 * announced as a link.
 */
function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const shared = "ui-btn inline-flex items-center min-h-[44px] px-4 text-sm";

  if (disabled) {
    return <span className={cn(shared, "bg-sand text-ink-soft opacity-60 shadow-none")}>{children}</span>;
  }

  return (
    <Link
      href={href}
      className={cn(shared, "bg-white text-ink hover:bg-pink-soft")}
    >
      {children}
    </Link>
  );
}
