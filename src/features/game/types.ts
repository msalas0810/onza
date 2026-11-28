import { z } from "zod";
import type { Json } from "@/lib/supabase/database.generated";

/** Ranuras del avatar. Cada artículo se equipa en la ranura de su categoría. */
export const SLOTS = [
  "hat",
  "glasses",
  "hair",
  "top",
  "jacket",
  "bottom",
  "shoes",
  "accessory",
  "expression",
  "animation",
  "background",
  "effect",
] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_LABELS: Record<Slot, string> = {
  hat: "Sombreros y gorras",
  glasses: "Lentes",
  hair: "Peinados",
  top: "Camisas",
  jacket: "Chaquetas",
  bottom: "Pantalones",
  shoes: "Zapatos",
  accessory: "Accesorios",
  expression: "Expresiones",
  animation: "Animaciones",
  background: "Fondos",
  effect: "Efectos",
};
export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];
export const RARITY_LABELS: Record<Rarity, string> = {
  common: "Común",
  rare: "Raro",
  epic: "Épico",
  legendary: "Legendario",
};

export type EquippedItem = {
  item_id: string;
  sku: string;
  name: string;
  rarity: Rarity;
  asset_ref: string | null;
  preview_ref: string | null;
};
export type AvatarCard = {
  user_id: string;
  username: string;
  level: number;
  base: { skin: string; body: string };
  equipped: Partial<Record<Slot, EquippedItem>>;
};
export type OwnedItem = {
  item_id: string;
  sku: string;
  name: string;
  category: Slot;
  rarity: Rarity;
  asset_ref: string | null;
  preview_ref: string | null;
  status: string;
};
export type AvatarMe = AvatarCard & {
  presence: "everyone" | "friends" | "nobody";
  show_in_rankings: boolean;
  owned: OwnedItem[];
};
export type StoreItem = {
  item_id: string;
  sku: string;
  name: string;
  category: Slot;
  price_coins: number;
  rarity: Rarity;
  season: string | null;
  exclusive: boolean;
  min_level: number;
  asset_ref: string | null;
  preview_ref: string | null;
  available_until: string | null;
  owned: boolean;
  locked_by_level: boolean;
  equipped: boolean;
};
export type StoreView = { coins: number; level: number; items: StoreItem[] };
export type Wallet = {
  coins: number;
  xp: number;
  level: number;
  level_title: string;
  level_xp: number;
  next_level: { level: number; title: string; xp_required: number } | null;
  venues_unlocked: number;
  coin_history: { kind: string; amount: number; balance_after: number; reason: string; at: string }[];
  xp_history: { kind: string; amount: number; total_after: number; reason: string; at: string }[];
  achievements: {
    code: string;
    name: string;
    description: string;
    metric: string;
    threshold: number;
    progress: number;
    unlocked_at: string | null;
  }[];
};
export type CoinPackages = {
  purchases_enabled: boolean;
  packages: { code: string; name: string; coins: number; bonus_coins: number; price_minor: number; currency: string }[];
};
export type LeaderboardEntry = { rank: number; me: boolean; value?: number; visits?: number; avatar: AvatarCard };
export type VenueBoard = { venue_id: string; participating: boolean; entries: LeaderboardEntry[] };
export type BarMap = {
  unlocked: number;
  total: number;
  venues: {
    venueId: string;
    slug: string;
    zone: string;
    latitude: number | null;
    longitude: number | null;
    unlocked: boolean;
    name: string | null;
    visits: number;
    first_visit_at: string | null;
  }[];
};
export type Presence = { venue_id: string; total_active: number | null; people: AvatarCard[] };
export type Story = {
  id: string;
  mine: boolean;
  author: AvatarCard;
  venue_id: string;
  venue_slug: string;
  venue_name: string;
  product_id: string | null;
  product_link: string | null;
  media_path: string;
  media_type: "image" | "video";
  caption: string;
  created_at: string;
  expires_at: string;
};

const uuid = z.string().uuid();
const slug = /^[a-z0-9-]{1,20}$/;
/** Acciones del jugador. Todo se vuelve a validar en la base; esto solo acota lo que llega al servidor. */
export const gameActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("buy"), itemId: uuid }),
  z.object({ action: z.literal("equip"), slot: z.enum(SLOTS), itemId: uuid.nullable() }),
  z.object({ action: z.literal("base"), skin: z.string().regex(slug), body: z.string().regex(slug) }),
  z.object({
    action: z.literal("privacy"),
    presence: z.enum(["everyone", "friends", "nobody"]),
    showInRankings: z.boolean(),
  }),
  z.object({
    action: z.literal("story_create"),
    venueId: uuid,
    productId: uuid.nullish(),
    mediaPath: z.string().max(200),
    mediaType: z.enum(["image", "video"]),
    caption: z.string().max(200).default(""),
    visibility: z.enum(["friends", "public"]).default("friends"),
  }),
  z.object({ action: z.literal("story_delete"), storyId: uuid }),
  z.object({ action: z.literal("story_report"), storyId: uuid, reason: z.string().min(3).max(200) }),
]);
export type GameAction = z.infer<typeof gameActionSchema>;

/** Valor JSON arbitrario (para campos que la base valida a su manera). */
export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonSchema), z.record(z.string(), jsonSchema)]),
);
