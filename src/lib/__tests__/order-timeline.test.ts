import { describe, expect, it } from "vitest";
import { buildTimeline, isFinalStatus } from "@/lib/order-timeline";

const titles = (status: Parameters<typeof buildTimeline>[0], needsPrep: boolean) =>
  buildTimeline(status, needsPrep).map((step) => step.title);

const states = (status: Parameters<typeof buildTimeline>[0], needsPrep: boolean) =>
  buildTimeline(status, needsPrep).map((step) => step.state);

describe("buildTimeline — which stages appear", () => {
  it("shows the prep stage for an order that has something to make", () => {
    expect(titles("IN_QUEUE", true)).toEqual([
      "Pesanan masuk",
      "Udah dikonfirmasi",
      "Lagi diracik",
      "Siap diambil!",
      "Selesai, makasih ya!",
    ]);
  });

  it("hides the prep stage when nothing has to be made", () => {
    expect(titles("CONFIRMED", false)).toEqual([
      "Pesanan masuk",
      "Udah dikonfirmasi",
      "Siap diambil!",
      "Selesai, makasih ya!",
    ]);
    expect(titles("CONFIRMED", false)).not.toContain("Lagi diracik");
  });

  it("renumbers the bullets after dropping the prep stage", () => {
    expect(buildTimeline("CONFIRMED", false).map((step) => step.position)).toEqual([1, 2, 3, 4]);
  });
});

describe("buildTimeline — where the order sits", () => {
  it("marks earlier stages done, the current one current, the rest pending", () => {
    expect(states("CONFIRMED", true)).toEqual([
      "done",
      "current",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("treats IN_QUEUE and IN_PROGRESS as the same customer-facing stage", () => {
    expect(states("IN_QUEUE", true)).toEqual(states("IN_PROGRESS", true));
    expect(buildTimeline("IN_PROGRESS", true)[2]!.state).toBe("current");
  });

  it("lands on Siap diambil when the order is READY", () => {
    const ready = buildTimeline("READY", true);
    expect(ready.find((step) => step.state === "current")!.title).toBe("Siap diambil!");
  });

  it("completes every earlier stage when the order is DONE", () => {
    expect(states("DONE", true)).toEqual(["done", "done", "done", "done", "current"]);
    expect(states("DONE", false)).toEqual(["done", "done", "done", "current"]);
  });

  it("leaves every stage pending for a cancelled order, which renders separately", () => {
    // No stage matches CANCELLED, so nothing is highlighted — the page shows a
    // cancellation notice instead of the timeline.
    expect(states("CANCELLED", true).every((state) => state === "pending")).toBe(true);
  });
});

describe("isFinalStatus", () => {
  it("is true only where the order can no longer move", () => {
    expect(isFinalStatus("DONE")).toBe(true);
    expect(isFinalStatus("CANCELLED")).toBe(true);

    for (const status of ["CONFIRMED", "IN_QUEUE", "IN_PROGRESS", "READY"] as const) {
      expect(isFinalStatus(status)).toBe(false);
    }
  });
});
