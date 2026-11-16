// Generates ORIGINAL placeholder cover photos and logos for the fictional demo venues: abstract geometric art drawn
// here, no photographs, no real brands or venues. Output: public/demo-venues/<slug>-cover.jpg (1600x1000) and
// <slug>-logo.png (512x512), both far below the 2 MB bucket limit. Deterministic: same script, same pictures.
// Usage: npm run demo:generate-venue-art   (needs a Chromium: PW_CHANNEL=chrome by default, or CHROMIUM_PATH=/path)
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const out = new URL("../public/demo-venues/", import.meta.url);
mkdirSync(out, { recursive: true });

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// Rounded-top arch of width w and height h with its base at (x, y).
const arch = (x, y, w, h, fill, opacity = 1) =>
  `<path d="M${x} ${y}V${y - h + w / 2}A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y - h + w / 2}V${y}Z" fill="${fill}" opacity="${opacity}"/>`;

const art = {
  "sala-norte": {
    // Night bar: stacked glowing discs over a row of bottle silhouettes.
    cover: svg(
      1600,
      1000,
      `<rect width="1600" height="1000" fill="#1d0f17"/>
       <circle cx="1130" cy="400" r="470" fill="#4a1630"/>
       <circle cx="1130" cy="400" r="340" fill="#681d3b"/>
       <circle cx="1130" cy="400" r="200" fill="#a33a68"/>
       <circle cx="1130" cy="400" r="95" fill="#e7a4be"/>
       ${[0, 1, 2, 3, 4, 5, 6]
         .map((i) => {
           const h = [360, 520, 300, 440, 580, 340, 480][i];
           return `<rect x="${110 + i * 112}" y="${760 - h}" width="76" height="${h}" rx="30" fill="#2b1620"/><rect x="${132 + i * 112}" y="${700 - h}" width="32" height="70" rx="8" fill="#3a1d2b"/>`;
         })
         .join("")}
       <rect y="760" width="1600" height="240" fill="#150a10"/>
       <rect y="752" width="1600" height="8" fill="#681d3b"/>
       <rect x="110" y="830" width="640" height="6" fill="#3a1d2b"/>`,
    ),
    logo: svg(
      512,
      512,
      `<rect width="512" height="512" fill="#681d3b"/>
       <path d="M256 104 394 372H118Z" fill="#f7eff2"/>
       <path d="M256 196 330 340H182Z" fill="#681d3b"/>
       <circle cx="256" cy="416" r="22" fill="#e7a4be"/>`,
    ),
  },
  "patio-central": {
    // Sunlit courtyard: a row of arches and a low sun.
    cover: svg(
      1600,
      1000,
      `<rect width="1600" height="1000" fill="#f1e4d3"/>
       <circle cx="800" cy="470" r="250" fill="#e8b98a"/>
       ${[0, 1, 2, 3, 4]
         .map((i) =>
           arch(
             80 + i * 300,
             860,
             260,
             [620, 700, 780, 700, 620][i],
             ["#b5603e", "#d98e5f", "#8c3f2a", "#d98e5f", "#b5603e"][i],
           ),
         )
         .join("")}
       ${[0, 1, 2, 3, 4]
         .map((i) =>
           arch(
             125 + i * 300,
             860,
             170,
             [470, 550, 630, 550, 470][i],
             "#f1e4d3",
             0.92,
           ),
         )
         .join("")}
       <rect y="860" width="1600" height="140" fill="#5b2a1c"/>
       <rect y="850" width="1600" height="10" fill="#8c3f2a"/>`,
    ),
    logo: svg(
      512,
      512,
      `<rect width="512" height="512" fill="#b5603e"/>
       ${arch(116, 420, 280, 320, "#f1e4d3")}
       ${arch(176, 420, 160, 200, "#b5603e")}`,
    ),
  },
  "club-cero": {
    // After-hours club: concentric rings around a zero.
    cover: svg(
      1600,
      1000,
      `<rect width="1600" height="1000" fill="#0f0f14"/>
       ${[0, 1, 2, 3, 4, 5, 6]
         .map(
           (i) =>
             `<circle cx="1000" cy="470" r="${120 + i * 85}" fill="none" stroke="${["#e7a4be", "#a33a68", "#681d3b", "#3a1d2b", "#2a1e28", "#211821", "#1a141a"][i]}" stroke-width="${i === 0 ? 34 : 14}"/>`,
         )
         .join("")}
       <ellipse cx="1000" cy="470" rx="70" ry="120" fill="none" stroke="#f5f5f7" stroke-width="22" transform="rotate(14 1000 470)"/>
       ${[0, 1, 2, 3, 4, 5, 6, 7, 8]
         .map(
           (i) =>
             `<rect x="${60 + i * 62}" y="${930 - [90, 180, 120, 260, 150, 220, 100, 190, 130][i]}" width="30" height="${[90, 180, 120, 260, 150, 220, 100, 190, 130][i]}" rx="6" fill="#1f1722"/>`,
         )
         .join("")}`,
    ),
    logo: svg(
      512,
      512,
      `<rect width="512" height="512" fill="#0f0f14"/>
       <ellipse cx="256" cy="256" rx="104" ry="150" fill="none" stroke="#e7a4be" stroke-width="44" transform="rotate(14 256 256)"/>
       <circle cx="256" cy="256" r="12" fill="#f5f5f7"/>`,
    ),
  },
};

const launchOptions = process.env.CHROMIUM_PATH
  ? { executablePath: process.env.CHROMIUM_PATH }
  : { channel: process.env.PW_CHANNEL ?? "chrome" };
const browser = await chromium.launch(launchOptions);
try {
  for (const [slug, { cover, logo }] of Object.entries(art)) {
    for (const [name, markup, [width, height], type] of [
      ["cover", cover, [1600, 1000], "jpeg"],
      ["logo", logo, [512, 512], "png"],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 1,
      });
      await page.setContent(
        `<!doctype html><body style="margin:0;background:#000">${markup}</body>`,
      );
      const buffer = await page.screenshot({
        type,
        ...(type === "jpeg" ? { quality: 84 } : {}),
      });
      await page.close();
      const file = `${slug}-${name}.${type === "jpeg" ? "jpg" : "png"}`;
      writeFileSync(new URL(file, out), buffer);
      console.log(`${file}  ${(buffer.length / 1024).toFixed(0)} KB`);
    }
  }
} finally {
  await browser.close();
}
