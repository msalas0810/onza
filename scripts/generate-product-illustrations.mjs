// Generates ORIGINAL drink illustrations, one per drink type (no photographs, no real brands, no real venues):
// cocktail (coupe), highball (vaso largo), shot, beer, wine and soft (sin alcohol).
// One flat style on a very light background (#FBF8F6) using the Onza palette (burgundy, rose, graphite, soft neutrals) plus a
// single amber accent shared by garnishes and beer. Output: public/demo-products/<type>.png, 800x1000 (4:5).
// Deterministic. Usage: npm run demo:generate-drink-art (needs Chromium: PW_CHANNEL=chrome by default or CHROMIUM_PATH).
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const out = new URL("../public/demo-products/", import.meta.url);
mkdirSync(out, { recursive: true });

const c = {
  bg: "#FBF8F6",
  shadow: "#EBE4E8",
  glass: "#EFE9ED",
  edge: "#DCD2D8",
  stem: "#E6DEE3",
  burgundy: "#681D3B",
  burgundyLight: "#8A2B52",
  mid: "#A33A68",
  midLight: "#C4577F",
  rose: "#E7A4BE",
  roseLight: "#F0BDD1",
  graphite: "#242426",
  amber: "#E3B46C",
  amberLight: "#F2D9A6",
  cream: "#F7EFD0",
};
const frame = (body, shadowRx = 200) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
    <rect width="800" height="1000" fill="${c.bg}"/>
    <ellipse cx="400" cy="838" rx="${shadowRx}" ry="20" fill="${c.shadow}"/>
    ${body}
  </svg>`;
const glass = (d) =>
  `<path d="${d}" fill="${c.glass}" stroke="${c.edge}" stroke-width="6" stroke-linejoin="round"/>`;
const shine = (x, y, h) =>
  `<rect x="${x}" y="${y}" width="14" height="${h}" rx="7" fill="#fff" opacity="0.55"/>`;
const dots = (list, fill = "#fff", opacity = 0.7) =>
  list
    .map(
      ([x, y, r]) =>
        `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${opacity}"/>`,
    )
    .join("");
const cube = (x, y, size, rotate) =>
  `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="14" fill="#fff" opacity="0.7" transform="rotate(${rotate} ${x + size / 2} ${y + size / 2})"/>`;
// Round citrus slice: amber rim, light flesh, segment lines.
const slice = (cx, cy, r) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.amber}"/>
   <circle cx="${cx}" cy="${cy}" r="${r - 12}" fill="${c.cream}"/>
   ${[0, 1, 2, 3, 4, 5]
     .map((i) => {
       const a = (i * Math.PI) / 3 + 0.3;
       return `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * (r - 12)).toFixed(1)}" y2="${(cy + Math.sin(a) * (r - 12)).toFixed(1)}" stroke="${c.amber}" stroke-width="5" stroke-linecap="round"/>`;
     })
     .join("")}
   <circle cx="${cx}" cy="${cy}" r="9" fill="${c.amber}"/>`;

const art = {
  // Cóctel en copa
  cocktail: frame(
    `<path d="M280 812Q280 790 400 785Q520 790 520 812Q520 832 400 832Q280 832 280 812Z" fill="${c.edge}"/>
     <rect x="390" y="540" width="20" height="260" fill="${c.stem}"/>
     ${glass("M170 300H630C630 470 540 560 400 560C260 560 170 470 170 300Z")}
     <path d="M196 340H604C594 450 520 530 400 530C280 530 206 450 196 340Z" fill="${c.mid}"/>
     <ellipse cx="400" cy="340" rx="204" ry="14" fill="${c.midLight}"/>
     <path d="M218 330C228 430 272 490 332 515" stroke="#fff" stroke-width="10" stroke-linecap="round" fill="none" opacity="0.55"/>
     ${slice(588, 300, 62)}`,
  ),
  // Vaso largo
  highball: frame(
    `${glass("M290 230H510L498 790Q498 810 478 810H322Q302 810 302 790Z")}
     <path d="M300 330H500L489 785Q489 798 474 798H326Q311 798 311 785Z" fill="${c.rose}"/>
     <ellipse cx="400" cy="330" rx="100" ry="9" fill="${c.roseLight}"/>
     <path d="M450 130L408 720" stroke="${c.burgundy}" stroke-width="18" stroke-linecap="round"/>
     <path d="M450 130Q454 100 490 96" stroke="${c.burgundy}" stroke-width="18" stroke-linecap="round" fill="none"/>
     ${cube(330, 352, 70, -10)}${cube(408, 408, 66, 12)}${cube(338, 478, 72, 8)}${cube(402, 560, 68, -6)}
     ${shine(318, 250, 500)}
     ${dots([
       [360, 700, 6],
       [440, 660, 5],
       [370, 610, 4],
       [450, 760, 7],
     ])}
     <path d="M232 238A70 70 0 0 1 372 238Z" fill="${c.amber}" transform="rotate(-24 302 238)"/>
     <path d="M246 236A56 56 0 0 1 358 236Z" fill="${c.cream}" transform="rotate(-24 302 238)"/>`,
  ),
  // Shot
  shot: frame(
    `${glass("M280 430H520L484 800Q482 818 462 818H338Q318 818 316 800Z")}
     <path d="M290 500H510L480 790Q478 804 462 804H338Q322 804 320 790Z" fill="${c.burgundy}"/>
     <ellipse cx="400" cy="500" rx="110" ry="10" fill="${c.burgundyLight}"/>
     ${shine(308, 450, 320)}
     <path d="M570 800A80 80 0 0 1 730 800Z" fill="${c.amber}"/>
     <path d="M585 795A65 65 0 0 1 715 795Z" fill="${c.cream}"/>
     ${[0, 1, 2, 3]
       .map((i) => {
         const a = Math.PI + ((i + 1) * Math.PI) / 5;
         return `<line x1="650" y1="795" x2="${(650 + Math.cos(a) * 65).toFixed(1)}" y2="${(795 + Math.sin(a) * 65).toFixed(1)}" stroke="${c.amber}" stroke-width="5" stroke-linecap="round"/>`;
       })
       .join("")}`,
    170,
  ),
  // Cerveza
  beer: frame(
    `${glass("M270 250H530L500 800Q498 818 478 818H322Q302 818 300 800Z")}
     <path d="M280 330H520L492 790Q490 806 474 806H326Q310 806 308 790Z" fill="${c.amber}"/>
     ${dots(
       [
         [350, 700, 7],
         [372, 640, 5],
         [430, 720, 6],
         [450, 600, 5],
         [380, 540, 6],
         [420, 470, 5],
         [455, 400, 6],
       ],
       c.amberLight,
       0.95,
     )}
     <g fill="#fff" stroke="${c.glass}" stroke-width="4">
       <circle cx="306" cy="296" r="44"/><circle cx="372" cy="262" r="54"/><circle cx="446" cy="266" r="54"/><circle cx="508" cy="298" r="44"/>
       <rect x="284" y="290" width="232" height="64" rx="14" stroke="none"/>
     </g>
     ${shine(298, 380, 380)}`,
    190,
  ),
  // Vino
  wine: frame(
    `<ellipse cx="400" cy="812" rx="118" ry="18" fill="${c.edge}"/>
     <rect x="392" y="560" width="16" height="250" fill="${c.stem}"/>
     ${glass("M285 270C270 430 320 565 400 565C480 565 530 430 515 270Z")}
     <path d="M291 390H509C503 485 462 548 400 548C338 548 297 485 291 390Z" fill="${c.burgundy}"/>
     <ellipse cx="400" cy="390" rx="109" ry="10" fill="${c.burgundyLight}"/>
     <path d="M312 300C312 400 338 480 372 520" stroke="#fff" stroke-width="10" stroke-linecap="round" fill="none" opacity="0.55"/>`,
    170,
  ),
  // Sin alcohol
  soft: frame(
    `${glass("M270 360H530L516 790Q514 812 492 812H308Q286 812 284 790Z")}
     <path d="M279 430H521L508 785Q506 800 488 800H312Q294 800 292 785Z" fill="${c.amberLight}"/>
     <ellipse cx="400" cy="430" rx="121" ry="10" fill="${c.cream}"/>
     <path d="M440 200L420 700" stroke="${c.graphite}" stroke-width="16" stroke-linecap="round"/>
     ${cube(318, 452, 70, -8)}${cube(398, 500, 68, 10)}${cube(326, 574, 72, 6)}${cube(398, 640, 66, -10)}
     ${shine(298, 380, 380)}
     ${dots([
       [360, 740, 6],
       [440, 700, 5],
       [372, 520, 5],
       [455, 590, 6],
     ])}
     ${slice(520, 366, 68)}`,
  ),
};

const launchOptions = process.env.CHROMIUM_PATH
  ? { executablePath: process.env.CHROMIUM_PATH }
  : { channel: process.env.PW_CHANNEL ?? "chrome" };
const browser = await chromium.launch(launchOptions);
try {
  for (const [type, markup] of Object.entries(art)) {
    const page = await browser.newPage({
      viewport: { width: 800, height: 1000 },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<!doctype html><body style="margin:0;background:#fff">${markup}</body>`,
    );
    const buffer = await page.screenshot({ type: "png" });
    await page.close();
    writeFileSync(new URL(`${type}.png`, out), buffer);
    console.log(`${type}.png  ${(buffer.length / 1024).toFixed(0)} KB`);
  }
} finally {
  await browser.close();
}
