import * as React from "react";
import { formatRupiah } from "@/lib/utils";

export interface MenuListProduct {
  id: string;
  name: string;
  price: number;
  categoryName: string | null;
}

/**
 * The menu as a printed menu — name, dotted leader, price.
 *
 * Borrowed from food-bar's `menu.html`, and it earns its place for a reason the
 * template never had: this is the one view of the range that reads well in a
 * screenshot or on paper, which is exactly what gets forwarded to a class group
 * before the event. It deliberately has no buttons; ordering lives at /menu,
 * where stock and the cart are.
 *
 * Grouped by category in the categories' own order, with uncategorised items
 * last, and it is derived from the products table rather than from the CMS — one
 * menu to keep up to date, not two. It shows every active product at its price
 * regardless of stock: stock runs out and comes back over the course of an
 * event, but this list is the standing menu, not a live snapshot of what's left
 * — that's what /menu is for.
 */
export function ProfileMenuList({ products }: { products: readonly MenuListProduct[] }) {
  const groups = groupByCategory(products);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Menunya belum diisi. Tambahkan di Panel &rarr; Menu.
      </p>
    );
  }

  return (
    <div className="grid gap-x-14 gap-y-10 desktop:grid-cols-2">
      {groups.map((group) => (
        <div key={group.name}>
          <h3 className="eyebrow text-pink-deep">{group.name}</h3>

          <ul className="mt-4 flex flex-col">
            {group.items.map((item) => (
              <li
                key={item.id}
                className="flex items-baseline gap-3 border-t border-line py-3.5 last:border-b"
              >
                <span className="text-[15.5px] font-medium text-ink">{item.name}</span>

                {/* The leader. Decorative, so it is hidden from a screen reader,
                    which reads the name and the price as one line anyway. */}
                <span
                  aria-hidden="true"
                  className="flex-1 border-b border-dotted border-line/90 translate-y-[-4px] min-w-[1.5rem]"
                />

                <span className="text-[15px] font-semibold text-ink tabular-nums flex-none">
                  {formatRupiah(item.price)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function groupByCategory(products: readonly MenuListProduct[]) {
  const groups: { name: string; items: MenuListProduct[] }[] = [];

  for (const product of products) {
    // "Lainnya" rather than a blank heading for products with no category.
    const name = product.categoryName ?? "Lainnya";
    const group = groups.find((candidate) => candidate.name === name);

    if (group) group.items.push(product);
    else groups.push({ name, items: [product] });
  }

  // Uncategorised last, however the products happened to come back ordered.
  return groups.sort((a, b) => Number(a.name === "Lainnya") - Number(b.name === "Lainnya"));
}
