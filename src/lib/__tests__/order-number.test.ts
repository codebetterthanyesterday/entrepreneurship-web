import { describe, expect, it } from "vitest";
import {
  ORDER_CODE_ALPHABET,
  PREORDER_NUMBER_PATTERN,
  isOrderNumber,
  newOrderNumber,
  normaliseOrderNumber,
  orderNumberIn,
  randomOrderCode,
} from "@/lib/order-number";

describe("new order numbers", () => {
  it("are the channel's prefix and six characters", () => {
    expect(newOrderNumber("PO")).toMatch(/^PO-[23456789BCDFGHJKMNPQRSTVWXYZ]{6}$/);
    expect(newOrderNumber("OS")).toMatch(/^OS-[23456789BCDFGHJKMNPQRSTVWXYZ]{6}$/);
  });

  it("never use a vowel or a character that reads as another", () => {
    expect(ORDER_CODE_ALPHABET).not.toMatch(/[AEIOU01L]/);
    for (let i = 0; i < 200; i++) expect(randomOrderCode()).not.toMatch(/[AEIOU01L]/);
  });

  it("do not repeat across a day's worth of orders", () => {
    const numbers = new Set(Array.from({ length: 2000 }, () => newOrderNumber("PO")));
    expect(numbers.size).toBe(2000);
  });

  it("draw every character equally often, skipping the bytes that would favour some", () => {
    // 252 is the first byte past the largest multiple of 28; it must be skipped.
    const bytes = [252, 253, 254, 255, 0, 1, 2, 3, 4, 27];
    const random = (target: Uint8Array) => {
      target.fill(0);
      target.set(bytes.slice(0, target.length));
      return target;
    };
    expect(randomOrderCode(random)).toBe("23456Z");
  });
});

describe("isOrderNumber", () => {
  it("takes the random numbers, and the sequential ones handed out before", () => {
    for (const number of ["PO-7KX4QM", "OS-B4N8TZ", "PO-0015", "OS-12345"]) {
      expect(isOrderNumber(number)).toBe(true);
    }
  });

  it("refuses anything else", () => {
    for (const number of ["PO-7KX4QA", "po-7kx4qm", "PO-7KX4Q", "XX-7KX4QM", "PO-012", ""]) {
      expect(isOrderNumber(number)).toBe(false);
    }
  });

  it("gives the photobooth preorders only", () => {
    expect(PREORDER_NUMBER_PATTERN.test("PO-7KX4QM")).toBe(true);
    expect(PREORDER_NUMBER_PATTERN.test("OS-7KX4QM")).toBe(false);
  });
});

describe("normaliseOrderNumber", () => {
  it("reads a number however it was typed", () => {
    expect(normaliseOrderNumber(" po-7kx4qm ")).toBe("PO-7KX4QM");
    expect(normaliseOrderNumber("PO7KX4QM")).toBe("PO-7KX4QM");
    expect(normaliseOrderNumber("po 7kx 4qm")).toBe("PO-7KX4QM");
    expect(normaliseOrderNumber("po-0015")).toBe("PO-0015");
  });

  it("leaves something that is not a number alone, so the lookup just misses", () => {
    expect(normaliseOrderNumber("halo")).toBe("HALO");
  });
});

describe("orderNumberIn — what the cashier's scanner reads", () => {
  it.each([
    ["PO-7KX4QM", "PO-7KX4QM"],
    ["  po-7kx4qm ", "PO-7KX4QM"],
    ["PO-0015", "PO-0015"],
    ["https://bunnye-photobooth.vercel.app/foto?kode=PO-7KX4QM&t=EPQFw-wP0i428E1A", "PO-7KX4QM"],
    ["https://bunnye-photobooth.vercel.app/foto/PO-7KX4QM", "PO-7KX4QM"],
    ["https://bunnye.vercel.app/pesanan/PO-7KX4QM", "PO-7KX4QM"],
    ["https://bunnye.vercel.app/lacak?no=po-0015", "PO-0015"],
  ])("finds the number in %j", (text, number) => {
    expect(orderNumberIn(text)).toBe(number);
  });

  it.each([
    // A QRIS payload: the code a customer might hold up by mistake.
    ["00020101021126570011ID.DANA.WWW011893600915300000000002096000000000051440014ID.CO.QRIS.WWW"],
    ["https://example.com/"],
    ["PO-7KX4QMB"],
    ["halo"],
  ])("finds nothing in %j", (text) => {
    expect(orderNumberIn(text)).toBeNull();
  });
});
