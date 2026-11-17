import * as React from "react";
import { formatRupiah } from "@/lib/utils";
import { channelInsight } from "@/lib/channel-insight";
import type { ChannelBreakdown } from "@/lib/queries/report.query";
import { DashboardCard } from "./dashboard-card";

export interface ChannelSplitCardProps {
  channels: ChannelBreakdown;
}

/**
 * Where the money came from: one bar split in two, the nominal for each side,
 * and a sentence saying what the split means.
 *
 * The two halves are `preorderPercentage` and its complement, so they always
 * fill the bar exactly and always match the sentence below them.
 */
export function ChannelSplitCard({ channels }: ChannelSplitCardProps) {
  const { preorder, onsite, preorderPercentage } = channels;
  const totalRevenue = preorder.revenue + onsite.revenue;
  const onsitePercentage = 100 - preorderPercentage;

  return (
    <DashboardCard title="Dari mana pesanannya datang?">
      <div
        className="flex h-4 overflow-hidden bg-line border-2 border-ink-deep my-2.5"
        role="img"
        aria-label={
          totalRevenue === 0
            ? "Belum ada pemasukan"
            : `Preorder ${preorderPercentage} persen, beli di tempat ${onsitePercentage} persen`
        }
      >
        {totalRevenue > 0 && (
          <>
            <i className="block h-full bg-[var(--s-sky-deep)]" style={{ width: `${preorderPercentage}%` }} />
            <i className="block h-full bg-[var(--k-gold)]" style={{ width: `${onsitePercentage}%` }} />
          </>
        )}
      </div>

      <dl className="flex gap-x-4 gap-y-1.5 flex-wrap text-[13px] font-semibold text-ink-soft">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="w-[11px] h-[11px] border-2 border-ink-deep bg-[var(--s-sky-deep)] flex-none" />
          <dd className="font-bold text-ink tabular-nums">{formatRupiah(preorder.revenue)}</dd>
          <dt>preorder</dt>
        </div>

        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="w-[11px] h-[11px] border-2 border-ink-deep bg-[var(--k-gold)] flex-none" />
          <dd className="font-bold text-ink tabular-nums">{formatRupiah(onsite.revenue)}</dd>
          <dt>beli di tempat</dt>
        </div>
      </dl>

      <p className="text-[13px] text-ink-soft mt-3">{channelInsight(channels)}</p>
    </DashboardCard>
  );
}
