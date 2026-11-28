import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/audit-log";
import { serverDb } from "@/lib/supabase/server";
import {
  getLoyaltyConfig,
  getLoyaltySummary,
  saveLoyaltyCampaign,
  saveLoyaltyProgram,
  saveLoyaltyRule,
} from "@/features/loyalty/server/loyalty-service";
import { campaignInputSchema, programInputSchema, ruleInputSchema } from "@/features/loyalty/types";
import { failure, noStore, rejectForeignOrigin } from "@/features/game/server/http";

export const dynamic = "force-dynamic";
const uuid = z.string().uuid();
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("program"), input: programInputSchema }),
  z.object({ action: z.literal("rule"), input: ruleInputSchema }),
  z.object({ action: z.literal("campaign"), input: campaignInputSchema }),
  z.object({
    action: z.literal("social"),
    input: z.object({ venueId: uuid, gifts_enabled: z.boolean(), stories_enabled: z.boolean() }),
  }),
]);

/** Fidelización y ajustes sociales de un local. La base exige administración del local en cada función. */
export async function GET(request: Request) {
  try {
    const venueId = uuid.parse(new URL(request.url).searchParams.get("venueId"));
    const db = await serverDb();
    const [config, summary, social] = await Promise.all([
      getLoyaltyConfig(venueId),
      getLoyaltySummary(venueId),
      db.rpc("venue_social_settings_get", { venue: venueId }),
    ]);
    if (social.error) throw new Error(social.error.message);
    return NextResponse.json({ config, summary, social: social.data }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const denied = rejectForeignOrigin(request);
  if (denied) return denied;
  try {
    const body = command.parse(await readJson(request, 8000));
    switch (body.action) {
      case "program":
        return NextResponse.json({ ok: true, result: await saveLoyaltyProgram(body.input) }, { headers: noStore });
      case "rule":
        return NextResponse.json({ ok: true, result: await saveLoyaltyRule(body.input) }, { headers: noStore });
      case "campaign":
        return NextResponse.json({ ok: true, result: await saveLoyaltyCampaign(body.input) }, { headers: noStore });
      case "social": {
        const db = await serverDb();
        const { data, error } = await db.rpc("venue_social_settings_save", { input: body.input });
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, result: data }, { headers: noStore });
      }
    }
  } catch (error) {
    return failure(error);
  }
}
