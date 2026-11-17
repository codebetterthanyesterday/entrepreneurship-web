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
              className="flex items-center gap-3 py-2.5 border-b-2 border-dashed border-line last:border-b-0"
            >
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrl}
                  alt=""
                  className="w-[40px] h-[40px] rounded-[10px] object-cover flex-none"
                />
              ) : (
                <span aria-hidden="true" className="s-thumb w-[40px] h-[40px] text-[17px]">
                  <span>{product.name.charAt(0).toUpperCase()}</span>
                </span>
              )}

              <span className="flex-1 min-w-0">
                <span className="block font-extrabold text-[14px] text-ink truncate">
                  {product.name}
                </span>
                <span className="s-meter mt-1.5">
                  <span
                    className="bg-pink-deep"
                    style={{ width: `${leader === 0 ? 0 : (product.quantitySold / leader) * 100}%` }}
                  />
                </span>
              </span>

              <span className="font-[family-name:var(--font-display)] text-[19px] font-black text-ink flex-none tabular-nums">
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
