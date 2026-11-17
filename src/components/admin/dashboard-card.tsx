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
      <h2 className="s-h2 mb-3">{title}</h2>
      <div className="s-card">{children}</div>
    </section>
  );
}
