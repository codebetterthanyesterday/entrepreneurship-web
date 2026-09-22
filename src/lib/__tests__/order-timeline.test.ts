import { describe, expect, it } from "vitest";
import { buildTimeline, isFinalStatus, summariseStage } from "@/lib/order-timeline";

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

describe("summariseStage", () => {
  it("puts a fresh order at the start of the ring", () => {
    const stage = summariseStage("CONFIRMED", true);
    expect(stage.current?.id).toBe("confirmed");
    expect(stage.progress).toBeCloseTo(1 / 4);
  });

  it("fills the ring once the order is done", () => {
    expect(summariseStage("DONE", true).progress).toBe(1);
  });

  it("measures progress against the stages this order actually has", () => {
    // No prep stage: ready is the third of four, not the fourth of five.
    const stage = summariseStage("READY", false);
    expect(stage.steps).toHaveLength(4);
    expect(stage.progress).toBeCloseTo(2 / 3);
  });

  it("has no current stage for a cancelled order", () => {
    const stage = summariseStage("CANCELLED", true);
    expect(stage.current).toBeNull();
    expect(stage.progress).toBe(0);
  });
});
