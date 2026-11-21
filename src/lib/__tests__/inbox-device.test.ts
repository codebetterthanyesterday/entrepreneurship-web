import { describe, expect, it } from "vitest";
import type { InboxItem } from "@/lib/inbox";
import {
  EMPTY_DEVICE_STATE,
  isNew,
  isSnoozed,
  markOpened,
  parseDeviceState,
  pruneSnoozes,
  snooze,
  toAnnounce,
  unsnooze,
} from "@/lib/inbox-device";

const T = Date.parse("2026-11-22T05:00:00Z");

function item(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    key: "qris-proof:PO-7KX4QM",
    kind: "qris-proof",
    tone: "urgent",
    title: "Bukti QRIS masuk",
    detail: "PO-7KX4QM · Rani",
    since: new Date(T).toISOString(),
    href: "/kasir/preorder?pesanan=PO-7KX4QM",
    actionLabel: "Cek bukti",
    ...overrides,
  };
}

const stock = item({ key: "stock-low:p1", kind: "stock-low", tone: "watch", title: "Stok menipis" });

describe("what a phone remembers about the inbox", () => {
  it("reads back what it stored, and shrugs off anything broken", () => {
    expect(parseDeviceState(null)).toEqual(EMPTY_DEVICE_STATE);
    expect(parseDeviceState("{not json")).toEqual(EMPTY_DEVICE_STATE);
    expect(parseDeviceState(JSON.stringify({ alerts: "yes", snoozed: { a: "x", b: 5 }, announced: [1, "k"] }))).toEqual({
      ...EMPTY_DEVICE_STATE,
      snoozed: { b: 5 },
      announced: ["k"],
    });
  });

  it("counts “Baru” from the open before this one, and treats a reload as the same open", () => {
    const first = markOpened(EMPTY_DEVICE_STATE, T);
    expect(first).toMatchObject({ openedAt: T, previousOpenedAt: null });
    // Nothing is new on a phone that has never opened the inbox before.
    expect(isNew(item({ since: new Date(T + 60_000).toISOString() }), first)).toBe(false);

    expect(markOpened(first, T + 5_000)).toBe(first);
    const second = markOpened(first, T + 3_600_000);
    expect(second).toMatchObject({ openedAt: T + 3_600_000, previousOpenedAt: T });
    expect(isNew(item({ since: new Date(T + 60_000).toISOString() }), second)).toBe(true);
    expect(isNew(item({ since: new Date(T - 60_000).toISOString() }), second)).toBe(false);
  });

  it("never marks a “Pantau” item as new: it is a state, not an event", () => {
    const opened = markOpened(markOpened(EMPTY_DEVICE_STATE, T - 3_600_000), T);
    expect(isNew({ ...stock, since: new Date(T + 1).toISOString() }, opened)).toBe(false);
  });

  it("puts a “Pantau” item off for an hour, and nothing more pressing", () => {
    const later = snooze(EMPTY_DEVICE_STATE, stock, T);
    expect(isSnoozed(later, stock.key, T + 59 * 60_000)).toBe(true);
    expect(isSnoozed(later, stock.key, T + 61 * 60_000)).toBe(false);
    expect(pruneSnoozes(later, T + 61 * 60_000).snoozed).toEqual({});

    expect(snooze(EMPTY_DEVICE_STATE, item(), T)).toBe(EMPTY_DEVICE_STATE);
    expect(isSnoozed(unsnooze(later, stock.key), stock.key, T)).toBe(false);
  });

  it("chimes once for each new piece of work, never for “Pantau”, never twice", () => {
    const work = item();
    const first = toAnnounce(EMPTY_DEVICE_STATE, [work, stock]);
    expect(first.fresh.map((i) => i.key)).toEqual([work.key]);

    const again = toAnnounce(first.next, [work, stock]);
    expect(again.fresh).toEqual([]);
    expect(again.next).toBe(first.next);

    const another = item({ key: "ready:PO-2", kind: "ready", tone: "action" });
    expect(toAnnounce(first.next, [work, another]).fresh.map((i) => i.key)).toEqual(["ready:PO-2"]);
    // Dealt-with work is forgotten, so the list stays small.
    expect(toAnnounce(first.next, [another]).next.announced).toEqual(["ready:PO-2"]);
  });
});
