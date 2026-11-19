# Third-party notices

## Included
Inter Variable 4.1 by the Inter Project Authors: SIL Open Font License 1.1. Full original license at brand/fonts/OFL.txt; font unmodified. See brand/fonts/README.md for URL and hash.

## Planned dependencies, not bundled in this kit
Lucide: ISC, with MIT notices for Feather-derived icons. Keep package notices when installed. Lucide Animated: separate MIT project; inspect and retain its LICENSE for any copied component. Radix and shadcn components: preserve notices of the exact installed/copied version. Motion, Next.js and Supabase libraries: keep upstream license notices and lockfile when installing.

## Onza artwork
SVG paths derived from the Onza image selected in this conversation. This kit does not identify or distribute the unknown wordmark source typeface. Inter is an interface font, not a substitute for the outlined wordmark. No Apple, bank or payment-network logo is bundled. Use authorized official assets only when applicable.

## Photography
No third-party photography is bundled. Fixture images are null; source licensed product photographs before final visual acceptance. Do not scrape images of real bars or imply affiliation.

## Installed application dependencies

Versions are fixed in package-lock.json. Unmodified upstream license files remain in each npm package under node_modules after `npm ci`; these notices supplement those files.

| Dependency | Installed version | License |
| --- | --- | --- |
| Next.js | 16.4.6 | MIT |
| React / React DOM | 19.3.1 | MIT |
| Supabase JS / SSR | 2.119.0 / 0.12.7 | MIT |
| Radix Dialog | 1.3.1 | MIT |
| Zod | 4.6.7 | MIT |
| Lucide React | 1.73.0 | ISC; retain upstream Feather MIT notices |
| QRCode | 1.5.4 | MIT |
| PGlite (tests only) | 0.5.16 | Apache-2.0; PostgreSQL upstream notices included by package |
| Playwright (tests only) | 1.65.1 | Apache-2.0 |
| Vitest (tests only) | 5.1.0 | MIT |
| Supabase CLI (development only) | 3.1.0 | MIT |
| Prettier (development only) | 3.10.1 | MIT |

No Lucide Animated, Motion, SF Pro, scraped photography or bank/network artwork was added. The earlier planned-dependencies paragraph describes the original kit; the table records what was actually installed.

## Particle Wave

Particle Wave by Hossain Jahed (@jahed), published at https://21st.dev/@jahed/components/particle-wave. The original Component.tsx was supplied by the project owner on 2026-11-17. `src/components/backgrounds/particle-wave.tsx` retains its vertex equations, square point fragment, camera and desktop grid; adaptations add Onza colors, delta-time animation, responsive density, visibility/reduced-motion handling and resource cleanup. The supplied source did not include a separate license statement; none is invented here.

## V1 (2026-11-17)

Sin dependencias nuevas. La paleta, los componentes y el movimiento son propios; los íconos son Lucide (ya instalado) y el vasito, el wordmark y la tipografía Inter son los originales. `NumberFlow` y `lucide-animated` se evaluaron y no se adoptaron. Los nombres de los locales reales y sus datos públicos provienen de las fuentes citadas en `fixtures/real-venues.json`; no se incluye ninguna foto ni logo de terceros (`public/demo-venues/real/` está vacío a propósito). Onza no tiene relación comercial ni autorización de esos locales.
