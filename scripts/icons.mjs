import sharp from "sharp";
import { readFileSync } from "node:fs";
const svg = readFileSync("public/favicon.svg");
for (const [size, name] of [
  [192, "icon-192.png"],
  [512, "icon-512.png"],
  [180, "apple-touch-icon.png"],
])
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile("public/" + name);
const logo = await sharp(svg).resize(320, 320).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#273869" },
})
  .composite([{ input: logo, gravity: "centre" }])
  .png()
  .toFile("public/icon-maskable.png");
