"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Lock } from "lucide-react";
import { Button, Notice, StatusBadge } from "@/components/ui/primitives";
import { RARITY_LABELS, SLOT_LABELS, SLOTS, type CoinPackages, type Slot, type StoreView } from "../types";
import { coinsApi, gameApi } from "../client-api";
import { ItemThumb } from "./avatar-view";
import styles from "./game.module.css";

/** Tienda de artículos digitales: se compra solo con Avatar Coins (nunca con cashback ni dinero). */
export function StorePanel({ store, packages }: { store: StoreView; packages: CoinPackages }) {
  const router = useRouter();
  const [category, setCategory] = useState<Slot | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const items = useMemo(
    () => store.items.filter((item) => category === "all" || item.category === category),
    [store.items, category],
  );

  async function run(id: string, action: Record<string, unknown>, ok: string) {
    setBusy(id);
    setMessage(null);
    const result = await gameApi(action);
    setBusy(null);
    if (result.ok) {
      setMessage({ tone: "success", text: ok });
      router.refresh();
    } else setMessage({ tone: "danger", text: result.message });
  }

  async function buyPackage(code: string) {
    setBusy(code);
    setMessage(null);
    const result = await coinsApi({ package: code, idempotency: `${code}-${crypto.randomUUID()}` });
    setBusy(null);
    if (result.ok) {
      setMessage({ tone: "success", text: "Compra simulada acreditada (demo, sin cobro real)." });
      router.refresh();
    } else setMessage({ tone: "danger", text: result.message });
  }

  return (
    <div className="stack">
      <div className={styles.wallet}>
        <div className={styles.metric}>
          <span className={styles.muted}>Avatar Coins</span>
          <strong>
            <Coins size={20} aria-hidden="true" /> {store.coins}
          </strong>
        </div>
        <div className={styles.metric}>
          <span className={styles.muted}>Tu nivel</span>
          <strong>{store.level}</strong>
        </div>
        <p className={`${styles.muted} ${styles.grow}`}>
          Las Avatar Coins solo sirven para artículos digitales. No se pueden cambiar por dinero ni por cashback.
        </p>
      </div>

      {message && (
        <div aria-live="polite">
          <Notice tone={message.tone === "success" ? "success" : "danger"} title={message.tone === "success" ? "Listo" : "No se pudo"}>
            {message.text}
          </Notice>
        </div>
      )}

      <nav className="chips" aria-label="Categorías">
        <button type="button" className="chip" aria-current={category === "all"} onClick={() => setCategory("all")}>
          Todo
        </button>
        {SLOTS.map((slot) => (
          <button key={slot} type="button" className="chip" aria-current={category === slot} onClick={() => setCategory(slot)}>
            {SLOT_LABELS[slot]}
          </button>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className={styles.muted}>No hay artículos en esta categoría todavía.</p>
      ) : (
        <ul className={styles.grid} style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((item) => {
            const locked = item.locked_by_level;
            return (
              <li key={item.item_id} className={`${styles.card} ${locked ? styles.locked : ""}`}>
                <ItemThumb slot={item.category} look={item} />
                <h3>{item.name}</h3>
                <div className={styles.row}>
                  <StatusBadge tone="neutral">{RARITY_LABELS[item.rarity]}</StatusBadge>
                  {item.season && <StatusBadge tone="neutral">{item.season}</StatusBadge>}
                </div>
                <p className={styles.muted}>
                  {item.exclusive ? "Exclusivo" : `${item.price_coins} monedas`}
                  {item.min_level > 1 && ` · Nivel ${item.min_level}`}
                </p>
                {item.owned ? (
                  item.equipped ? (
                    <Button variant="secondary" size="sm" block disabled>
                      Equipado
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      block
                      loading={busy === item.item_id}
                      onClick={() => run(item.item_id, { action: "equip", slot: item.category, itemId: item.item_id }, `Equipaste ${item.name}.`)}
                    >
                      Equipar
                    </Button>
                  )
                ) : item.exclusive ? (
                  <Button variant="secondary" size="sm" block disabled>
                    <Lock size={16} aria-hidden="true" /> Solo por logros
                  </Button>
                ) : locked ? (
                  <Button variant="secondary" size="sm" block disabled>
                    <Lock size={16} aria-hidden="true" /> Nivel {item.min_level}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    block
                    loading={busy === item.item_id}
                    disabled={item.price_coins > store.coins}
                    onClick={() => run(item.item_id, { action: "buy", itemId: item.item_id }, `Compraste ${item.name}.`)}
                  >
                    Comprar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <h2 className={styles.sectionTitle}>Conseguir más monedas</h2>
      {packages.purchases_enabled && packages.packages.length > 0 ? (
        <div className="stack tight">
          <Notice tone="warning" title="Compra simulada">
            Los cobros reales todavía no están habilitados: esta compra es una simulación de demostración.
          </Notice>
          <ul className={styles.grid} style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {packages.packages.map((p) => (
              <li key={p.code} className={styles.card}>
                <h3>{p.name}</h3>
                <p>
                  {p.coins}
                  {p.bonus_coins > 0 && ` + ${p.bonus_coins} de regalo`} monedas
                </p>
                <p className={styles.muted}>₡{(p.price_minor / 100).toLocaleString("es-CR")}</p>
                <Button size="sm" block loading={busy === p.code} onClick={() => buyPackage(p.code)}>
                  Comprar (simulado)
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.muted}>
          La compra de monedas todavía no está disponible. Mientras tanto, ganás monedas con tus pedidos entregados, tus visitas y tus logros.
        </p>
      )}
    </div>
  );
}
