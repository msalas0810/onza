"use client";
import { useCallback, useEffect, useState } from "react";
import { Button, Notice, TextField, Toggle } from "@/components/ui/primitives";
import { loyaltyApi } from "@/features/game/client-api";
import styles from "@/features/game/components/game.module.css";

type Program = { enabled: boolean; base_percent: number; points_valid_days: number };
type Rule = {
  id: string;
  name: string;
  kind: string;
  scope_id: string | null;
  percent: number;
  weekdays: number[] | null;
  hour_from: number | null;
  hour_to: number | null;
  min_amount_minor: number;
  max_points_per_order: number | null;
  active: boolean;
};
type Campaign = {
  id: string;
  name: string;
  funder: string;
  sponsor_name: string | null;
  budget_points: number;
  active: boolean;
  issued_points: number;
  remaining_points: number;
};
type Summary = { issued: number; reversed: number; expired: number; redeemed: number; outstanding: number };
type Loaded = {
  config: { program: Program; rules: Rule[]; campaigns: Campaign[] };
  summary: Summary;
  social: { gifts_enabled: boolean; stories_enabled: boolean };
};
const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Cashback del local: programa, reglas por categoría/horario/día, campañas con presupuesto y resumen. 1 punto = ₡1. */
export function LoyaltyAdmin({ venueId, categories }: { venueId: string; categories: { id: string; label: string }[] }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [program, setProgram] = useState({ enabled: false, basePercent: "0", pointsValidDays: "180" });
  const [rule, setRule] = useState({
    name: "",
    kind: "all",
    scopeId: "",
    percent: "5",
    weekdays: [] as number[],
    hourFrom: "",
    hourTo: "",
    minAmount: "0",
    maxPoints: "",
  });
  const [camp, setCamp] = useState({ name: "", funder: "venue", sponsorName: "", budget: "10000" });

  const apply = useCallback((body: Loaded) => {
    setData(body);
    setProgram({
      enabled: body.config.program.enabled,
      basePercent: String(body.config.program.base_percent),
      pointsValidDays: String(body.config.program.points_valid_days),
    });
  }, []);
  const load = useCallback(async () => {
    const response = await fetch(`/api/loyalty?venueId=${venueId}`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) return setLoadError(body?.message ?? "No pudimos cargar la fidelización.");
    apply(body);
  }, [venueId, apply]);
  useEffect(() => {
    let alive = true;
    fetch(`/api/loyalty?venueId=${venueId}`, { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, body: await response.json().catch(() => null) }))
      .then(({ ok, body }) => {
        if (!alive) return;
        if (!ok) setLoadError(body?.message ?? "No pudimos cargar la fidelización.");
        else apply(body);
      });
    return () => {
      alive = false;
    };
  }, [venueId, apply]);

  async function save(key: string, action: Record<string, unknown>, ok: string) {
    setBusy(key);
    setMessage(null);
    const result = await loyaltyApi(action);
    setBusy(null);
    if (result.ok) {
      setMessage({ tone: "success", text: ok });
      await load();
    } else setMessage({ tone: "danger", text: result.message });
  }
  const optionalNumber = (v: string) => (v.trim() === "" ? null : Number(v));

  if (loadError)
    return (
      <Notice tone="danger" title="No se pudo cargar">
        {loadError}
      </Notice>
    );
  if (!data) return <p className={styles.muted}>Cargando…</p>;
  const s = data.summary;
  return (
    <div className="stack">
      <div aria-live="polite">
        {message && (
          <Notice tone={message.tone === "success" ? "success" : "danger"} title={message.tone === "success" ? "Guardado" : "No se pudo guardar"}>
            {message.text}
          </Notice>
        )}
      </div>

      <section aria-labelledby="loy-sum" className="stack tight">
        <h2 id="loy-sum">Resumen de cashback</h2>
        <div className={styles.grid}>
          {(
            [
              ["Emitido", s.issued],
              ["Revertido", s.reversed],
              ["Vencido", s.expired],
              ["Canjeado", s.redeemed],
              ["Pendiente de canje", s.outstanding],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className={styles.metric}>
              <span className={styles.muted}>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <p className={styles.muted}>
          Los puntos los financia el local (1 punto = ₡1). ONZA no cobra comisión por acumular ni canjear. El canje en el checkout todavía
          no está disponible.
        </p>
      </section>

      <section aria-labelledby="loy-prog" className="stack tight">
        <h2 id="loy-prog">Programa</h2>
        <Toggle label="Cashback activo" checked={program.enabled} onChange={(enabled) => setProgram({ ...program, enabled })} />
        <div className={styles.form}>
          <TextField
            label="Porcentaje base (%)"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={program.basePercent}
            onChange={(e) => setProgram({ ...program, basePercent: e.target.value })}
            hint="0%, 1%, 2%, 5%…"
          />
          <TextField
            label="Los puntos duran (días)"
            type="number"
            min={1}
            max={3650}
            value={program.pointsValidDays}
            onChange={(e) => setProgram({ ...program, pointsValidDays: e.target.value })}
          />
        </div>
        <Button
          loading={busy === "program"}
          onClick={() =>
            save(
              "program",
              { action: "program", input: { venueId, enabled: program.enabled, basePercent: Number(program.basePercent), pointsValidDays: Number(program.pointsValidDays) } },
              "Programa guardado.",
            )
          }
        >
          Guardar programa
        </Button>
      </section>

      <section aria-labelledby="loy-rules" className="stack tight">
        <h2 id="loy-rules">Reglas</h2>
        <p className={styles.muted}>
          Una regla reemplaza al porcentaje base para lo que coincide. Si coinciden varias, gana la de mayor porcentaje. Una regla al 0 % excluye.
        </p>
        {data.config.rules.length === 0 ? (
          <p className={styles.muted}>No hay reglas.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.config.rules.map((r) => (
              <li key={r.id} className={styles.entry}>
                <span className={styles.grow}>
                  <strong>{r.name}</strong> · {r.percent}% · {r.kind === "all" ? "todo el local" : r.kind === "category" ? "categoría" : "producto"}
                  {r.weekdays && ` · ${r.weekdays.map((d) => DAYS[d - 1]).join(", ")}`}
                  {r.hour_from !== null && ` · ${r.hour_from}:00–${r.hour_to}:00`}
                  {!r.active && " · pausada"}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === r.id}
                  onClick={() =>
                    save(
                      r.id,
                      {
                        action: "rule",
                        input: {
                          venueId,
                          id: r.id,
                          name: r.name,
                          kind: r.kind,
                          scopeId: r.scope_id,
                          percent: r.percent,
                          weekdays: r.weekdays,
                          hourFrom: r.hour_from,
                          hourTo: r.hour_to,
                          minAmountMinor: r.min_amount_minor,
                          maxPointsPerOrder: r.max_points_per_order,
                          active: !r.active,
                        },
                      },
                      r.active ? "Regla pausada." : "Regla activada.",
                    )
                  }
                >
                  {r.active ? "Pausar" : "Activar"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.form}>
          <TextField label="Nombre" value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} />
          <label className="field">
            <span>Aplica a</span>
            <select value={rule.kind} onChange={(e) => setRule({ ...rule, kind: e.target.value, scopeId: "" })}>
              <option value="all">Todo el local</option>
              <option value="category">Una categoría</option>
            </select>
          </label>
          {rule.kind === "category" && (
            <label className="field">
              <span>Categoría</span>
              <select value={rule.scopeId} onChange={(e) => setRule({ ...rule, scopeId: e.target.value })}>
                <option value="">Elegí una</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <TextField label="Porcentaje (%)" type="number" min={0} max={100} step={0.5} value={rule.percent} onChange={(e) => setRule({ ...rule, percent: e.target.value })} />
          <TextField label="Desde la hora (0-23)" type="number" min={0} max={23} value={rule.hourFrom} onChange={(e) => setRule({ ...rule, hourFrom: e.target.value })} />
          <TextField label="Hasta la hora (0-23)" type="number" min={0} max={23} value={rule.hourTo} onChange={(e) => setRule({ ...rule, hourTo: e.target.value })} />
          <TextField label="Importe mínimo (₡)" type="number" min={0} value={rule.minAmount} onChange={(e) => setRule({ ...rule, minAmount: e.target.value })} />
          <TextField label="Tope de puntos por pedido" type="number" min={1} value={rule.maxPoints} onChange={(e) => setRule({ ...rule, maxPoints: e.target.value })} />
        </div>
        <div className="row" role="group" aria-label="Días de la semana (vacío = todos)">
          {DAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              className="chip"
              aria-current={rule.weekdays.includes(i + 1)}
              onClick={() =>
                setRule({
                  ...rule,
                  weekdays: rule.weekdays.includes(i + 1) ? rule.weekdays.filter((x) => x !== i + 1) : [...rule.weekdays, i + 1].sort(),
                })
              }
            >
              {d}
            </button>
          ))}
        </div>
        <Button
          loading={busy === "rule"}
          disabled={!rule.name || (rule.kind === "category" && !rule.scopeId)}
          onClick={() =>
            save(
              "rule",
              {
                action: "rule",
                input: {
                  venueId,
                  name: rule.name,
                  kind: rule.kind,
                  scopeId: rule.kind === "all" ? null : rule.scopeId,
                  percent: Number(rule.percent),
                  weekdays: rule.weekdays.length ? rule.weekdays : null,
                  hourFrom: optionalNumber(rule.hourFrom),
                  hourTo: optionalNumber(rule.hourTo),
                  minAmountMinor: Math.round(Number(rule.minAmount) * 100),
                  maxPointsPerOrder: optionalNumber(rule.maxPoints),
                  active: true,
                },
              },
              "Regla creada.",
            )
          }
        >
          Crear regla
        </Button>
      </section>

      <section aria-labelledby="loy-camp" className="stack tight">
        <h2 id="loy-camp">Campañas con presupuesto</h2>
        {data.config.campaigns.length === 0 ? (
          <p className={styles.muted}>No hay campañas.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.config.campaigns.map((c) => (
              <li key={c.id} className={styles.entry}>
                <span className={styles.grow}>
                  <strong>{c.name}</strong> · financia {c.funder === "sponsor" ? c.sponsor_name : c.funder === "venue" ? "el local" : "ONZA"} · emitido{" "}
                  {c.issued_points}/{c.budget_points}
                  {!c.active && " · pausada"}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === c.id}
                  onClick={() =>
                    save(
                      c.id,
                      { action: "campaign", input: { venueId, id: c.id, name: c.name, funder: c.funder, sponsorName: c.sponsor_name, budgetPoints: c.budget_points, active: !c.active } },
                      c.active ? "Campaña pausada." : "Campaña activada.",
                    )
                  }
                >
                  {c.active ? "Pausar" : "Activar"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.form}>
          <TextField label="Nombre" value={camp.name} onChange={(e) => setCamp({ ...camp, name: e.target.value })} />
          <label className="field">
            <span>Quién financia</span>
            <select value={camp.funder} onChange={(e) => setCamp({ ...camp, funder: e.target.value })}>
              <option value="venue">El local</option>
              <option value="sponsor">Un patrocinador</option>
            </select>
          </label>
          {camp.funder === "sponsor" && (
            <TextField label="Nombre del patrocinador" value={camp.sponsorName} onChange={(e) => setCamp({ ...camp, sponsorName: e.target.value })} />
          )}
          <TextField label="Presupuesto (puntos)" type="number" min={0} value={camp.budget} onChange={(e) => setCamp({ ...camp, budget: e.target.value })} />
        </div>
        <Button
          loading={busy === "camp"}
          disabled={!camp.name || (camp.funder === "sponsor" && !camp.sponsorName)}
          onClick={() =>
            save(
              "camp",
              {
                action: "campaign",
                input: {
                  venueId,
                  name: camp.name,
                  funder: camp.funder,
                  sponsorName: camp.funder === "sponsor" ? camp.sponsorName : null,
                  budgetPoints: Number(camp.budget),
                  active: true,
                },
              },
              "Campaña creada.",
            )
          }
        >
          Crear campaña
        </Button>
      </section>

      <section aria-labelledby="loy-social" className="stack tight">
        <h2 id="loy-social">Social en tu local</h2>
        <Toggle
          label="Permitir Drink Stories etiquetadas en este local"
          checked={data.social.stories_enabled}
          onChange={(v) =>
            save("social", { action: "social", input: { venueId, gifts_enabled: data.social.gifts_enabled, stories_enabled: v } }, "Ajuste guardado.")
          }
        />
        <Toggle
          label="Permitir que te envíen tragos (todavía no disponible en la plataforma)"
          checked={data.social.gifts_enabled}
          onChange={(v) =>
            save("social", { action: "social", input: { venueId, gifts_enabled: v, stories_enabled: data.social.stories_enabled } }, "Ajuste guardado.")
          }
        />
      </section>
    </div>
  );
}
