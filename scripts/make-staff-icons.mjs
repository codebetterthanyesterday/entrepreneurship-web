// Renders the staff app's home-screen icons into public/brand/ (app-*.png) from the brand
// mark: needed for push on an iPhone, which only allows it to an installed app.
//
//   node scripts/make-staff-icons.mjs
//
// `maskable` keeps the mark inside the 80% safe zone Android crops to.
import sharp from "sharp";

const PAPER = "#fff6e8";
const MARK = "public/brand/bunnye-mark.png";

for (const { file, size, mark } of [
  { file: "icon-192.png", size: 192, mark: 0.78 },
  { file: "icon-512.png", size: 512, mark: 0.78 },
  { file: "icon-maskable-512.png", size: 512, mark: 0.6 },
]) {
  const inner = Math.round(size * mark);
  const art = await sharp(MARK).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: PAPER } })
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toFile(`public/brand/app-${file}`);
  console.log(`✓ public/brand/app-${file}`);
}
