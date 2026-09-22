import { PIPELINE_STATUSES, type OrderListFilter } from "@/lib/queries/report.query";
import type { OrderStatus } from "@/types/order";

/** Every status bar the final one — an order still in play. */
const UNFINISHED_STATUSES: readonly OrderStatus[] = PIPELINE_STATUSES.filter(
  (status) => status !== "DONE",
);

export interface OrderFilterOption {
  /** What goes in `?filter=`. */
  id: string;
  label: string;
  /** The `getAllOrders` arguments this chip stands for. */
  where: Omit<OrderListFilter, "page" | "pageSize">;
}

/**
 * The chips above the order list.
 *
 * Both of the last two deliberately exclude cancelled orders by naming the
 * statuses they want rather than by filtering on payment alone. An admin
 * reading "Belum bayar" is asking who still owes money, and a voided order owes
 * nothing — leaving cancellations in would inflate that count with rows nobody
 * needs to chase. The unfiltered "Semua" chip still shows them, so nothing is
 * hidden, only kept out of the counts that would be wrong.
 */
export const ORDER_FILTERS: readonly OrderFilterOption[] = [
  { id: "semua", label: "Semua", where: {} },
  { id: "preorder", label: "Preorder", where: { channel: "PREORDER" } },
  { id: "ditempat", label: "Di tempat", where: { channel: "ONSITE" } },
  { id: "belum-selesai", label: "Belum selesai", where: { status: UNFINISHED_STATUSES } },
  {
    id: "belum-bayar",
    label: "Belum bayar",
    where: { paymentStatus: "UNPAID", status: PIPELINE_STATUSES },
  },
];

const DEFAULT_FILTER = ORDER_FILTERS[0]!;

/**
 * The chip a `?filter=` value names, falling back to "Semua".
 *
 * A URL can be edited, bookmarked from an older version of this page, or simply
 * mistyped; none of those is worth an error page when showing everything is a
 * perfectly good answer.
 */
export function resolveOrderFilter(id: string | undefined): OrderFilterOption {
  return ORDER_FILTERS.find((option) => option.id === id) ?? DEFAULT_FILTER;
}

/** The querystring for a given chip and page, leaving out the defaults. */
export function orderListHref(filterId: string, page: number): string {
  const params = new URLSearchParams();

  if (filterId !== DEFAULT_FILTER.id) params.set("filter", filterId);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/admin/pesanan?${query}` : "/admin/pesanan";
}
