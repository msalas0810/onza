import type { AvatarCard, Rarity, Slot } from "../types";
import styles from "./game.module.css";

type Look = { sku: string; asset_ref: string | null; preview_ref?: string | null; rarity?: Rarity };

/** Color provisional estable por sku (HSL derivado de un hash). Solo se usa mientras no haya diseño definitivo. */
function hue(sku: string) {
  let h = 0;
  for (let i = 0; i < sku.length; i++) h = (h * 31 + sku.charCodeAt(i)) % 360;
  return h;
}
const fill = (sku: string, l = 55) => `hsl(${hue(sku)} 55% ${l}%)`;

/** Una referencia de diseño: ruta relativa (carpeta pública) o URL https. El CSP decide qué orígenes se cargan. */
export function assetUrl(ref: string | null | undefined) {
  if (!ref) return null;
  return ref.startsWith("https://") ? ref : `/${ref.replace(/^\/+/, "")}`;
}

const SKIN: Record<string, string> = {
  "tone-1": "#f1c9a5",
  "tone-2": "#d9a679",
  "tone-3": "#b97c52",
  "tone-4": "#8d5a3b",
  "tone-5": "#5e3a26",
};

/** Capa de un artículo equipado: imagen definitiva si existe; si no, una forma provisional según la ranura. */
function Layer({ slot, look }: { slot: Slot; look: Look }) {
  const url = assetUrl(look.asset_ref);
  if (url) return <image href={url} x="0" y="0" width="120" height="160" preserveAspectRatio="xMidYMid meet" />;
  const c = fill(look.sku);
  switch (slot) {
    case "background":
      return <rect x="0" y="0" width="120" height="160" fill={fill(look.sku, 82)} />;
    case "effect":
      return <circle cx="60" cy="80" r="56" fill="none" stroke={c} strokeWidth="3" strokeDasharray="6 6" />;
    case "hair":
      return <path d="M40 38c0-16 12-24 20-24s20 8 20 24c-8-8-32-8-40 0z" fill={c} />;
    case "hat":
      return (
        <g fill={c}>
          <rect x="38" y="22" width="44" height="12" rx="4" />
          <rect x="30" y="32" width="60" height="5" rx="2.5" />
        </g>
      );
    case "glasses":
      return (
        <g fill="none" stroke={c} strokeWidth="3">
          <circle cx="50" cy="48" r="7" />
          <circle cx="70" cy="48" r="7" />
          <path d="M57 48h6" />
        </g>
      );
    case "top":
      return <rect x="36" y="66" width="48" height="42" rx="8" fill={c} />;
    case "jacket":
      return (
        <g fill={c}>
          <rect x="32" y="64" width="56" height="46" rx="8" />
          <rect x="58" y="64" width="4" height="46" fill="rgba(0,0,0,.25)" />
        </g>
      );
    case "bottom":
      return <rect x="40" y="106" width="40" height="34" rx="6" fill={c} />;
    case "shoes":
      return (
        <g fill={c}>
          <rect x="38" y="140" width="20" height="10" rx="5" />
          <rect x="62" y="140" width="20" height="10" rx="5" />
        </g>
      );
    case "accessory":
      return <circle cx="60" cy="70" r="5" fill={c} />;
    case "expression":
      return <path d="M52 58q8 8 16 0" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" />;
    case "animation":
      return <path d="M14 20l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" fill={c} />;
  }
}

/** Orden de dibujo, de atrás hacia adelante. */
const ORDER: Slot[] = ["background", "effect", "bottom", "shoes", "top", "jacket", "hair", "glasses", "hat", "expression", "accessory", "animation"];

/**
 * Avatar provisional. Lee solo la tarjeta pública (base + artículos equipados con sus referencias de diseño): cuando los
 * diseños definitivos entren por CSV, esta vista los muestra sin ningún cambio en la lógica de negocio.
 */
export function AvatarView({ card, size = 120, label }: { card: Pick<AvatarCard, "base" | "equipped">; size?: number; label?: string }) {
  const skin = SKIN[card.base.skin] ?? SKIN["tone-1"];
  const wide = card.base.body === "b" ? 6 : 0;
  return (
    <svg
      className={styles.avatar}
      width={size}
      height={(size * 160) / 120}
      viewBox="0 0 120 160"
      role="img"
      aria-label={label ?? "Avatar"}
    >
      {card.equipped.background && <Layer slot="background" look={card.equipped.background} />}
      {card.equipped.effect && <Layer slot="effect" look={card.equipped.effect} />}
      <g>
        <rect x={42 - wide} y="64" width={36 + wide * 2} height="48" rx="10" fill={skin} />
        <circle cx="60" cy="44" r="22" fill={skin} />
        <circle cx="52" cy="44" r="2" fill="#222" />
        <circle cx="68" cy="44" r="2" fill="#222" />
        <rect x="44" y="108" width="12" height="34" rx="5" fill={skin} />
        <rect x="64" y="108" width="12" height="34" rx="5" fill={skin} />
      </g>
      {ORDER.filter((s) => s !== "background" && s !== "effect").map((slot) => {
        const look = card.equipped[slot];
        return look ? <Layer key={slot} slot={slot} look={look} /> : null;
      })}
    </svg>
  );
}

/** Miniatura de un artículo del catálogo (vista previa definitiva si existe; si no, la forma provisional). */
export function ItemThumb({ slot, look, size = 96 }: { slot: Slot; look: Look; size?: number }) {
  const preview = assetUrl(look.preview_ref) ?? assetUrl(look.asset_ref);
  return (
    <svg
      className={styles.avatar}
      data-rarity={look.rarity ?? "common"}
      width={size}
      height={(size * 160) / 120}
      viewBox="0 0 120 160"
      role="img"
      aria-label={`Vista previa de ${look.sku}`}
    >
      <rect x="0" y="0" width="120" height="160" fill="var(--onza-surface-raised)" />
      {preview ? (
        <image href={preview} x="0" y="0" width="120" height="160" preserveAspectRatio="xMidYMid meet" />
      ) : (
        <Layer slot={slot} look={{ sku: look.sku, asset_ref: null }} />
      )}
    </svg>
  );
}
