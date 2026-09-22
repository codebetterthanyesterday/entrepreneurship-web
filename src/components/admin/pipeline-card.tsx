import * as React from "react";
import { PIPELINE_STATUSES, type OrderPipeline, type PipelineStatus } from "@/lib/queries/report.query";
import { DashboardCard } from "./dashboard-card";

/**
 * Stage names as staff say them, matching the kitchen board and the cashier's
 * pickup screen — the dashboard is the third screen showing the same orders,
 * and three vocabularies for one queue would be three things to learn.
 */
const STAGE_LABEL: Readonly<Record<PipelineStatus, string>> = {
  CONFIRMED: "Belum diambil",
  IN_QUEUE: "Antrian dapur",
  IN_PROGRESS: "Lagi diracik",
  READY: "Siap diserahkan",
  DONE: "Selesai",
};

export interface PipelineCardProps {
  pipeline: OrderPipeline;
}

/**
 * How many orders sit at each stage, with a bar scaled to the busiest one.
 *
 * Every stage is listed even at zero. A queue that is not moving shows up as
 * one long bar beside four short ones, and that comparison only works if the
 * empty stages are drawn too.
 */
export function PipelineCard({ pipeline }: PipelineCardProps) {
  const busiest = PIPELINE_STATUSES.reduce((max, status) => Math.max(max, pipeline[status]), 0);

  return (
    <DashboardCard title="Pesanan lagi di mana?">
      <dl className="flex flex-col gap-2.5">
        {PIPELINE_STATUSES.map((status) => (
          <div key={status} className="flex items-center gap-3">
            <dt className="text-[13px] font-semibold text-ink-soft w-[112px] flex-none">
              {STAGE_LABEL[status]}
            </dt>

            <span className="flex-1 h-2 rounded-full bg-cream overflow-hidden">
              <span
                aria-hidden="true"
                className="block h-full rounded-full bg-sky"
                style={{ width: `${busiest === 0 ? 0 : (pipeline[status] / busiest) * 100}%` }}
              />
            </span>

            <dd className="font-[family-name:var(--font-display)] text-[15px] text-ink flex-none tabular-nums w-6 text-right">
              {pipeline[status]}
            </dd>
          </div>
        ))}
      </dl>
    </DashboardCard>
  );
}
