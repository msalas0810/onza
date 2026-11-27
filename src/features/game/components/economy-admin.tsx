"use client";
import { useState } from "react";
import { Button, Notice, TextField, Toggle } from "@/components/ui/primitives";
import type { EconomyOverview } from "../server/onza-service";
import { useOnza } from "./use-onza";
import styles from "./game.module.css";

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
const EVENT_LABELS: Record<string, string> = {
  first_visit: "Primera visita a un bar",
  checkin: "Check-in «Estoy acá»",
  friend_accepted: "Amistad aceptada",
  story_posted: "Drink Story publicada",
  gift_sent: "Trago enviado",
  gift_received: "Trago recibido",
};
const METRICS = ["orders", "venues", "checkins", "friends", "stories", "level"] as const;
const METRIC_LABELS: Record<(typeof METRICS)[number], string> = {
  orders: "Pedidos entregados",
  venues: "Bares visitados",
  checkins: "Check-ins",
  friends: "Amistades",
  stories: "Historias",
  level: "Nivel",
};
const STAT_LABELS: Record<string, string> = {
  coins_earned: "Monedas ganadas",
  coins_purchased: "Monedas compradas",
  coins_spent: "Monedas gastadas",
  coins_revoked: "Monedas revertidas",
  coins_in_circulation: "Monedas en circulación",
  xp_earned: "XP otorgado",
  players: "Jugadores",
  purchases_paid: "Compras pagadas",
  revenue_minor: "Ingresos (₡)",
};

export function EconomyAdmin({ data, items }: { data: EconomyOverview; items: { id: string; name: string; sku: string }[] }) {
  const { run, busy, message } = useOnza();
  const s = data.settings;
  const [settings, setSettings] = useState({
    crc_per_coin: String(s.crc_per_coin),
    max_order_reward_minor: String(s.max_order_reward_minor),
    max_rewarded_orders_per_day: String(s.max_rewarded_orders_per_day),
    min_minutes_between_rewarded: String(s.min_minutes_between_rewarded),
    xp_per_order: String(s.xp_per_order),
    daily_coin_cap: String(s.daily_coin_cap),
    daily_xp_cap: String(s.daily_xp_cap),
    coin_purchases_enabled: Boolean(s.coin_purchases_enabled),
  });
  const [pkg, setPkg] = useState({ code: "", name: "", coins: "", bonus_coins: "0", price: "", sort: "0", enabled: false });
  const [camp, setCamp] = useState({ name: "", coin_multiplier: "2", xp_multiplier: "2", starts_at: "", ends_at: "" });
  const [ach, setAch] = useState({ code: "", name: "", description: "", metric: "orders", threshold: "1", reward_coins: "0", reward_xp: "0" });
  const [rules, setRules] = useState(Object.fromEntries(data.event_rules.map((r) => [r.kind, { coins: String(r.coins), xp: String(r.xp), daily_cap: String(r.daily_cap), enabled: r.enabled }])));
  const [levels, setLevels] = useState(Object.fromEntries(data.levels.map((l) => [l.level, { xp_required: String(l.xp_required), title: l.title }])));
  const command = (entity: string, values: Record<string, unknown>) => ({ command: "economy", entity, values });

  return (
    <div className="stack">
      <div aria-live="polite">
        {message && (
          <Notice tone={message.tone === "success" ? "success" : "danger"} title={message.tone === "success" ? "Guardado" : "No se pudo guardar"}>
            {message.text}
          </Notice>
        )}
      </div>

      <section aria-labelledby="stats-title" className="stack tight">
        <h2 id="stats-title">Estadísticas de monetización</h2>
        <div className={styles.grid}>
          {Object.entries(STAT_LABELS).map(([key, label]) => (
            <div key={key} className={styles.metric}>
              <span className={styles.muted}>{label}</span>
              <strong>{key === "revenue_minor" ? Math.round((data.stats[key] ?? 0) / 100).toLocaleString("es-CR") : (data.stats[key] ?? 0).toLocaleString("es-CR")}</strong>
            </div>
          ))}
        </div>
        <p className={styles.muted}>Cashback, Avatar Coins y XP son tres sistemas separados: cada uno tiene su propio libro.</p>
      </section>

      <section aria-labelledby="settings-title" className="stack tight">
        <h2 id="settings-title">Ajustes y límites anti-exceso</h2>
        <div className={styles.form}>
          <TextField label="₡ por moneda" type="number" min={1} value={settings.crc_per_coin} onChange={(e) => setSettings({ ...settings, crc_per_coin: e.target.value })} />
          <TextField label="Tope de importe que premia (minor)" type="number" min={0} value={settings.max_order_reward_minor} onChange={(e) => setSettings({ ...settings, max_order_reward_minor: e.target.value })} />
          <TextField label="Pedidos premiados por día" type="number" min={0} value={settings.max_rewarded_orders_per_day} onChange={(e) => setSettings({ ...settings, max_rewarded_orders_per_day: e.target.value })} />
          <TextField label="Minutos entre pedidos premiados" type="number" min={0} value={settings.min_minutes_between_rewarded} onChange={(e) => setSettings({ ...settings, min_minutes_between_rewarded: e.target.value })} />
          <TextField label="XP por pedido" type="number" min={0} value={settings.xp_per_order} onChange={(e) => setSettings({ ...settings, xp_per_order: e.target.value })} />
          <TextField label="Tope diario de monedas" type="number" min={0} value={settings.daily_coin_cap} onChange={(e) => setSettings({ ...settings, daily_coin_cap: e.target.value })} />
          <TextField label="Tope diario de XP" type="number" min={0} value={settings.daily_xp_cap} onChange={(e) => setSettings({ ...settings, daily_xp_cap: e.target.value })} />
        </div>
        <Toggle label="Permitir comprar paquetes de monedas (hoy solo con pago simulado)" checked={settings.coin_purchases_enabled} onChange={(v) => setSettings({ ...settings, coin_purchases_enabled: v })} />
        <Button
          loading={busy === "settings"}
          onClick={() =>
            run("settings", command("settings", {
              crc_per_coin: num(settings.crc_per_coin),
              max_order_reward_minor: num(settings.max_order_reward_minor),
              max_rewarded_orders_per_day: num(settings.max_rewarded_orders_per_day),
              min_minutes_between_rewarded: num(settings.min_minutes_between_rewarded),
              xp_per_order: num(settings.xp_per_order),
              daily_coin_cap: num(settings.daily_coin_cap),
              daily_xp_cap: num(settings.daily_xp_cap),
              coin_purchases_enabled: settings.coin_purchases_enabled,
            }), "Ajustes guardados.")
          }
        >
          Guardar ajustes
        </Button>
      </section>

      <section aria-labelledby="events-title" className="stack tight">
        <h2 id="events-title">Recompensas por actividad</h2>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead><tr><th>Evento</th><th className={styles.num}>Monedas</th><th className={styles.num}>XP</th><th className={styles.num}>Tope/día</th><th>Activo</th><th /></tr></thead>
            <tbody>
              {data.event_rules.map((r) => {
                const v = rules[r.kind];
                return (
                  <tr key={r.kind}>
                    <td>{EVENT_LABELS[r.kind] ?? r.kind}</td>
                    <td><input aria-label={`Monedas: ${r.kind}`} type="number" min={0} style={{ width: 72 }} value={v.coins} onChange={(e) => setRules({ ...rules, [r.kind]: { ...v, coins: e.target.value } })} /></td>
                    <td><input aria-label={`XP: ${r.kind}`} type="number" min={0} style={{ width: 72 }} value={v.xp} onChange={(e) => setRules({ ...rules, [r.kind]: { ...v, xp: e.target.value } })} /></td>
                    <td><input aria-label={`Tope diario: ${r.kind}`} type="number" min={0} style={{ width: 72 }} value={v.daily_cap} onChange={(e) => setRules({ ...rules, [r.kind]: { ...v, daily_cap: e.target.value } })} /></td>
                    <td><input aria-label={`Activo: ${r.kind}`} type="checkbox" checked={v.enabled} onChange={(e) => setRules({ ...rules, [r.kind]: { ...v, enabled: e.target.checked } })} /></td>
                    <td><Button size="sm" variant="secondary" loading={busy === `rule-${r.kind}`} onClick={() => run(`rule-${r.kind}`, command("event_rule", { kind: r.kind, coins: num(v.coins), xp: num(v.xp), daily_cap: num(v.daily_cap), enabled: v.enabled }), "Regla guardada.")}>Guardar</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="packages-title" className="stack tight">
        <h2 id="packages-title">Paquetes de Avatar Coins</h2>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead><tr><th>Código</th><th>Nombre</th><th className={styles.num}>Monedas</th><th className={styles.num}>Regalo</th><th className={styles.num}>Precio ₡</th><th>Activo</th></tr></thead>
            <tbody>
              {data.packages.map((p) => (
                <tr key={p.id}>
                  <td>{p.code}</td><td>{p.name}</td><td className={styles.num}>{p.coins}</td><td className={styles.num}>{p.bonus_coins}</td>
                  <td className={styles.num}>{(p.price_minor / 100).toLocaleString("es-CR")}</td><td>{p.enabled ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.form}>
          <TextField label="Código" value={pkg.code} onChange={(e) => setPkg({ ...pkg, code: e.target.value })} hint="minúsculas, números y _" />
          <TextField label="Nombre" value={pkg.name} onChange={(e) => setPkg({ ...pkg, name: e.target.value })} />
          <TextField label="Monedas" type="number" min={1} value={pkg.coins} onChange={(e) => setPkg({ ...pkg, coins: e.target.value })} />
          <TextField label="Monedas de regalo" type="number" min={0} value={pkg.bonus_coins} onChange={(e) => setPkg({ ...pkg, bonus_coins: e.target.value })} />
          <TextField label="Precio en ₡" type="number" min={1} value={pkg.price} onChange={(e) => setPkg({ ...pkg, price: e.target.value })} />
          <TextField label="Orden" type="number" value={pkg.sort} onChange={(e) => setPkg({ ...pkg, sort: e.target.value })} />
        </div>
        <Toggle label="Paquete activo" checked={pkg.enabled} onChange={(v) => setPkg({ ...pkg, enabled: v })} />
        <Button
          loading={busy === "package"}
          onClick={() =>
            run("package", command("package", { code: pkg.code, name: pkg.name, coins: num(pkg.coins), bonus_coins: num(pkg.bonus_coins), price_minor: pkg.price === "" ? undefined : Math.round(Number(pkg.price) * 100), enabled: pkg.enabled, sort: num(pkg.sort) }), "Paquete guardado.")
          }
        >
          Guardar paquete (crea o actualiza por código)
        </Button>
      </section>

      <section aria-labelledby="camp-title" className="stack tight">
        <h2 id="camp-title">Campañas de multiplicadores</h2>
        {data.campaigns.length === 0 ? <p className={styles.muted}>No hay campañas.</p> : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.campaigns.map((c) => (
              <li key={c.id} className={styles.entry}>
                <span className={styles.grow}>{c.name} · ×{c.coin_multiplier} monedas, ×{c.xp_multiplier} XP · {new Date(c.starts_at).toLocaleDateString("es-CR")} – {new Date(c.ends_at).toLocaleDateString("es-CR")}</span>
                <Button size="sm" variant="secondary" loading={busy === `camp-${c.id}`} onClick={() => run(`camp-${c.id}`, command("campaign", { id: c.id, enabled: !c.enabled }), c.enabled ? "Campaña pausada." : "Campaña activada.")}>{c.enabled ? "Pausar" : "Activar"}</Button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.form}>
          <TextField label="Nombre" value={camp.name} onChange={(e) => setCamp({ ...camp, name: e.target.value })} />
          <TextField label="× monedas" type="number" min={1} max={5} step={0.5} value={camp.coin_multiplier} onChange={(e) => setCamp({ ...camp, coin_multiplier: e.target.value })} />
          <TextField label="× XP" type="number" min={1} max={5} step={0.5} value={camp.xp_multiplier} onChange={(e) => setCamp({ ...camp, xp_multiplier: e.target.value })} />
          <TextField label="Desde" type="datetime-local" value={camp.starts_at} onChange={(e) => setCamp({ ...camp, starts_at: e.target.value })} />
          <TextField label="Hasta" type="datetime-local" value={camp.ends_at} onChange={(e) => setCamp({ ...camp, ends_at: e.target.value })} />
        </div>
        <Button loading={busy === "camp"} disabled={!camp.name || !camp.starts_at || !camp.ends_at}
          onClick={() => run("camp", command("campaign", { name: camp.name, coin_multiplier: num(camp.coin_multiplier), xp_multiplier: num(camp.xp_multiplier), starts_at: new Date(camp.starts_at).toISOString(), ends_at: new Date(camp.ends_at).toISOString() }), "Campaña creada.")}>
          Crear campaña
        </Button>
      </section>

      <section aria-labelledby="levels-title" className="stack tight">
        <h2 id="levels-title">Niveles</h2>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead><tr><th className={styles.num}>Nivel</th><th className={styles.num}>XP necesario</th><th>Título</th><th /></tr></thead>
            <tbody>
              {data.levels.map((l) => {
                const v = levels[l.level];
                return (
                  <tr key={l.level}>
                    <td className={styles.num}>{l.level}</td>
                    <td><input aria-label={`XP del nivel ${l.level}`} type="number" min={0} style={{ width: 96 }} value={v.xp_required} onChange={(e) => setLevels({ ...levels, [l.level]: { ...v, xp_required: e.target.value } })} /></td>
                    <td><input aria-label={`Título del nivel ${l.level}`} maxLength={40} value={v.title} onChange={(e) => setLevels({ ...levels, [l.level]: { ...v, title: e.target.value } })} /></td>
                    <td><Button size="sm" variant="secondary" loading={busy === `lvl-${l.level}`} onClick={() => run(`lvl-${l.level}`, command("level", { level: l.level, xp_required: num(v.xp_required), title: v.title }), "Nivel guardado.")}>Guardar</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ach-title" className="stack tight">
        <h2 id="ach-title">Logros</h2>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead><tr><th>Logro</th><th>Se gana con</th><th className={styles.num}>Monedas</th><th className={styles.num}>XP</th><th>Artículo</th><th>Activo</th></tr></thead>
            <tbody>
              {data.achievements.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}<br /><span className={styles.muted}>{a.code}</span></td>
                  <td>{METRIC_LABELS[a.metric as (typeof METRICS)[number]] ?? a.metric} ≥ {a.threshold}</td>
                  <td className={styles.num}>{a.reward_coins}</td><td className={styles.num}>{a.reward_xp}</td>
                  <td>
                    <select aria-label={`Artículo de recompensa de ${a.name}`} value={a.reward_item_id ?? ""} disabled={busy === `ai-${a.code}`}
                      onChange={(e) => run(`ai-${a.code}`, { command: "achievement_item", code: a.code, itemId: e.target.value || null }, "Recompensa guardada.")}>
                      <option value="">Ninguno</option>
                      {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </td>
                  <td>{a.enabled ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.form}>
          <TextField label="Código" value={ach.code} onChange={(e) => setAch({ ...ach, code: e.target.value })} hint="minúsculas, números y _" />
          <TextField label="Nombre" value={ach.name} onChange={(e) => setAch({ ...ach, name: e.target.value })} />
          <TextField label="Descripción" value={ach.description} onChange={(e) => setAch({ ...ach, description: e.target.value })} />
          <label className="field"><span>Se gana con</span>
            <select value={ach.metric} onChange={(e) => setAch({ ...ach, metric: e.target.value })}>{METRICS.map((m) => <option key={m} value={m}>{METRIC_LABELS[m]}</option>)}</select>
          </label>
          <TextField label="Cantidad necesaria" type="number" min={1} value={ach.threshold} onChange={(e) => setAch({ ...ach, threshold: e.target.value })} />
          <TextField label="Monedas" type="number" min={0} value={ach.reward_coins} onChange={(e) => setAch({ ...ach, reward_coins: e.target.value })} />
          <TextField label="XP" type="number" min={0} value={ach.reward_xp} onChange={(e) => setAch({ ...ach, reward_xp: e.target.value })} />
        </div>
        <Button loading={busy === "ach"} disabled={!ach.code || !ach.name}
          onClick={() => run("ach", command("achievement", { code: ach.code, name: ach.name, description: ach.description, metric: ach.metric, threshold: num(ach.threshold), reward_coins: num(ach.reward_coins), reward_xp: num(ach.reward_xp) }), "Logro guardado.")}>
          Guardar logro (crea o actualiza por código)
        </Button>
      </section>

      <section aria-labelledby="flags-title" className="stack tight">
        <h2 id="flags-title">Prevención de fraude: señales recientes</h2>
        {data.flags.length === 0 ? <p className={styles.muted}>Sin señales.</p> : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.flags.map((f, i) => (
              <li key={i} className={styles.entry}>
                <span className={styles.grow}><strong>{f.kind}</strong> · {f.user_id ? `${f.user_id.slice(0, 8)}…` : "sin usuario"} · {JSON.stringify(f.details)}</span>
                <span className={styles.muted}>{new Date(f.at).toLocaleString("es-CR")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="audit-title" className="stack tight">
        <h2 id="audit-title">Auditoría de cambios</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {data.audit.map((a, i) => (
            <li key={i} className={styles.entry}>
              <span className={styles.grow}>{a.action} · {a.entity} · {a.key}</span>
              <span className={styles.muted}>{new Date(a.at).toLocaleString("es-CR")}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
