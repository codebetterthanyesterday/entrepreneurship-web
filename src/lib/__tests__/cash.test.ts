import { describe, expect, it } from "vitest";
import { parseCashInput, quickCashOptions } from "@/lib/cash";

const amounts = (total: number) => quickCashOptions(total).map((option) => option.amount);

describe("quickCashOptions", () => {
  it("offers exact, next 5.000, 50.000 and 100.000", () => {
    expect(amounts(23_000)).toEqual([23_000, 25_000, 50_000, 100_000]);
    expect(quickCashOptions(23_000)[0]!.label).toBe("Uang pas");
  });

  it("drops the rounded amount when the total is already a multiple of 5.000", () => {
    expect(amounts(25_000)).toEqual([25_000, 50_000, 100_000]);
  });

  it("drops duplicates where the rounding lands on 50.000", () => {
    expect(amounts(47_000)).toEqual([47_000, 50_000, 100_000]);
  });

  it("drops amounts below the total", () => {
    expect(amounts(73_000)).toEqual([73_000, 75_000, 100_000]);
    expect(amounts(120_000)).toEqual([120_000]);
  });

  it("offers nothing for an empty bill", () => {
    expect(amounts(0)).toEqual([]);
  });
});

describe("parseCashInput", () => {
  it("ignores thousands separators", () => {
    expect(parseCashInput("50.000")).toBe(50_000);
    expect(parseCashInput("Rp 7.500")).toBe(7_500);
  });

  it("reads an empty field as nothing entered", () => {
    expect(parseCashInput("")).toBeNull();
  });
});
