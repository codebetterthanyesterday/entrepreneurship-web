import * as React from "react";

export interface DashboardCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

/** A titled panel. Every block on the dashboard below the stat cards is one. */
export function DashboardCard({ title, children, className }: DashboardCardProps) {
  return (
    <section className={className}>
      <h2 className="font-[family-name:var(--font-display)] text-[17px] desktop:text-[19px] font-semibold text-ink mb-2.5">
        {title}
      </h2>
      <div className="bg-white border-[1.5px] border-line rounded-[18px] p-4">{children}</div>
    </section>
  );
}
