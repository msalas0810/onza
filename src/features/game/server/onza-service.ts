import "server-only";
import { z } from "zod";
import { serverDb } from "@/lib/supabase/server";
import { parseCatalogCsv, MAX_CSV_BYTES } from "../csv/catalog-csv";
import { jsonSchema } from "../types";

/** Administración de ONZA (megaadministrador). La base comprueba el rol en cada función; esto solo prepara las llamadas. */
async function db() {
  const client = await serverDb();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error && ((error.status ?? 0) >= 500 || error.name === "AuthRetryableFetchError"))
    throw new Error("CONNECTION_ERROR");
  if (error || !user) throw new Error("SESSION_REQUIRED");
  return client;
}
function unwrap<T>(result: { data: unknown; error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export const onzaCommandSchema = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("economy"),
    entity: z.enum(["settings", "event_rule", "package", "campaign", "level", "achievement"]),
    values: z.record(z.string(), jsonSchema),
  }),
  z.object({ command: z.literal("item_save"), values: z.record(z.string(), jsonSchema) }),
  z.object({ command: z.literal("item_grant"), userId: z.string().uuid(), itemId: z.string().uuid() }),
  z.object({ command: z.literal("achievement_item"), code: z.string().max(40), itemId: z.string().uuid().nullable() }),
  z.object({ command: z.literal("import_stage"), filename: z.string().min(1).max(200), csv: z.string().max(MAX_CSV_BYTES) }),
  z.object({ command: z.literal("import_apply"), importId: z.string().uuid() }),
  z.object({ command: z.literal("import_discard"), importId: z.string().uuid() }),
  z.object({ command: z.literal("story_moderate"), storyId: z.string().uuid(), hide: z.boolean(), reason: z.string().max(200).optional() }),
]);

export type EconomyOverview = Record<string, unknown> & {
  settings: Record<string, number | boolean>;
  event_rules: { kind: string; coins: number; xp: number; daily_cap: number; enabled: boolean }[];
  packages: { id: string; code: string; name: string; coins: number; bonus_coins: number; price_minor: number; enabled: boolean; sort: number }[];
  campaigns: { id: string; name: string; venue_id: string | null; coin_multiplier: number; xp_multiplier: number; starts_at: string; ends_at: string; enabled: boolean }[];
  levels: { level: number; xp_required: number; title: string }[];
  achievements: { id: string; code: string; name: string; description: string; metric: string; threshold: number; reward_coins: number; reward_xp: number; enabled: boolean; reward_item_id: string | null }[];
  stats: Record<string, number>;
  flags: { kind: string; user_id: string | null; details: Record<string, unknown>; at: string }[];
  audit: { entity: string; key: string; action: string; at: string; actor: string | null }[];
};
export type CatalogItem = {
  id: string; sku: string; name: string; category: string; price_coins: number; rarity: string; status: string; season: string | null;
  exclusive: boolean; min_level: number; asset_ref: string | null; preview_ref: string | null; owners: number; coins_collected: number;
  available_from: string | null; available_until: string | null; compat: Record<string, unknown>; sort: number;
};
export type ImportSummary = {
  id: string; filename: string; status: string; total_rows: number; created: number; updated: number; unchanged: number; errors: number;
  created_at: string; applied_at: string | null;
};
export type ImportPreview = {
  id: string; status?: string; created: number; updated: number; unchanged: number;
  errors: { line?: number; sku?: string; message: string }[];
  preview: { line: number; sku: string; action: string; changes: string[] }[];
};
export type ReportedStory = { story_id: string; venue_id: string; media_path: string; caption: string; hidden: boolean; reports: number; reasons: string[]; created_at: string };

export async function getEconomyOverview() {
  return unwrap<EconomyOverview>(await (await db()).rpc("economy_admin_overview"));
}
export async function getAdminCatalog() {
  return unwrap<{ items: CatalogItem[] }>(await (await db()).rpc("avatar_admin_catalog")).items;
}
export async function listImports() {
  return unwrap<ImportSummary[]>(await (await db()).rpc("catalog_import_list"));
}
export async function getStoryReports() {
  return unwrap<ReportedStory[]>(await (await db()).rpc("story_admin_reports"));
}

export async function runOnzaCommand(raw: unknown) {
  const command = onzaCommandSchema.parse(raw);
  const client = await db();
  switch (command.command) {
    case "economy":
      return unwrap(await client.rpc("economy_admin_command", { input: { entity: command.entity, values: command.values } }));
    case "item_save":
      return unwrap(await client.rpc("avatar_item_save", { input: command.values }));
    case "item_grant":
      return unwrap(await client.rpc("avatar_item_grant", { input: { userId: command.userId, itemId: command.itemId } }));
    case "achievement_item":
      return unwrap(await client.rpc("achievement_reward_item_set", { input: { code: command.code, itemId: command.itemId } }));
    case "import_stage": {
      // El archivo se lee y valida acá; la base vuelve a validar cada fila (vista previa exacta, sin escribir nada).
      const parsed = parseCatalogCsv(command.csv);
      if (parsed.rows.length === 0)
        return { id: null, created: 0, updated: 0, unchanged: 0, errors: parsed.errors, preview: [] } satisfies Omit<ImportPreview, "id"> & { id: null };
      const staged = unwrap<ImportPreview>(
        await client.rpc("catalog_import_stage", {
          input: { filename: command.filename, rows: parsed.rows, errors: parsed.errors },
        }),
      );
      // La base numera las filas dentro del lote; se traduce a la línea del archivo para que el error se encuentre fácil.
      const lineOf = (n?: number) => (n ? parsed.lines[n - 1] ?? n : undefined);
      return {
        ...staged,
        errors: staged.errors.map((e, i) => (i < parsed.errors.length ? e : { ...e, line: lineOf(e.line) })),
        preview: staged.preview.map((p) => ({ ...p, line: lineOf(p.line) ?? p.line })),
      };
    }
    case "import_apply":
      return unwrap(await client.rpc("catalog_import_apply", { import: command.importId }));
    case "import_discard":
      return unwrap(await client.rpc("catalog_import_discard", { import: command.importId }));
    case "story_moderate":
      return unwrap(
        await client.rpc("story_moderate", { story: command.storyId, hide: command.hide, reason: command.reason ?? null }),
      );
  }
}
