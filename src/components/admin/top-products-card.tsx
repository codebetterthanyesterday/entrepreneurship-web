import * as React from "react";
import type { TopProduct } from "@/lib/queries/report.query";
import { DashboardCard } from "./dashboard-card";

export interface TopProductsCardProps {
  products: readonly TopProduct[];
}

/**
 * The best sellers, each with a bar drawn against the leader rather than
 * against a fixed scale — the question the card answers is "how far ahead is
 * the top one", so the leader is always a full bar.
 */
export function TopProductsCard({ products }: TopProductsCardProps) {
  const leader = products[0]?.quantitySold ?? 0;

  return (
    <DashboardCard title="Lagi laris">
      {products.length === 0 ? (
        <p className="text-sm font-medium text-ink-soft">
          Belum ada yang terjual. Peringkatnya nyusul begitu pesanan pertama masuk.
        </p>
      ) : (
        <ol>
          {products.map((product) => (
            <li
              key={product.productId}
              className="flex items-center gap-[11px] py-2.5 border-b border-dashed border-line last:border-b-0"
            >
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrl}
                  alt=""
                  className="w-[38px] h-[38px] rounded-xl object-cover flex-none"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="w-[38px] h-[38px] rounded-xl bg-pink-soft text-pink-deep flex items-center justify-center text-lg font-semibold flex-none"
                >
                  {product.name.charAt(0).toUpperCase()}
                </span>
              )}

              <span className="flex-1 min-w-0">
                <span className="block font-bold text-[13.5px] text-ink truncate">
                  {product.name}
                </span>
                <span className="block h-1.5 rounded-full bg-cream mt-[5px] overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-pink"
                    style={{ width: `${leader === 0 ? 0 : (product.quantitySold / leader) * 100}%` }}
                  />
                </span>
              </span>

              <span className="font-[family-name:var(--font-display)] text-[15px] text-ink flex-none tabular-nums">
                {product.quantitySold}
                <span className="sr-only"> porsi</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </DashboardCard>
  );
}
