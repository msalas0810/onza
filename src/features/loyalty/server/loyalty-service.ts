import "server-only";
import { serverDb } from "@/lib/supabase/server";
import {
  campaignInputSchema,
  programInputSchema,
  ruleInputSchema,
  type CampaignInput,
  type ProgramInput,
  type RuleInput,
} from "../types";

// Servicio delgado: valida forma, llama a los RPC y devuelve lo que la base decide.
// La autorización (administración del local) y las reglas de puntos viven en la base.

export async function getLoyaltyConfig(venueId: string) {
  const db = await serverDb();
  const { data, error } = await db.rpc("loyalty_config", { venue: venueId });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveLoyaltyProgram(input: ProgramInput) {
  const parsed = programInputSchema.parse(input);
  const db = await serverDb();
  const { data, error } = await db.rpc("loyalty_program_save", {
    input: parsed,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveLoyaltyRule(input: RuleInput) {
  const parsed = ruleInputSchema.parse(input);
  const db = await serverDb();
  const { data, error } = await db.rpc("loyalty_rule_save", { input: parsed });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveLoyaltyCampaign(input: CampaignInput) {
  const parsed = campaignInputSchema.parse(input);
  const db = await serverDb();
  const { data, error } = await db.rpc("loyalty_campaign_save", {
    input: parsed,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getLoyaltySummary(venueId: string) {
  const db = await serverDb();
  const { data, error } = await db.rpc("loyalty_summary", { venue: venueId });
  if (error) throw new Error(error.message);
  return data;
}

/** Saldo, vencimientos e historial de la cuenta que hace la consulta. */
export async function getLoyaltyAccount() {
  const db = await serverDb();
  const { data, error } = await db.rpc("loyalty_account");
  if (error) throw new Error(error.message);
  return data;
}
