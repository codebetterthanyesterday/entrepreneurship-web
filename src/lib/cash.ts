export interface QuickCashOption {
  label: string;
  amount: number;
}

const ROUND_TO = 5_000;

/**
 * The one-tap amounts on the cash screen: exact change, the next 5.000 above
 * the total, 50.000 and 100.000. Anything below the total cannot pay for it, so
 * it is dropped, and an amount that two rules land on shows only once — the
 * first rule to produce it keeps its label.
 */
export function quickCashOptions(total: number): QuickCashOption[] {
  if (total <= 0) return [];

  const roundedUp = Math.ceil(total / ROUND_TO) * ROUND_TO;

  const candidates: QuickCashOption[] = [
    { label: "Uang pas", amount: total },
    ...[roundedUp, 50_000, 100_000].map((amount) => ({ label: formatThousands(amount), amount })),
  ];

  const seen = new Set<number>();

  return candidates.filter((option) => {
    if (option.amount < total || seen.has(option.amount)) return false;
    seen.add(option.amount);
    return true;
  });
}

/** 25000 → "25.000" */
export function formatThousands(amount: number): string {
  return amount.toLocaleString("id-ID");
}

/** Reads what the cashier typed, ignoring the thousands dots. Empty → null. */
export function parseCashInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  return digits === "" ? null : Number(digits);
}
