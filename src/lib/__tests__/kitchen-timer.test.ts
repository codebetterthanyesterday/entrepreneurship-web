import { describe, expect, it } from "vitest";
import {
  LATE_AFTER_MINUTES,
  WARN_AFTER_MINUTES,
  formatWaiting,
  minutesWaiting,
  timerTone,
} from "@/lib/kitchen-timer";
import type { KitchenTicket } from "@/types/order-view";

const NOW = Date.parse("2026-09-20T10:00:00.000Z");

function ticket(overrides: Partial<KitchenTicket> = {}): KitchenTicket {
  return {
    id: "t1",
    orderNumber: "OS-0001",
    channel: "ONSITE",
    customerName: "Pelanggan booth",
    status: "IN_QUEUE",
    notes: null,
    queuedAt: "2026-09-20T09:55:00.000Z",
    startedAt: null,
    createdAt: "2026-09-20T09:00:00.000Z",
    items: [],
    ...overrides,
  };
}

describe("minutesWaiting", () => {
  it("counts from queuedAt, not from when the order was placed", () => {
    // Placed an hour ago, queued five minutes ago. The kitchen is not late for
    // the fifty-five minutes it did not know the order existed.
    expect(minutesWaiting(ticket(), NOW)).toBe(5);
  });

  it("falls back to createdAt when the order was never stamped", () => {
    expect(minutesWaiting(ticket({ queuedAt: null }), NOW)).toBe(60);
  });

  it("floors to whole minutes", () => {
    expect(minutesWaiting(ticket({ queuedAt: "2026-09-20T09:58:31.000Z" }), NOW)).toBe(1);
  });

  it("reads a clock skewed into the future as zero, never as negative", () => {
    expect(minutesWaiting(ticket({ queuedAt: "2026-09-20T10:05:00.000Z" }), NOW)).toBe(0);
  });

  it("survives an unparseable timestamp", () => {
    expect(minutesWaiting(ticket({ queuedAt: "not a date", createdAt: "nor this" }), NOW)).toBe(0);
  });
});

describe("timerTone", () => {
  it("stays neutral below the warn threshold", () => {
    expect(timerTone(WARN_AFTER_MINUTES - 1, "IN_QUEUE")).toBe("neutral");
  });

  it("escalates exactly at the thresholds, not one minute later", () => {
    expect(timerTone(WARN_AFTER_MINUTES, "IN_QUEUE")).toBe("warn");
    expect(timerTone(LATE_AFTER_MINUTES, "IN_QUEUE")).toBe("late");
  });

  it("escalates a ticket being cooked too", () => {
    expect(timerTone(WARN_AFTER_MINUTES, "IN_PROGRESS")).toBe("warn");
    expect(timerTone(LATE_AFTER_MINUTES, "IN_PROGRESS")).toBe("late");
  });

  it("never escalates a ticket that is already made", () => {
    // The cooking is done; colouring this as kitchen lateness would blame the
    // wrong station and teach the cooks to ignore red.
    expect(timerTone(LATE_AFTER_MINUTES * 10, "READY")).toBe("neutral");
  });
});

describe("formatWaiting", () => {
  it("says 'baru' before the first minute is up", () => {
    expect(formatWaiting(0)).toBe("baru");
  });

  it("counts minutes after that", () => {
    expect(formatWaiting(1)).toBe("1 mnt");
    expect(formatWaiting(12)).toBe("12 mnt");
  });
});
