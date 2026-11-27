"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice, SegmentedControl, Toggle } from "@/components/ui/primitives";
import { SLOT_LABELS, SLOTS, type AvatarMe, type Slot } from "../types";
import { gameApi } from "../client-api";
import { AvatarView } from "./avatar-view";
import styles from "./game.module.css";

const SKINS = ["tone-1", "tone-2", "tone-3", "tone-4", "tone-5"] as const;
const BODIES = [
  { value: "a", label: "Cuerpo A" },
  { value: "b", label: "Cuerpo B" },
] as const;

/** Personalización del avatar: cuerpo base, artículos por ranura y privacidad. Cada cambio se guarda al instante en la base. */
export function AvatarEditor({ me }: { me: AvatarMe }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function save(action: Record<string, unknown>, ok: string) {
    setBusy(true);
    setError("");
    setSaved("");
    const result = await gameApi(action);
    setBusy(false);
    if (result.ok) {
      setSaved(ok);
      router.refresh();
    } else setError(result.message);
  }

  const bySlot = (slot: Slot) => me.owned.filter((item) => item.category === slot);

  return (
    <div className="stack">
      <div className={styles.editor}>
        <div className="stack tight">
          <AvatarView card={me} size={200} label={`Avatar de @${me.username}`} />
          <p className={styles.muted}>
            @{me.username} · Nivel {me.level}
          </p>
        </div>
        <div className="stack">
          <section className="stack tight" aria-labelledby="base-title">
            <h2 id="base-title">Cuerpo</h2>
            <SegmentedControl
              label="Cuerpo base"
              value={me.base.body}
              options={BODIES}
              onChange={(body) => save({ action: "base", skin: me.base.skin, body }, "Cuerpo guardado.")}
            />
            <div className="row" role="group" aria-label="Tono de piel">
              {SKINS.map((skin) => (
                <button
                  key={skin}
                  type="button"
                  className="chip"
                  aria-current={me.base.skin === skin}
                  disabled={busy}
                  onClick={() => save({ action: "base", skin, body: me.base.body }, "Tono guardado.")}
                >
                  {skin.replace("tone-", "Tono ")}
                </button>
              ))}
            </div>
          </section>

          <section className="stack tight" aria-labelledby="slots-title">
            <h2 id="slots-title">Artículos</h2>
            {me.owned.length === 0 && <p className={styles.muted}>Todavía no tenés artículos. Visitá la tienda para conseguir el primero.</p>}
            <div className={styles.slots}>
              {SLOTS.map((slot) => {
                const owned = bySlot(slot);
                if (owned.length === 0) return null;
                const current = me.equipped[slot]?.item_id ?? "";
                return (
                  <label key={slot} className="field">
                    <span>{SLOT_LABELS[slot]}</span>
                    <select
                      value={current}
                      disabled={busy}
                      onChange={(e) =>
                        save({ action: "equip", slot, itemId: e.target.value || null }, e.target.value ? "Artículo equipado." : "Artículo quitado.")
                      }
                    >
                      <option value="">Ninguno</option>
                      {owned.map((item) => (
                        <option key={item.item_id} value={item.item_id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="stack tight" aria-labelledby="privacy-title">
            <h2 id="privacy-title">Privacidad</h2>
            <SegmentedControl
              label="Quién ve tu avatar cuando estás en un bar"
              value={me.presence}
              options={[
                { value: "friends", label: "Amistades" },
                { value: "everyone", label: "Todos" },
                { value: "nobody", label: "Nadie" },
              ]}
              onChange={(presence) => save({ action: "privacy", presence, showInRankings: me.show_in_rankings }, "Privacidad guardada.")}
            />
            <p className={styles.muted}>
              Solo aparecés en un bar si marcás «Estoy acá» y activás compartir. «Nadie» te oculta aunque lo hagas.
            </p>
            <Toggle
              label="Aparecer en el ranking de cada bar"
              checked={me.show_in_rankings}
              disabled={busy}
              onChange={(showInRankings) => save({ action: "privacy", presence: me.presence, showInRankings }, "Privacidad guardada.")}
            />
          </section>
        </div>
      </div>
      <div aria-live="polite">
        {error && (
          <Notice tone="danger" title="No se pudo guardar">
            {error}
          </Notice>
        )}
        {saved && !error && <p className={styles.muted}>{saved}</p>}
      </div>
      <Button variant="secondary" onClick={() => router.push("/tienda")}>
        Ir a la tienda
      </Button>
    </div>
  );
}
