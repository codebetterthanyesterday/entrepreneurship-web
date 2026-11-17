import { describe, expect, it } from "vitest";
import { deepen, flavorOf, isDrink } from "@/lib/flavor";

const drink = (name: string) => flavorOf({ name, categoryName: "Minuman" });
const food = (name: string) => flavorOf({ name, categoryName: "Makanan" });

describe("flavorOf: a layered drink is drawn from the bottom up", () => {
  it("sinks palm sugar, keeps milk in the middle and floats the coffee", () => {
    expect(drink("Es Kopi Susu Gula Aren").colors).toEqual(["#a8641f", "#f3e7d4", "#5b3a26"]);
  });

  it("puts butterfly pea over lemonade, the way the drink is poured", () => {
    expect(drink("Lemonade Butterfly Pea").colors).toEqual(["#f0cf3f", "#4f5bd5"]);
  });

  it("layers strawberry, milk and matcha in that order", () => {
    expect(drink("Strawberry Matcha Latte").colors).toEqual(["#e0566f", "#f3e7d4", "#7ea44e"]);
  });

  it("does not count the tea in Thai tea twice", () => {
    expect(drink("Thai Tea").colors).toEqual(["#d9762b"]);
  });

  it("still pours something for a drink it knows nothing about", () => {
    expect(drink("Es Spesial Bunnyè").colors).toHaveLength(2);
  });

  it("tints the tile after the colour on top", () => {
    expect(drink("Lemonade Butterfly Pea").tint).toBe("#e2e5fb");
    expect(drink("Es Kopi Susu Gula Aren").tint).toBe("#f2e3d0");
  });
});

describe("flavorOf: food takes its shape from the name", () => {
  it.each([
    ["Cookies Lumer Cokelat", "cookie"],
    ["Croffle Butter Sugar", "croffle"],
    ["Dubai Chocolate Bar", "bar"],
    ["Puding Susu Cup", "pudding"],
    ["Donat Gula", "donut"],
    ["Brownies Keju", "cake"],
    ["Roti Bakar", "bun"],
  ])("draws %s as a %s", (name, shape) => {
    expect(food(name).shape).toBe(shape);
  });

  it("sets chocolate into a cookie's dough and lets it melt when the name says lumer", () => {
    const cookie = food("Cookies Lumer Cokelat");
    expect(cookie.colors).toEqual(["#d9a25a", "#5a3322"]);
    expect(cookie.melting).toBe(true);
  });

  it("makes a chocolate bar of chocolate, with the pistachio inside", () => {
    expect(food("Dubai Chocolate Bar").colors).toEqual(["#5a3322", "#94b860"]);
  });

  it("dusts a croffle whose name says sugar", () => {
    expect(food("Croffle Butter Sugar").sugared).toBe(true);
  });

  it("tops a pudding with caramel", () => {
    expect(food("Puding Susu Cup").colors).toEqual(["#f3e7d4", "#b8742a"]);
  });

  it("is the same every time, so a product looks alike on every screen", () => {
    expect(food("Croffle Butter Sugar")).toEqual(food("Croffle Butter Sugar"));
  });
});

describe("isDrink", () => {
  it.each([
    ["Es Kopi Susu Gula Aren", null],
    ["Lemonade Butterfly Pea", null],
    ["Matcha Latte", null],
    ["Spesial Rumah", "Minuman"],
  ])("pours %s (%s) into a cup", (name, categoryName) => {
    expect(isDrink({ name, categoryName })).toBe(true);
  });

  it.each([
    ["Risoles Mayo", "Makanan"],
    ["Pisang Goreng", null],
    ["Donat Gula", null],
    // "es" only as a word, so a snack whose name merely contains it stays food.
    ["Pastel Keju", null],
  ])("keeps %s (%s) as food", (name, categoryName) => {
    expect(isDrink({ name, categoryName })).toBe(false);
  });

  it("knows a drink by its category or its name", () => {
    expect(isDrink({ name: "Es Kopi Susu", categoryName: "Spesial" })).toBe(true);
    expect(isDrink({ name: "Apa Saja", categoryName: "Minuman" })).toBe(true);
    expect(isDrink({ name: "Croffle Butter Sugar", categoryName: "Makanan" })).toBe(false);
    expect(isDrink({ name: "Puding Susu Cup", categoryName: "Makanan" })).toBe(false);
  });
});

describe("deepen", () => {
  it("mixes towards black", () => {
    expect(deepen("#ffffff", 0.5)).toBe("#808080");
  });
});
