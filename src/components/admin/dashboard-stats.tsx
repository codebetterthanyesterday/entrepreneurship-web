import * as React from "react";
import { cn, formatRupiah } from "@/lib/utils";
import type { ChannelBreakdown, SalesSummary } from "@/lib/queries/report.query";

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  /** The takings card is the one an admin looks for first, so it is lifted. */
  highlight?: boolean;
}

function StatCard({ label, value, sub, highlight }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-[16px] border-[1.5px] p-3.5 desktop:p-[18px]",
        highlight ? "bg-pink-soft border-pink" : "bg-white border-line",
      )}
    >
      <div className="text-xs font-semibold text-ink-soft">{label}</div>
      <div
        className={cn(
          "font-[family-name:var(--font-display)] text-[23px] desktop:text-[27px] leading-tight tabular-nums",
          highlight ? "text-pink-deep" : "text-ink",
        )}
      >
        {value}
      </div>
      <div className="text-[11.5px] font-semibold text-ink-soft">{sub}</div>
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
    <div className="grid grid-cols-2 desktop:grid-cols-4 gap-2.5">
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
