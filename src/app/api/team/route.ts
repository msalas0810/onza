import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { errorCode, errorMessage } from "@/lib/errors";
import {
  executeTeamCommand,
  listTeam,
} from "@/features/team/server/team-service";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
function failure(error: unknown) {
  const code = error instanceof ZodError ? "INVALID_INPUT" : errorCode(error);
  const status =
    code === "SESSION_REQUIRED"
      ? 401
      : ["NOT_AUTHORIZED", "PASSWORD_CHANGE_REQUIRED"].includes(code)
        ? 403
        : code === "TEAM_ADMIN_NOT_CONFIGURED" || code === "CONNECTION_ERROR"
          ? 503
          : code === "INVALID_INPUT" || code === "INVALID_EMAIL"
            ? 422
            : 409;
  return NextResponse.json(
    { error: code, message: errorMessage(new Error(code)) },
    { status, headers },
  );
}
export async function GET(request: Request) {
  try {
    const venue = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("venue"));
    return NextResponse.json(await listTeam(venue), { headers });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request))
    return NextResponse.json(
      { error: "NOT_AUTHORIZED", message: "Origen no autorizado." },
      { status: 403, headers },
    );
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 4000)
      throw new Error("INVALID_INPUT");
    return NextResponse.json(await executeTeamCommand(await request.json()), {
      headers,
    });
  } catch (error) {
    return failure(error);
  }
}
