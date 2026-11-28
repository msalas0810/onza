import "server-only";
import { serverDb } from "@/lib/supabase/server";
import { adminDb } from "@/lib/supabase/admin";
import { assertMockPayments } from "@/features/payments/server/provider";
import {
  gameActionSchema,
  type AvatarMe,
  type BarMap,
  type CoinPackages,
  type Presence,
  type Story,
  type StoreView,
  type VenueBoard,
  type Wallet,
  type LeaderboardEntry,
} from "../types";

/** Todo el juego social pasa por funciones de la base que validan cuenta, edad y alcance (migraciones 029–032). */
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

export async function getWallet() {
  return unwrap<Wallet>(await (await db()).rpc("economy_wallet"));
}
export async function getCoinPackages() {
  return unwrap<CoinPackages>(await (await db()).rpc("coin_packages_list"));
}
export async function getStore(category?: string) {
  return unwrap<StoreView>(await (await db()).rpc("avatar_store", { category: category ?? null }));
}
export async function getAvatarMe() {
  return unwrap<AvatarMe>(await (await db()).rpc("avatar_me"));
}
export async function getFriendsBoard(metric: "xp" | "venues" | "achievements") {
  return unwrap<LeaderboardEntry[]>(await (await db()).rpc("social_leaderboard_friends", { metric }));
}
export async function getVenueBoard(venueId: string) {
  return unwrap<VenueBoard>(await (await db()).rpc("venue_leaderboard", { venue: venueId }));
}
export async function getBarMap() {
  return unwrap<BarMap>(await (await db()).rpc("social_bar_map"));
}
export async function getPresence(venueId: string) {
  return unwrap<Presence>(await (await db()).rpc("venue_presence", { venue: venueId }));
}
export async function getStories(scope: "friends" | "venue", venueId?: string) {
  return unwrap<Story[]>(await (await db()).rpc("story_feed", { input: { scope, venueId: venueId ?? null } }));
}

/** Acciones del jugador. Devuelve el resultado de la función de la base (artículo comprado, tarjeta del avatar, etc.). */
export async function runGameAction(raw: unknown) {
  const command = gameActionSchema.parse(raw);
  const client = await db();
  switch (command.action) {
    case "buy":
      return unwrap(await client.rpc("avatar_item_buy", { item: command.itemId }));
    case "equip":
      return unwrap(await client.rpc("avatar_equip", { input: { slot: command.slot, itemId: command.itemId } }));
    case "base":
      return unwrap(await client.rpc("avatar_base_save", { input: { skin: command.skin, body: command.body } }));
    case "privacy":
      return unwrap(
        await client.rpc("avatar_privacy_save", {
          input: { presence: command.presence, show_in_rankings: command.showInRankings },
        }),
      );
    case "story_create":
      return unwrap(
        await client.rpc("story_create", {
          input: {
            venueId: command.venueId,
            productId: command.productId ?? null,
            mediaPath: command.mediaPath,
            mediaType: command.mediaType,
            caption: command.caption,
            visibility: command.visibility,
          },
        }),
      );
    case "story_delete":
      return unwrap(await client.rpc("story_delete", { story: command.storyId }));
    case "story_report":
      return unwrap(await client.rpc("story_report", { story: command.storyId, reason: command.reason }));
  }
}

/**
 * Compra de un paquete de Avatar Coins. Hoy solo con pagos SIMULADOS (demo): `assertMockPayments` falla si el proveedor no es
 * el mock o si los pagos reales están habilitados, y BAC sigue sin configurarse. La compra nace `pending` y solo el servidor,
 * con la clave de servicio, la liquida; el navegador nunca acredita monedas.
 */
export async function purchaseCoins(packageCode: string, idempotency: string) {
  assertMockPayments();
  const created = unwrap<{ id: string; status: string; coins: number; replayed: boolean }>(
    await (await db()).rpc("coins_purchase_create", { package: packageCode, idempotency }),
  );
  if (created.status === "paid") return { ...created, simulated: true };
  const settled = unwrap<{ id: string; status: string; coins?: number }>(
    await adminDb().rpc("coins_purchase_settle", {
      purchase: created.id,
      provider: "mock",
      provider_ref: `mock-${created.id}`,
    }),
  );
  return { ...created, ...settled, simulated: true };
}
