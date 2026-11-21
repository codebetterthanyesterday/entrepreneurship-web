import { or } from "@prisma/orm-postgres/orm-client";
import { prisma as db } from "@/lib/prisma";
import { todayInJakarta, windowLabel } from "@/lib/schedule";
import { getSettings } from "@/lib/services/setting.service";
import type { InboxSnapshot } from "@/lib/inbox";

/** The statuses an order can be in while somebody still has something to do with it. */
const OPEN_STATUSES = ["CONFIRMED", "IN_QUEUE", "IN_PROGRESS", "READY"] as const;

/**
 * What the inbox is read from, in a handful of bounded reads: the orders
 * still open, plus "Lainnya" ones turned away whose customer may still need
 * telling; the menu and the pakets; the time ranges of the open dates from
 * today on; and the low-stock threshold. Done orders, past dates and the
 * order history are never loaded.
 */
export async function loadInboxSnapshot(): Promise<InboxSnapshot> {
  const today = todayInJakarta();

  const [orders, products, bundles, days, settings] = await Promise.all([
    db.orm.public.Order.where((order) =>
      or(
        order.status.in([...OPEN_STATUSES]),
        // A rejected "Lainnya" order is cancelled, and its customer may not
        // know yet; `buildInbox` keeps only those still to be told.
        order.status.eq("CANCELLED"),
      ),
    )
      .where((order) => or(order.status.neq("CANCELLED"), order.handoverLocation.eq("OTHER")))
      .where((order) => or(order.status.neq("CANCELLED"), order.locationNotifiedAt.isNull()))
      .include("serviceWindow")
      .all(),
    db.orm.public.Product.all(),
    db.orm.public.Bundle.where({ isActive: true }).include("items").all(),
    db.orm.public.ServiceDay.where({ isOpen: true })
      .where((day) => day.date.gte(today))
      .include("windows")
      .all(),
    getSettings(),
  ]);

  return {
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      channel: order.channel,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      customerName: order.customerName,
      customerPhone: order.customerPhone ?? null,
      totalAmount: order.totalAmount,
      hasPaymentProof: order.paymentProofUrl != null,
      serviceDate: order.serviceDate ?? null,
      pickupSlot: order.pickupSlot ?? null,
      windowEndMinute: order.serviceWindow?.endMinute ?? null,
      handoverLocation: order.handoverLocation ?? null,
      handoverDetail: order.handoverDetail ?? null,
      locationReviewedAt: order.locationReviewedAt?.toString() ?? null,
      locationNotifiedAt: order.locationNotifiedAt?.toString() ?? null,
      notes: order.notes ?? null,
      createdAt: order.createdAt.toString(),
      updatedAt: order.updatedAt.toString(),
      queuedAt: order.queuedAt?.toString() ?? null,
      readyAt: order.readyAt?.toString() ?? null,
    })),
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      stock: product.stock,
      isActive: product.isActive,
    })),
    bundles: bundles.map((bundle) => ({
      id: bundle.id,
      name: bundle.name,
      isActive: bundle.isActive,
      items: bundle.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    })),
    windows: days
      .sort((a, b) => a.date.localeCompare(b.date))
      .flatMap((day) =>
        [...day.windows]
          .sort((a, b) => a.startMinute - b.startMinute)
          .map((window) => ({
            date: day.date,
            label: windowLabel(window.startMinute, window.endMinute),
            quota: window.quota,
            booked: window.booked,
          })),
      ),
    lowStockThreshold: settings.lowStockThreshold,
  };
}
