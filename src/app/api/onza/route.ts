import { NextResponse } from "next/server";
import { readJson } from "@/lib/audit-log";
import { runOnzaCommand } from "@/features/game/server/onza-service";
import { failure, noStore, rejectForeignOrigin } from "@/features/game/server/http";

export const dynamic = "force-dynamic";

/** Comandos del megaadministrador: economía, catálogo, importación CSV y moderación. La base comprueba el rol. */
export async function POST(request: Request) {
  const denied = rejectForeignOrigin(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ ok: true, result: await runOnzaCommand(await readJson(request, 2_200_000)) }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
