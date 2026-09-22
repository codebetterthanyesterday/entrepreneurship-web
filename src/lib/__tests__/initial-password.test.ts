import { describe, expect, it } from "vitest";
import { initialPasswordFor } from "@/lib/initial-password";

/**
 * `prisma/accounts.ts` hashes this to create an account and
 * `account.service.ts` compares against it to refuse a "change" back to it. The
 * two only stay in agreement because they call the same function, and these cases
 * pin down what it does to a name that is not one plain word.
 */
describe("initialPasswordFor", () => {
  it("is the name in lower case with 123 after it", () => {
    expect(initialPasswordFor("Fathin")).toBe("fathin123");
    expect(initialPasswordFor("Nabilah")).toBe("nabilah123");
  });

  it("drops spaces, so a two-word name still gives something typable", () => {
    expect(initialPasswordFor("Tim Dapur")).toBe("timdapur123");
  });

  it("strips accents rather than leaving them on a phone keyboard", () => {
    expect(initialPasswordFor("Zoë")).toBe("zoe123");
  });

  it("drops punctuation", () => {
    expect(initialPasswordFor("A'la Syifa")).toBe("alasyifa123");
  });
});
