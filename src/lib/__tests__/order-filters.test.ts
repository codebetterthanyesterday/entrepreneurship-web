import { describe, expect, it } from "vitest";
import { ORDER_FILTERS, orderListHref, resolveOrderFilter } from "@/lib/order-filters";

describe("ORDER_FILTERS", () => {
  it("offers the five chips the screen is specified with", () => {
    expect(ORDER_FILTERS.map((option) => option.label)).toEqual([
      "Semua",
      "Preorder",
      "Di tempat",
      "Belum selesai",
      "Belum bayar",
    ]);
  });

  it("filters nothing on the default chip", () => {
    expect(resolveOrderFilter("semua").where).toEqual({});
  });

  it("treats 'Belum selesai' as everything up to but not including DONE", () => {
    const { where } = resolveOrderFilter("belum-selesai");

    expect(where.status).toEqual(["CONFIRMED", "IN_QUEUE", "IN_PROGRESS", "READY"]);
    // A finished order is not outstanding work, and neither is a voided one.
    expect(where.status).not.toContain("DONE");
    expect(where.status).not.toContain("CANCELLED");
  });

  it("keeps voided orders out of 'Belum bayar'", () => {
    // An admin reading this chip is asking who still owes money. A cancelled
    // order owes nothing, so counting it would send someone chasing a customer
    // who does not owe anything.
    const { where } = resolveOrderFilter("belum-bayar");

    expect(where.paymentStatus).toBe("UNPAID");
    expect(where.status).not.toContain("CANCELLED");
  });
});

describe("resolveOrderFilter", () => {
  it("falls back to 'Semua' for an unknown or missing value", () => {
    // URLs get edited, bookmarked and mistyped; showing everything is a
    // perfectly good answer and beats an error page.
    expect(resolveOrderFilter(undefined).id).toBe("semua");
    expect(resolveOrderFilter("tidak-ada").id).toBe("semua");
    expect(resolveOrderFilter("").id).toBe("semua");
  });
});

describe("orderListHref", () => {
  it("leaves the defaults out of the URL", () => {
    expect(orderListHref("semua", 1)).toBe("/admin/pesanan");
  });

  it("names the filter and the page when they are not the defaults", () => {
    expect(orderListHref("belum-bayar", 1)).toBe("/admin/pesanan?filter=belum-bayar");
    expect(orderListHref("semua", 3)).toBe("/admin/pesanan?page=3");
    expect(orderListHref("preorder", 2)).toBe("/admin/pesanan?filter=preorder&page=2");
  });
});
