import { encode } from "uqr";
import { wrapText, type TicketContent } from "@/lib/ticket-image";

/**
 * Draws the customer's ticket as a picture, in the browser ("Simpan tiket").
 *
 * The ticket on screen, redrawn for a phone's gallery: the order number large,
 * whose it is and when, what was ordered, how it is paid, and the QR the
 * cashier scans, all on a portrait card. Drawn on a canvas here rather than
 * photographed from the page, so it comes out the same on every phone, with
 * nothing of the page around it, and needs no server.
 *
 * Browser only: it needs `document`, a canvas and the page's loaded fonts.
 */

const W = 1080;
const PAD = 64; // around the card
const IN = 56; // inside the card
const CARD_W = W - PAD * 2;
const TEXT_W = CARD_W - IN * 2;

const C = {
  sky: "#58bbec",
  skySoft: "#b5e4fb",
  grass: "#62b94c",
  grassDeep: "#4e9c3b",
  dirt: "#8a5a2c",
  navy: "#1d2d55",
  yellow: "#f6c744",
  cream: "#fff3d1",
  white: "#ffffff",
  sand: "#f1f2ff",
  line: "#dfe5ff",
  ink: "#0f1f47",
  inkSoft: "#55597a",
  red: "#b8151a",
  sky_deep: "#2c6b9e",
  ok: "#277459",
  warn: "#8a5814",
};

interface Fonts {
  head: string;
  body: string;
  mono: string;
}

/** The families next/font gave the theme's three faces, with safe fallbacks. */
function themeFonts(): Fonts {
  const style = getComputedStyle(document.body);
  const read = (name: string, fallback: string) => {
    const value = style.getPropertyValue(name).trim() || getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value ? `${value}, ${fallback}` : fallback;
  };
  return {
    head: read("--font-k-head", "system-ui, sans-serif"),
    body: read("--font-k-body", "system-ui, sans-serif"),
    mono: read("--font-k-mono", "ui-monospace, Menlo, monospace"),
  };
}

async function loadFonts(fonts: Fonts): Promise<void> {
  if (!("fonts" in document)) return;
  await Promise.all(
    [`900 100px ${fonts.head}`, `800 40px ${fonts.body}`, `600 32px ${fonts.body}`, `700 24px ${fonts.mono}`].map((spec) =>
      document.fonts.load(spec).catch(() => []),
    ),
  );
}

type Ctx = CanvasRenderingContext2D;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[], fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** Small uppercase mono label, as the ticket's `.k-mono`. */
function label(ctx: Ctx, fonts: Fonts, text: string, x: number, y: number, color: string, align: CanvasTextAlign = "left") {
  ctx.font = `700 22px ${fonts.mono}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.letterSpacing = "2.5px";
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.letterSpacing = "0px";
  ctx.textAlign = "left";
}

/**
 * Lays the ticket out from the top. With `draw` false it only measures, so
 * the canvas can be made exactly as tall as the ticket before drawing it.
 */
function layout(ctx: Ctx, fonts: Fonts, t: TicketContent, draw: boolean): number {
  const x0 = PAD + IN;
  const right = PAD + CARD_W - IN;
  const ink = (fill: string) => {
    ctx.fillStyle = fill;
  };
  const text = (s: string, x: number, y: number, font: string, fill: string, align: CanvasTextAlign = "left") => {
    if (!draw) return;
    ctx.font = font;
    ink(fill);
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
    ctx.textAlign = "left";
  };
  const wrap = (s: string, font: string, width: number) => {
    ctx.font = font;
    return wrapText(s, width, (part) => ctx.measureText(part).width);
  };

  // The navy band: the brand, and what this is.
  let y = PAD;
  const bandH = 150;
  if (draw) {
    roundRect(ctx, PAD, y, CARD_W, bandH, [28, 28, 0, 0], C.navy);
    label(ctx, fonts, "● Official adventurer pass", x0, y + 56, C.yellow);
    ctx.font = `900 52px ${fonts.head}`;
    ink(C.white);
    ctx.fillText(t.brand.toUpperCase(), x0, y + 118, TEXT_W);
  }
  y += bandH;

  // The white card everything else sits on; its height is known only at the end.
  const cardTop = y;
  y += 48;

  // Chips: the day, the hour, the status.
  ctx.font = `800 26px ${fonts.body}`;
  let cx = x0;
  const chip = (s: string, fill: string, color: string) => {
    const w = ctx.measureText(s).width + 36;
    if (cx + w > right) {
      cx = x0;
      y += 58;
    }
    if (draw) {
      roundRect(ctx, cx, y, w, 46, 23, fill);
      ctx.font = `800 26px ${fonts.body}`;
      ink(color);
      ctx.fillText(s, cx + 18, y + 32);
    }
    cx += w + 12;
  };
  const statusFill = t.statusChip === "Dibatalkan" ? C.red : t.paid ? C.yellow : C.cream;
  const statusInk = t.statusChip === "Dibatalkan" ? C.white : C.ink;
  for (const c of t.chips) chip(c, C.sand, C.ink);
  chip(`Status: ${t.statusChip}`, statusFill, statusInk);
  y += 46 + 32;

  // The code box: the number, and whose it is.
  const nameFont = `800 40px ${fonts.body}`;
  const handoverFont = `600 30px ${fonts.body}`;
  const nameLines = wrap(t.customerName, nameFont, TEXT_W - 64);
  const handoverLines = t.handover ? wrap(t.handover, handoverFont, TEXT_W - 64) : [];
  const boxH = 32 + 30 + 128 + 36 + 30 + nameLines.length * 50 + handoverLines.length * 42 + 28;
  if (draw) roundRect(ctx, x0, y, TEXT_W, boxH, 18, C.sand);
  let by = y + 32;
  if (draw) label(ctx, fonts, "Order code (nomor pesanan)", x0 + 32, by + 20, C.inkSoft);
  by += 30;
  if (draw) {
    ctx.font = `900 120px ${fonts.head}`;
    ctx.letterSpacing = "4px";
    ink(C.red);
    ctx.fillText(t.orderNumber, x0 + 32, by + 108, TEXT_W - 64);
    ctx.letterSpacing = "0px";
  }
  by += 128 + 36;
  if (draw) label(ctx, fonts, "Reservasi atas nama", x0 + 32, by, C.inkSoft);
  by += 30;
  for (const line of nameLines) {
    by += 50;
    text(line, x0 + 32, by - 8, nameFont, C.ink);
  }
  for (const line of handoverLines) {
    by += 42;
    text(line, x0 + 32, by - 6, handoverFont, C.inkSoft);
  }
  y += boxH + 44;

  // The bill.
  if (draw) label(ctx, fonts, "Rincian loot bag", x0, y, C.inkSoft);
  y += 26;
  const lineFont = `700 32px ${fonts.body}`;
  const detailFont = `600 26px ${fonts.body}`;
  for (const item of t.lines) {
    ctx.font = lineFont;
    const priceW = ctx.measureText(item.subtotal).width;
    const nameLinesOf = wrap(`${item.quantity}× ${item.name}`, lineFont, TEXT_W - priceW - 32);
    y += 46;
    text(item.subtotal, right, y, lineFont, C.ink, "right");
    nameLinesOf.forEach((line, index) => {
      if (index > 0) y += 42;
      text(line, x0, y, lineFont, C.ink);
    });
    if (item.detail) {
      for (const line of wrap(item.detail, detailFont, TEXT_W - priceW - 32)) {
        y += 36;
        text(line, x0 + 4, y, detailFont, C.inkSoft);
      }
    }
  }
  y += 30;
  if (draw) {
    ctx.fillStyle = C.line;
    ctx.fillRect(x0, y, TEXT_W, 3);
  }
  y += 56;
  text("Total", x0, y, `800 34px ${fonts.body}`, C.ink);
  text(t.total, right, y + 4, `900 48px ${fonts.head}`, C.ink, "right");
  y += 40;

  // How it is paid.
  const payH = 128;
  if (draw) {
    roundRect(ctx, x0, y, TEXT_W, payH, 18, C.sand);
    label(ctx, fonts, "Metode pembayaran", x0 + 32, y + 46, C.inkSoft);
    label(ctx, fonts, "Status bayar", right - 32, y + 46, C.inkSoft, "right");
  }
  text(t.paymentMethod, x0 + 32, y + 96, `800 34px ${fonts.body}`, C.sky_deep);
  text(t.paid ? "Udah lunas" : "Belum dibayar", right - 32, y + 96, `800 34px ${fonts.body}`, t.paid ? C.ok : C.warn, "right");
  y += payH + 48;

  // The tear line, then the pass with the QR the cashier scans.
  const tearY = y;
  y += 24;
  const passTop = y;
  y += 56;
  if (draw) label(ctx, fonts, "Order pass ticket", W / 2, y, C.red, "center");
  y += 50;
  const showFont = `600 30px ${fonts.body}`;
  for (const line of wrap(t.showLine, showFont, TEXT_W)) {
    text(line, W / 2, y, showFont, C.inkSoft, "center");
    y += 40;
  }
  text("Bukan QR buat bayar.", W / 2, y, `800 30px ${fonts.body}`, C.ink, "center");
  y += 36;

  const qrBox = 440;
  const qrX = (W - qrBox) / 2;
  if (draw) {
    roundRect(ctx, qrX, y, qrBox, qrBox + 56, 24, C.white);
    const qr = encode(t.orderNumber, { ecc: "M", border: 1 });
    const cell = Math.floor((qrBox - 48) / qr.size);
    const size = cell * qr.size;
    // Whole pixels, so no hairline shows between the modules.
    const ox = Math.round(qrX + (qrBox - size) / 2);
    const oy = Math.round(y + 24);
    ink(C.ink);
    qr.data.forEach((row, r) =>
      row.forEach((dark, c) => {
        if (dark) ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
      }),
    );
    label(ctx, fonts, `Pass ID: #${t.orderNumber}`, W / 2, y + qrBox + 30, C.ink, "center");
  }
  y += qrBox + 56 + 48;
  const noteFont = `600 26px ${fonts.body}`;
  for (const line of wrap(`Tunjukin kode QR ini atau sebutin nomor pesanannya ke ${t.shownTo}.`, noteFont, TEXT_W)) {
    text(line, W / 2, y, noteFont, C.inkSoft, "center");
    y += 36;
  }
  y += 8;
  if (draw) label(ctx, fonts, `Status terbaru: ${t.trackAt}`, W / 2, y, C.inkSoft, "center");
  y += 44;
  const cardBottom = y;

  if (draw) {
    // Behind what was drawn above: the white card and the grey pass panel.
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = C.line;
    ctx.beginPath();
    ctx.roundRect(PAD, passTop, CARD_W, cardBottom - passTop, [0, 0, 28, 28]);
    ctx.fill();
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.roundRect(PAD, cardTop, CARD_W, passTop - cardTop, 0);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // The dashed tear between the details and the pass.
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 14]);
    ctx.beginPath();
    ctx.moveTo(PAD + 36, tearY + 12);
    ctx.lineTo(PAD + CARD_W - 36, tearY + 12);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  return cardBottom + PAD + 90; // room for the ground under the card
}

/** The scenery behind the card: sky, a few clouds, and grass over dirt. */
function scenery(ctx: Ctx, height: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, C.sky);
  sky.addColorStop(1, C.skySoft);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, height);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const cloud = (x: number, y: number, s: number) => {
    ctx.fillRect(x, y, 120 * s, 24 * s);
    ctx.fillRect(x + 24 * s, y - 24 * s, 64 * s, 24 * s);
  };
  cloud(30, 40, 1);
  cloud(860, 120, 0.8);
  cloud(900, height * 0.45, 0.7);
  cloud(20, height * 0.62, 0.9);

  const ground = height - 70;
  ctx.fillStyle = C.dirt;
  ctx.fillRect(0, ground, W, 70);
  ctx.fillStyle = C.grass;
  ctx.fillRect(0, ground, W, 26);
  ctx.fillStyle = C.grassDeep;
  for (let x = 0; x < W; x += 36) ctx.fillRect(x, ground + 26, 18, 8);
}

/** The ticket as a PNG, ready to save or share. */
export async function renderTicket(content: TicketContent): Promise<Blob> {
  const fonts = themeFonts();
  await loadFonts(fonts);

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("Canvas tidak tersedia");
  const height = Math.ceil(layout(measure, fonts, content, false));

  // The card on a layer of its own (layout draws its pieces, then slips the
  // card's panels behind them), then laid over the scenery.
  const card = document.createElement("canvas");
  card.width = W;
  card.height = height;
  const cardCtx = card.getContext("2d");
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!cardCtx || !ctx) throw new Error("Canvas tidak tersedia");
  layout(cardCtx, fonts, content, true);
  scenery(ctx, height);
  ctx.drawImage(card, 0, 0);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Gagal membuat gambar"))), "image/png"),
  );
}
