import * as React from "react";
import { cn, formatRupiah } from "@/lib/utils";
import type { ChannelBreakdown, SalesSummary } from "@/lib/queries/report.query";

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  /** The takings card is the one an admin looks for first, so it is lifted. */
  highlight?: boolean;
  /** A second line under `sub`, e.g. revenue that is reported separately. */
  extra?: string;
}

function StatCard({ label, value, sub, highlight, extra }: StatCardProps) {
  return (
    <div className={cn("s-stat desktop:p-4", highlight && "s-stat-hero")}>
      <div className="s-eyebrow">{label}</div>
      <div className="s-stat-value tabular-nums">{value}</div>
      <div className="s-stat-sub">{sub}</div>
      {extra && <div className="mt-1 text-[11.5px] font-bold text-sky">{extra}</div>}
    </div>
  );
}

export interface DashboardStatsProps {
  summary: SalesSummary;
  channels: ChannelBreakdown;
}

/** The four headline numbers: two columns on a phone, four on a desktop. */
export function DashboardStats({ summary, channels }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-2 tablet:grid-cols-4 gap-3">
      <StatCard
        highlight
        label="Uang masuk"
        value={formatRupiah(summary.totalRevenue)}
        sub={
          summary.orderCount === 0
            ? "belum ada transaksi"
            : `rata-rata ${formatRupiah(summary.averageOrderValue)} per pesanan`
        }
      />

      <StatCard
        label="Pesanan"
        value={String(summary.orderCount)}
        sub={`${channels.preorder.orderCount} preorder · ${channels.onsite.orderCount} di tempat`}
      />

      <StatCard
        label="Porsi terjual"
        value={String(summary.portionCount)}
        sub={`dari ${summary.activeProductCount} menu aktif`}
      />

      <StatCard
        label="Sisa stok"
        value={String(summary.remainingStock)}
        sub={
          summary.lowStockCount === 0
            ? "stok semua menu aman"
            : `${summary.lowStockCount} menu hampir habis`
        }
      />
    </div>
  );
}
