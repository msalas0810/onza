import { NextResponse } from "next/server";
import { readJson } from "@/lib/audit-log";
import { runGameAction } from "@/features/game/server/game-service";
import { failure, noStore, rejectForeignOrigin } from "@/features/game/server/http";

export const dynamic = "force-dynamic";

/** Acciones del jugador: comprar, equipar, personalizar, privacidad e historias. La base valida cuenta, edad y saldo. */
export async function POST(request: Request) {
  const denied = rejectForeignOrigin(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ ok: true, result: await runGameAction(await readJson(request, 4000)) }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
