import { describe, expect, it } from "vitest";
import { channelInsight } from "@/lib/channel-insight";
import type { ChannelBreakdown } from "@/lib/queries/report.query";

function split(preorderRevenue: number, onsiteRevenue: number): ChannelBreakdown {
  const total = preorderRevenue + onsiteRevenue;

  return {
    preorder: { revenue: preorderRevenue, orderCount: 1 },
    onsite: { revenue: onsiteRevenue, orderCount: 1 },
    preorderPercentage: total === 0 ? 0 : Math.round((preorderRevenue / total) * 100),
  };
}

describe("channelInsight", () => {
  it("credits the pre-event promotion when preorder leads", () => {
    expect(channelInsight(split(75_000, 25_000))).toBe(
      "75% pemasukan datang dari preorder. Promosi sebelum hari-H kelihatan membuahkan hasil.",
    );
  });

  it("credits the booth when walk-ups lead", () => {
    expect(channelInsight(split(20_000, 80_000))).toBe(
      "80% pemasukan datang dari pembeli yang lewat booth. " +
        "Posisi booth dan display produk berperan besar.",
    );
  });

  it("reads a dead heat as preorder's, the way the bar draws it", () => {
    expect(channelInsight(split(50_000, 50_000))).toContain("50% pemasukan datang dari preorder");
  });

  it("quotes the same number the bar is drawn from, never a re-rounded one", () => {
    // 2 : 1 — a third that does not divide evenly, so a second rounding of the
    // raw ratio could easily land a point away from the bar's width.
    const channels = split(20_000, 10_000);

    expect(channels.preorderPercentage).toBe(67);
    expect(channelInsight(channels)).toContain("67%");
  });

  it("never names a figure the other half of the bar contradicts", () => {
    // The booth sentence quotes 100 - preorderPercentage, which is exactly the
    // width of the sky half. Anything else would have the report disagreeing
    // with the picture above it.
    const channels = split(10_000, 20_000);

    expect(channels.preorderPercentage).toBe(33);
    expect(channelInsight(channels)).toContain("67% pemasukan datang dari pembeli yang lewat booth");
  });

  it("says so plainly when no money has come in yet", () => {
    expect(channelInsight(split(0, 0))).toBe(
      "Belum ada pemasukan yang tercatat, jadi belum kelihatan kanal mana yang lebih kuat.",
    );
  });

  it("does not call it a preorder win just because nothing is paid for", () => {
    // Both channels have orders but neither has been paid: the percentage is 0,
    // and the "0% from preorder" sentence would be nonsense.
    const channels: ChannelBreakdown = {
      preorder: { revenue: 0, orderCount: 4 },
      onsite: { revenue: 0, orderCount: 2 },
      preorderPercentage: 0,
    };

    expect(channelInsight(channels)).toContain("Belum ada pemasukan");
  });
});
