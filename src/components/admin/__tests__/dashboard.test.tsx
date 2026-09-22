// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChannelSplitCard } from "@/components/admin/channel-split-card";
import { DashboardStats } from "@/components/admin/dashboard-stats";
import { HourlySalesCard } from "@/components/admin/hourly-sales-card";
import { LowStockAlert } from "@/components/admin/low-stock-alert";
import { PipelineCard } from "@/components/admin/pipeline-card";
import { TopProductsCard } from "@/components/admin/top-products-card";
import type {
  ChannelBreakdown,
  OrderPipeline,
  SalesSummary,
  TopProduct,
} from "@/lib/queries/report.query";

afterEach(cleanup);

function summary(overrides: Partial<SalesSummary> = {}): SalesSummary {
  return {
    totalRevenue: 450_000,
    orderCount: 18,
    portionCount: 42,
    remainingStock: 76,
    activeProductCount: 9,
    averageOrderValue: 25_000,
    lowStockCount: 2,
    ...overrides,
  };
}

function channels(overrides: Partial<ChannelBreakdown> = {}): ChannelBreakdown {
  return {
    preorder: { revenue: 300_000, orderCount: 11 },
    onsite: { revenue: 150_000, orderCount: 7 },
    preorderPercentage: 67,
    ...overrides,
  };
}

const pipeline: OrderPipeline = {
  CONFIRMED: 3,
  IN_QUEUE: 9,
  IN_PROGRESS: 1,
  READY: 0,
  DONE: 5,
};

describe("DashboardStats", () => {
  it("shows the four headline figures with their subtexts", () => {
    render(<DashboardStats summary={summary()} channels={channels()} />);

    expect(screen.getByText("18")).toBeDefined();
    expect(screen.getByText("42")).toBeDefined();
    expect(screen.getByText("76")).toBeDefined();
    expect(screen.getByText("11 preorder · 7 di tempat")).toBeDefined();
    expect(screen.getByText("dari 9 menu aktif")).toBeDefined();
    expect(screen.getByText("2 menu hampir habis")).toBeDefined();
  });

  it("states an average that divides the two figures shown beside it", () => {
    // The card's subtext gets read against the cards next to it, so it has to
    // be the quotient of those and not of some other population.
    render(<DashboardStats summary={summary()} channels={channels()} />);

    const average = screen.getByText(/rata-rata/);
    expect(average.textContent).toContain("25.000");
    expect(450_000 / 18).toBe(25_000);
  });

  it("says nothing has happened rather than dividing by zero", () => {
    render(
      <DashboardStats
        summary={summary({ totalRevenue: 0, orderCount: 0, averageOrderValue: 0 })}
        channels={channels({
          preorder: { revenue: 0, orderCount: 0 },
          onsite: { revenue: 0, orderCount: 0 },
          preorderPercentage: 0,
        })}
      />,
    );

    expect(screen.getByText("belum ada transaksi")).toBeDefined();
    expect(screen.queryByText(/rata-rata/)).toBeNull();
  });

  it("does not report zero menus as a shortage", () => {
    render(<DashboardStats summary={summary({ lowStockCount: 0 })} channels={channels()} />);

    expect(screen.getByText("stok semua menu aman")).toBeDefined();
    expect(screen.queryByText(/hampir habis/)).toBeNull();
  });
});

describe("LowStockAlert", () => {
  it("names each menu and how much is left, calling zero 'habis'", () => {
    render(
      <LowStockAlert
        items={[
          { id: "a", name: "Cimol", stock: 0 },
          { id: "b", name: "Risoles", stock: 2 },
        ]}
      />,
    );

    expect(screen.getByText("2 menu perlu diisi ulang")).toBeDefined();
    expect(screen.getByText("habis")).toBeDefined();
    expect(screen.getByText("sisa 2")).toBeDefined();
  });

  it("stays out of the way when everything is stocked", () => {
    const { container } = render(<LowStockAlert items={[]} />);

    expect(container.firstChild).toBeNull();
  });
});

describe("ChannelSplitCard", () => {
  it("draws two halves that fill the bar exactly and match the sentence", () => {
    const { container } = render(<ChannelSplitCard channels={channels()} />);

    const widths = [...container.querySelectorAll("i")].map((bar) =>
      Number.parseFloat((bar as HTMLElement).style.width),
    );

    expect(widths).toEqual([67, 33]);
    expect(widths[0]! + widths[1]!).toBe(100);
    expect(screen.getByText(/67% pemasukan datang dari preorder/)).toBeDefined();
  });

  it("shows each channel's nominal beside its colour", () => {
    render(<ChannelSplitCard channels={channels()} />);

    expect(screen.getByText(/300\.000/)).toBeDefined();
    expect(screen.getByText(/150\.000/)).toBeDefined();
  });

  it("draws no bar at all before any money comes in", () => {
    const { container } = render(
      <ChannelSplitCard
        channels={channels({
          preorder: { revenue: 0, orderCount: 2 },
          onsite: { revenue: 0, orderCount: 1 },
          preorderPercentage: 0,
        })}
      />,
    );

    expect(container.querySelectorAll("i")).toHaveLength(0);
    expect(screen.getByText(/Belum ada pemasukan/)).toBeDefined();
  });
});

describe("HourlySalesCard", () => {
  it("scales every bar against the busiest hour and highlights it", () => {
    const { container } = render(
      <HourlySalesCard
        hours={[
          { hour: 9, revenue: 50_000, orderCount: 2 },
          { hour: 10, revenue: 100_000, orderCount: 5 },
        ]}
      />,
    );

    const bars = [...container.querySelectorAll("li > span:first-child")] as HTMLElement[];

    expect(bars.map((bar) => bar.style.height)).toEqual(["50%", "100%"]);
    // The peak hour is the only one drawn in the solid colour.
    expect(bars.map((bar) => bar.classList.contains("bg-pink"))).toEqual([false, true]);
    expect(bars.map((bar) => bar.classList.contains("bg-pink-soft"))).toEqual([true, false]);
  });

  it("keeps a quiet hour in the middle of the day visible as a gap", () => {
    // 10:00 saw nothing. Dropping it would draw 09:00 and 11:00 side by side
    // and hide the dip entirely.
    render(
      <HourlySalesCard
        hours={[
          { hour: 9, revenue: 50_000, orderCount: 2 },
          { hour: 11, revenue: 80_000, orderCount: 3 },
        ]}
      />,
    );

    expect(screen.getByText("09.00")).toBeDefined();
    expect(screen.getByText("10.00")).toBeDefined();
    expect(screen.getByText("11.00")).toBeDefined();
  });

  it("does not invent hours before or after trading", () => {
    render(<HourlySalesCard hours={[{ hour: 9, revenue: 50_000, orderCount: 2 }]} />);

    expect(screen.getByText("09.00")).toBeDefined();
    expect(screen.queryByText("08.00")).toBeNull();
    expect(screen.queryByText("10.00")).toBeNull();
  });

  it("thins the labels when one late sale stretches the axis", () => {
    // 13:00 busy, then nothing until a single order at 23:00. Eleven "13.00"
    // labels do not fit across a phone, so only every other one is drawn —
    // but every hour keeps its own bar, and its own accessible reading.
    const { container } = render(
      <HourlySalesCard
        hours={[
          { hour: 13, revenue: 306_000, orderCount: 4 },
          { hour: 23, revenue: 0, orderCount: 1 },
        ]}
      />,
    );

    expect(container.querySelectorAll("li")).toHaveLength(11);
    expect(screen.getAllByText(/^\d\d\.00$/)).toHaveLength(6);

    // The hour whose label is hidden is still named for a screen reader.
    expect(screen.getByLabelText(/^14\.00,/)).toBeDefined();
    expect(screen.queryByText("14.00")).toBeNull();
  });

  it("explains itself instead of drawing an empty frame", () => {
    render(<HourlySalesCard hours={[]} />);

    expect(screen.getByText(/Belum ada pesanan masuk/)).toBeDefined();
  });
});

describe("TopProductsCard", () => {
  const products: TopProduct[] = [
    { productId: "a", name: "Cimol", imageUrl: null, quantitySold: 20, revenue: 100_000 },
    { productId: "b", name: "Risoles", imageUrl: null, quantitySold: 5, revenue: 40_000 },
  ];

  it("scales each bar against the leader", () => {
    const { container } = render(<TopProductsCard products={products} />);

    const bars = [...container.querySelectorAll("li span span span")] as HTMLElement[];

    expect(bars.map((bar) => bar.style.width)).toEqual(["100%", "25%"]);
  });

  it("falls back to an initial when a menu has no photo", () => {
    render(<TopProductsCard products={products} />);

    const first = screen.getByText("Cimol").closest("li")!;
    expect(within(first).getByText("C")).toBeDefined();
  });

  it("says so when nothing has sold yet", () => {
    render(<TopProductsCard products={[]} />);

    expect(screen.getByText(/Belum ada yang terjual/)).toBeDefined();
  });
});

describe("PipelineCard", () => {
  it("lists every stage, including the empty ones", () => {
    render(<PipelineCard pipeline={pipeline} />);

    for (const label of [
      "Belum diambil",
      "Antrian dapur",
      "Lagi diracik",
      "Siap diserahkan",
      "Selesai",
    ]) {
      expect(screen.getByText(label)).toBeDefined();
    }

    expect(screen.getByText("0")).toBeDefined();
  });

  it("makes a stalled queue the longest bar", () => {
    const { container } = render(<PipelineCard pipeline={pipeline} />);

    const bars = [...container.querySelectorAll("span[aria-hidden]")] as HTMLElement[];

    // Nine orders banked up in the kitchen queue against a busiest-of-nine.
    expect(bars.map((bar) => bar.style.width)).toEqual([
      `${(3 / 9) * 100}%`,
      "100%",
      `${(1 / 9) * 100}%`,
      "0%",
      `${(5 / 9) * 100}%`,
    ]);
  });
});
