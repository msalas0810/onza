import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/audit-log";
import { purchaseCoins } from "@/features/game/server/game-service";
import { failure, noStore, rejectForeignOrigin } from "@/features/game/server/http";

export const dynamic = "force-dynamic";
const body = z.object({
  package: z.string().regex(/^[a-z0-9_]{3,30}$/),
  idempotency: z.string().min(8).max(80),
});

/** Compra de monedas con pago SIMULADO (demo). Con pagos reales deshabilitados es la única vía; BAC sigue sin configurar. */
export async function POST(request: Request) {
  const denied = rejectForeignOrigin(request);
  if (denied) return denied;
  try {
    const input = body.parse(await readJson(request, 1000));
    return NextResponse.json({ ok: true, result: await purchaseCoins(input.package, input.idempotency) }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
