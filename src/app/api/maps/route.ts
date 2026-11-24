import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { errorCode, errorMessage } from "@/lib/errors";
import { auditFields, logEvent, readJson, requestId } from "@/lib/audit-log";
import {
  executeMapCommand,
  readMaps,
} from "@/features/maps/server/map-service";

export const dynamic = "force-dynamic";

function statusFor(code: string, zod: boolean) {
  if (zod) return 422;
  if (code === "SESSION_REQUIRED") return 401;
  if (code === "NOT_AUTHORIZED" || code === "PASSWORD_CHANGE_REQUIRED")
    return 403;
  if (code === "RESOURCE_NOT_FOUND") return 404;
  if (code === "RATE_LIMITED") return 429;
  if (code === "SUPABASE_NOT_CONFIGURED" || code === "CONNECTION_ERROR")
    return 503;
  if (
    [
      "VERSION_CONFLICT",
      "NO_CHANGES",
      "INVALID_TRANSITION",
      "MAP_LIMIT",
      "LOCATION_LOCKED",
      "MAP_UNAVAILABLE",
    ].includes(code)
  )
    return 409;
  return 422;
}

function failure(
  error: unknown,
  id: string,
  started: number,
  fields: ReturnType<typeof auditFields>,
) {
  const zod = error instanceof ZodError;
  const code = zod ? "INVALID_INPUT" : errorCode(error);
  const status = statusFor(code, zod);
  logEvent({
    event: "maps",
    requestId: id,
    status,
    code,
    ms: Date.now() - started,
    ...fields,
  });
  return NextResponse.json(
    { error: code, message: errorMessage(new Error(code)) },
    {
      status,
      headers: { "Cache-Control": "no-store", "x-onza-request-id": id },
    },
  );
}

export async function POST(request: Request) {
  const id = requestId(request);
  const started = Date.now();
  let fields: ReturnType<typeof auditFields> = {};
  if (!isAllowedRequestOrigin(request)) {
    logEvent({
      event: "maps",
      requestId: id,
      status: 403,
      code: "NOT_AUTHORIZED",
    });
    return NextResponse.json(
      { error: "NOT_AUTHORIZED", message: "Origen no autorizado." },
      { status: 403, headers: { "x-onza-request-id": id } },
    );
  }
  try {
    // El plano completo (hasta 300 elementos y 60 zonas) cabe de sobra en 300 000 caracteres.
    const body = await readJson(request, 300000);
    fields = auditFields(body);
    const result = await executeMapCommand(body);
    logEvent({
      event: "maps",
      requestId: id,
      status: 200,
      ms: Date.now() - started,
      ...fields,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store", "x-onza-request-id": id },
    });
  } catch (error) {
    return failure(error, id, started, fields);
  }
}

export async function GET(request: Request) {
  const id = requestId(request);
  const started = Date.now();
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    return NextResponse.json(await readMaps(params), {
      headers: { "Cache-Control": "no-store", "x-onza-request-id": id },
    });
  } catch (error) {
    return failure(error, id, started, {});
  }
}
