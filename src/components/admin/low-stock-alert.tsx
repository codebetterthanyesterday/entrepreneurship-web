import * as React from "react";

export interface LowStockItem {
  id: string;
  name: string;
  stock: number;
}

export interface LowStockAlertProps {
  items: readonly LowStockItem[];
}

/**
 * The menus that need refilling, named and counted.
 *
 * It sits directly under the stat cards rather than further down the page
 * because of when it gets read: mid-event, with a queue at the booth. An admin
 * should not have to open the menu screen and scan rows to find out that the
 * cimol ran out ten minutes ago.
 *
 * Renders nothing at all when everything is stocked — an "all good" panel would
 * take up the same space every time the page refreshed without ever being the
 * thing anyone came to read.
 */
export function LowStockAlert({ items }: LowStockAlertProps) {
  if (items.length === 0) return null;

  return (
    <div className="bg-hot-soft border-[1.5px] border-hot/25 rounded-[16px] p-3.5">
      <h3 className="font-[family-name:var(--font-display)] text-[14.5px] font-semibold text-hot mb-1.5">
        {items.length} menu perlu diisi ulang
      </h3>

      <ul>
        {items.map((item) => (
          <li
            key={item.id}
            className="flex justify-between gap-3 text-[13px] font-semibold text-hot py-[3px]"
          >
            <span className="truncate">{item.name}</span>
            <span className="flex-none tabular-nums">
              {item.stock === 0 ? "habis" : `sisa ${item.stock}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
