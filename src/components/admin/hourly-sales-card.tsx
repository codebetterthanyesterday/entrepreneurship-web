import * as React from "react";
import { cn, formatRupiah } from "@/lib/utils";
import type { HourlySales } from "@/lib/queries/report.query";
import { DashboardCard } from "./dashboard-card";

/** "09.00" — the same way pickup slots are written everywhere else. */
function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}.00`;
}

/**
 * Fills the hours between the first and the last one that saw a transaction.
 *
 * The query only returns hours that had something happen, which is right for a
 * list but wrong for a chart: a quiet 11:00 between a busy 10:00 and 12:00
 * would vanish and leave the two busy hours drawn side by side, as if trade had
 * never dipped. Only the interior is filled — padding the ends would invent
 * hours the booth was not even open.
 */
function withQuietHours(rows: readonly HourlySales[]): HourlySales[] {
  if (rows.length === 0) return [];

  const byHour = new Map(rows.map((row) => [row.hour, row]));
  const hours = rows.map((row) => row.hour);
  const filled: HourlySales[] = [];

  for (let hour = Math.min(...hours); hour <= Math.max(...hours); hour += 1) {
    filled.push(byHour.get(hour) ?? { hour, revenue: 0, orderCount: 0 });
  }

  return filled;
}

/** At most six labels under the chart, evenly spaced. */
const MAX_HOUR_LABELS = 6;

export interface HourlySalesCardProps {
  hours: readonly HourlySales[];
}

/**
 * Sales per hour as plain divs with a percentage height — no chart library.
 * The shape of four or five bars does not justify shipping one, and this page
 * is opened on a phone over event WiFi.
 */
export function HourlySalesCard({ hours }: HourlySalesCardProps) {
  const rows = withQuietHours(hours);
  const peak = rows.reduce((max, row) => Math.max(max, row.revenue), 0);

  // A single late sale can stretch the axis across half a day, and eleven
  // "13.00"-sized labels do not fit across a phone. Thinning them evenly keeps
  // the axis honest — every hour still gets its own bar — while leaving the
  // labels legible. The reading for a bar whose label is hidden is still in its
  // tooltip and its accessible name.
  const labelStep = Math.ceil(rows.length / MAX_HOUR_LABELS);

  return (
    <DashboardCard title="Ramainya jam berapa?">
      {rows.length === 0 ? (
        <p className="text-sm font-medium text-ink-soft">
          Belum ada pesanan masuk hari ini. Grafiknya muncul begitu transaksi pertama jalan.
        </p>
      ) : (
        <ul className="flex items-end gap-[7px] h-[132px] desktop:h-[172px] pt-2">
          {rows.map((row, index) => {
            // A quiet hour still shows as a sliver rather than nothing, so the
            // gap in trade is visible instead of just being empty space.
            const height = peak === 0 ? 0 : Math.round((row.revenue / peak) * 100);
            const isPeak = peak > 0 && row.revenue === peak;

            return (
              <li
                key={row.hour}
                className="flex-1 flex flex-col justify-end items-center gap-1.5 h-full"
                title={`${formatHour(row.hour)} — ${formatRupiah(row.revenue)} dari ${row.orderCount} pesanan`}
                aria-label={`${formatHour(row.hour)}, ${formatRupiah(row.revenue)} dari ${row.orderCount} pesanan`}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-full block rounded-t-[7px] rounded-b-[3px] min-h-[3px]",
                    isPeak ? "bg-pink" : "bg-pink-soft",
                  )}
                  style={{ height: `${height}%` }}
                />
                <span aria-hidden="true" className="text-[10.5px] font-bold text-ink-soft">
                  {index % labelStep === 0 ? formatHour(row.hour) : " "}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}
