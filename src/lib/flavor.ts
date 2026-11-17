/**
 * What a menu item looks like, worked out from its name.
 *
 * Most products have no photo, so the menu draws each one instead (see
 * `FlavorArt`). A generic cup or doughnut for everything made a menu of seven
 * different things look like seven copies of one, so the picture follows what
 * the name says is in it: "Es Kopi Susu Gula Aren" is a tall iced cup with palm
 * sugar at the bottom, milk in the middle and coffee floating on top; "Dubai
 * Chocolate Bar" is a bar with the pistachio filling showing where it is bitten.
 *
 * Pure and deterministic, so the same product is drawn the same way on the
 * menu, in its sheet and in the cart, and the server and the browser agree.
 *
 * These are food colours, not brand colours. They belong to the picture the
 * way a photo's colours would, so they stay the same whatever theme the page wears and
 * never carry text.
 */

export type FoodShape =
  | "cup"
  | "cookie"
  | "croffle"
  | "bar"
  | "pudding"
  | "donut"
  | "cake"
  | "bun";

/** Where a flavour sits in a layered drink: the syrup sinks, the shot floats. */
type Layer = "bottom" | "middle" | "top";

interface Flavor {
  id: string;
  words: RegExp;
  color: string;
  layer: Layer;
  /**
   * The tile behind it. Chosen by eye rather than computed: washing a dark
   * colour like coffee towards white gives a dull grey, where the tile should
   * look like the drink with the milk stirred in.
   */
  tint: string;
}

/*
 * Order matters only where two entries could both match the same word: the
 * more specific one comes first ("thai tea" before "tea", "gula aren" before
 * "gula").
 */
const FLAVORS: readonly Flavor[] = [
  { id: "palm-sugar", words: /\b(gula aren|aren|gula merah|palm sugar)\b/i, color: "#a8641f", layer: "bottom", tint: "#f7e7d0" },
  { id: "caramel", words: /\b(karamel|caramel|salted caramel)\b/i, color: "#c98a3a", layer: "bottom", tint: "#f8ead3" },
  { id: "strawberry", words: /\b(stroberi|strawberry|strawberi)\b/i, color: "#e0566f", layer: "bottom", tint: "#fde3e8" },
  { id: "mango", words: /\b(mangga|mango)\b/i, color: "#f2a93b", layer: "bottom", tint: "#fdeccd" },
  { id: "lemon", words: /\b(lemon\w*|lime|jeruk nipis)\b/i, color: "#f0cf3f", layer: "bottom", tint: "#fcf4cf" },
  { id: "thai-tea", words: /\b(thai tea|teh thai)\b/i, color: "#d9762b", layer: "middle", tint: "#fbe5d0" },
  { id: "taro", words: /\b(taro|talas)\b/i, color: "#a48bd0", layer: "middle", tint: "#ece5f7" },
  { id: "red-velvet", words: /\b(red velvet)\b/i, color: "#a9343f", layer: "middle", tint: "#f8e0e2" },
  { id: "milk", words: /\b(susu|milk\w*|latte|creamy|krim|cream)\b/i, color: "#f3e7d4", layer: "middle", tint: "#f7efe3" },
  { id: "matcha", words: /\b(matcha|green tea|teh hijau)\b/i, color: "#7ea44e", layer: "top", tint: "#e7f0d9" },
  { id: "butterfly-pea", words: /\b(butterfly pea|telang)\b/i, color: "#4f5bd5", layer: "top", tint: "#e2e5fb" },
  { id: "coffee", words: /\b(kopi|coffee|espresso|americano|cappuccino)\b/i, color: "#5b3a26", layer: "top", tint: "#f2e3d0" },
  { id: "tea", words: /\b(teh|tea)\b/i, color: "#b06d2f", layer: "middle", tint: "#f7e8d6" },
  { id: "chocolate", words: /\b(cokelat|coklat|chocolate|choco|kakao|cocoa|brownies?)\b/i, color: "#5a3322", layer: "middle", tint: "#f3e3d6" },
  { id: "pistachio", words: /\b(pistachio|pistasi|dubai)\b/i, color: "#94b860", layer: "middle", tint: "#e9f2dc" },
  { id: "cheese", words: /\b(keju|cheese)\b/i, color: "#f3cf63", layer: "middle", tint: "#fcf2d2" },
  { id: "butter", words: /\b(butter|mentega)\b/i, color: "#f4d27a", layer: "middle", tint: "#fcf1d6" },
  { id: "vanilla", words: /\b(vanila|vanilla)\b/i, color: "#f6e3b4", layer: "middle", tint: "#fbf3e1" },
];

/*
 * Words that mark something as a drink, in the menu's own language. Checked
 * against the category and the name together, so "Es Kopi Susu" in a category
 * called "Spesial" still gets a cup.
 */
const DRINK_WORDS =
  /\b(minum\w*|drinks?|es|ice[dy]?|kopi|coffee|teh|tea|jus|juice|lemon\w*|soda|susu|milk\w*|latte|matcha|smoothies?|boba|sirup|cokelat panas|air)\b/i;

/** Food shapes, most specific first. Anything unmatched is a bun. */
const SHAPES: readonly [FoodShape, RegExp][] = [
  ["croffle", /\b(croffle|waffle|wafel)\b/i],
  ["cookie", /\b(cookies?|kukis|kue kering|biskuit|biscuits?)\b/i],
  ["pudding", /\b(puding|pudding|panna cotta|jelly|agar)\b/i],
  ["bar", /\b(bar|batang|chocolate bar|cokelat batang)\b/i],
  ["donut", /\b(donat|donut|doughnut)\b/i],
  ["cake", /\b(cake|kue|bolu|brownies?|cheesecake|tart|slice)\b/i],
];

/** What the picture of one product is made of. */
export interface FlavorProfile {
  shape: FoodShape;
  /**
   * For a drink or a pudding, the layers from the bottom up. For anything else,
   * the first colour is the body (dough, chocolate) and the second, if any, the
   * thing set into it (chips, filling, topping).
   */
  colors: string[];
  /** The tile behind the picture, in the colour of what is in it. */
  tint: string;
  /** Melted chocolate or a sauce running over it ("lumer", "lava"). */
  melting: boolean;
  /** Dusted or glazed with sugar ("sugar", "gula", "glaze"). */
  sugared: boolean;
}

/** Default looks for a drink and a snack the vocabulary knows nothing about. */
const PLAIN_DRINK = ["#c98a3a", "#f3e7d4"];
const DOUGH = "#d9a25a";

/**
 * Whether a product is drawn as a drink. A name that says what food it is wins
 * over a drink word in it: "Puding Susu" is a pudding, not a glass of milk.
 */
export function isDrink(product: { name: string; categoryName: string | null }): boolean {
  if (SHAPES.some(([, words]) => words.test(product.name))) return false;
  return DRINK_WORDS.test(`${product.categoryName ?? ""} ${product.name}`);
}

export function flavorOf(product: { name: string; categoryName: string | null }): FlavorProfile {
  const name = product.name;
  const found = FLAVORS.filter((flavor) => flavor.words.test(name));
  // "Teh" inside "Thai Tea" must not add a second tea layer.
  const flavors = found.filter(
    (flavor) => !(flavor.id === "tea" && found.some((other) => other.id === "thai-tea")),
  );
  const melting = /\b(lumer|lava|meleleh|molten|drip)\b/i.test(name);
  const sugared = /\b(sugar|gula halus|glaze[d]?|gula pasir)\b/i.test(name);

  if (isDrink(product)) {
    const order: Layer[] = ["bottom", "middle", "top"];
    const layered = [...flavors].sort((a, b) => order.indexOf(a.layer) - order.indexOf(b.layer));
    const colors = layered.length > 0 ? layered.map((flavor) => flavor.color) : PLAIN_DRINK;
    // The tile takes the colour people see first: the one floating on top.
    const tint = layered[layered.length - 1]?.tint ?? "#f8ead3";
    return { shape: "cup", colors, tint, melting, sugared };
  }

  const shape = SHAPES.find(([, words]) => words.test(name))?.[0] ?? "bun";
  const colors = flavors.map((flavor) => flavor.color);

  if (shape === "pudding") {
    const layers = colors.length > 0 ? colors : ["#f6e3b4"];
    return { shape, colors: [...layers, "#b8742a"], tint: flavors[0]?.tint ?? "#fbf3e1", melting, sugared };
  }

  // A chocolate bar is made of chocolate; a cookie or a croffle is made of
  // dough, and the flavours in its name are what is set into it.
  const body =
    shape === "bar" ? (flavors.find((flavor) => flavor.id === "chocolate")?.color ?? "#5a3322") : DOUGH;
  const extras = flavors.filter((flavor) => flavor.color !== body);
  const all = [body, ...extras.map((flavor) => flavor.color)];
  const tint = extras[0]?.tint ?? flavors[0]?.tint ?? "#fbefd9";
  return { shape, colors: all, tint, melting, sugared };
}

/** A colour taken darker, for an outline or a shadow in its own hue. */
export function deepen(hex: string, amount = 0.28): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((value >> shift) & 0xff) * (1 - amount))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}
