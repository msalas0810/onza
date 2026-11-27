// Lo corre wrangler antes de cada dev o deploy (wrangler.jsonc, "build"). Frena un bundle armado sin `npm run cf:build`.
import { readFileSync } from "node:fs";
import { publicOnlyNextEnv } from "./lib/worker-env.mjs";

const source = readFileSync(".open-next/cloudflare/next-env.mjs", "utf8");
if (publicOnlyNextEnv(source) !== source) {
  console.error(
    "✗ El bundle lleva variables de .env que no son NEXT_PUBLIC_*. Armalo con `npm run cf:build`.",
  );
  process.exit(1);
}
