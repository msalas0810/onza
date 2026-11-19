"use client";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight } from "lucide-react";
import {
  Button,
  EmptyState,
  Price,
  SegmentedControl,
  TextField,
} from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { periodFor, periodLabel, type Period, type PeriodKind } from "../period";
import { rangeSummarySchema, type RangeSummary } from "../types";
import { SummaryChart, type ChartMetric } from "./summary-chart";

const kinds = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
] as const;
const minutes = (seconds: number | null) =>
  seconds === null ? "—" : seconds < 60 ? "<1 min" : `${Math.round(seconds / 60)} min`;

/**
 * Resumen de administración por período, con el corte operativo de las 06:00. Entregados, ventas netas (capturas menos
 * devoluciones confirmadas en el período), mediana de preparación y pedidos activos; las reservas van aparte como saldo
 * actual. Montos simulados mientras el proveedor sea mock.
 */
export function AdminSummary({
  venueId,
  initial,
  initialPeriod,
  revision,
}: {
  venueId: string;
  initial: RangeSummary | null;
  initialPeriod: Period;
  /** Cambia cuando cambian los pedidos en vivo: se vuelve a consultar el período. */
  revision: string;
}) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [summary, setSummary] = useState<RangeSummary | null>(initial);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<Period>(initialPeriod);
  const [metric, setMetric] = useState<ChartMetric>("orders");
  const [products, setProducts] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/summary?venue=${venueId}&from=${period.from}&to=${period.to}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setSummary(rangeSummarySchema.parse(await response.json()));
        setError("");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("No pudimos actualizar el resumen. Se conservan los valores anteriores.");
      });
    return () => controller.abort();
  }, [venueId, period, revision]);

  const choose = (kind: PeriodKind, anchor = draft.from) =>
    setDraft(kind === "range" ? { kind, from: draft.from, to: draft.to } : periodFor(kind, anchor));
  const empty = summary && summary.orders === 0 && summary.net_minor === 0 && summary.refunded_minor === 0;
  return (
    <section className="stack">
      <div className="row between wrap">
        <h2>Resumen</h2>
        <button
          type="button"
          className="period-button"
          aria-haspopup="dialog"
          onClick={() => {
            setDraft(period);
            setPicking(true);
          }}
        >
          <CalendarDays size={18} aria-hidden="true" />
          <span>{periodLabel(period)}</span>
        </button>
      </div>
      <p className="muted t-label">
        Noches operativas de 06:00 a 06:00 (Costa Rica). Montos simulados: no hay cobros reales.
      </p>
      {error && <p className="notice warning" role="status">{error}</p>}
      {!summary ? (
        <EmptyState title="Resumen no disponible">
          Esta base todavía no tiene el resumen por período (migración 016).
        </EmptyState>
      ) : (
        <>
          <div className="metrics kpis">
            <div className="metric">
              <span className="muted t-label">Entregados</span>
              <span className="v">{summary.delivered_orders}</span>
              <span className="hint">de {summary.orders} pedidos</span>
            </div>
            <div className="metric">
              <span className="muted t-label">Ventas netas</span>
              <span className="v">
                <Price amount={summary.net_minor} />
              </span>
              <span className="hint">
                Devuelto <Price amount={summary.refunded_minor} />
              </span>
            </div>
            <div className="metric">
              <span className="muted t-label">Preparación (mediana)</span>
              <span className="v">{minutes(summary.median_preparation_seconds)}</span>
              <span className="hint">
                N = {summary.preparation_n}
                {summary.p90_preparation_seconds !== null && ` · p90 ${minutes(summary.p90_preparation_seconds)}`}
              </span>
            </div>
            <div className="metric">
              <span className="muted t-label">Pedidos activos</span>
              <span className="v">{summary.active_orders}</span>
              <span className="hint">ahora</span>
            </div>
          </div>
          <div className="block-card reserve-card">
            <div className="grow">
              <span className="muted t-label">Monto reservado · actual</span>
              <strong className="num">
                <Price amount={summary.reserved_now_minor} />
              </strong>
            </div>
            <p className="hint">Reservas de pedidos abiertos. No son ventas hasta confirmar el cobro.</p>
          </div>
          <div className="block-card stack">
            <div className="row between wrap">
              <h3>{metric === "orders" ? "Pedidos por hora de entrada" : "Ventas netas por hora de cobro"}</h3>
              <SegmentedControl<ChartMetric>
                label="Serie del gráfico"
                value={metric}
                options={[
                  { value: "orders", label: "Pedidos" },
                  { value: "net", label: "Ventas netas" },
                ]}
                onChange={setMetric}
              />
            </div>
            {summary.median_wait_seconds !== null && (
              <p className="muted t-label">
                Espera hasta aceptar (mediana): {minutes(summary.median_wait_seconds)} · N = {summary.wait_n}
              </p>
            )}
            <SummaryChart summary={summary} metric={metric} />
          </div>
          <button
            type="button"
            className="row-link"
            onClick={() => setProducts(true)}
            disabled={!summary.products.length}
          >
            <span className="grow">
              <strong>Productos</strong>
              <span className="muted t-label">
                {summary.products.length
                  ? (() => {
                      const units = summary.products.reduce((n, p) => n + p.units, 0);
                      return ` · ${units} ${units === 1 ? "unidad entregada" : "unidades entregadas"}`;
                    })()
                  : " · sin entregas en este período"}
              </span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          {empty && <p className="muted t-label">Sin operaciones en este período.</p>}
        </>
      )}
      <Sheet
        open={picking}
        onOpenChange={setPicking}
        title="Período"
        description="Se aplica el corte operativo del local (06:00)."
        actions={
          <>
            <Button variant="secondary" onClick={() => setPicking(false)}>
              Cancelar
            </Button>
            <Button
              disabled={draft.to < draft.from}
              onClick={() => {
                setPeriod(draft);
                setPicking(false);
              }}
            >
              Aplicar
            </Button>
          </>
        }
      >
        <div className="stack">
          <SegmentedControl<Exclude<PeriodKind, "range">>
            block
            label="Tipo de período"
            value={draft.kind === "range" ? "day" : draft.kind}
            options={kinds}
            onChange={(kind) => choose(kind)}
          />
          {draft.kind !== "range" ? (
            <TextField
              label={draft.kind === "day" ? "Noche" : "Incluye la fecha"}
              type="date"
              value={draft.from}
              onChange={(e) => e.target.value && choose(draft.kind, e.target.value)}
              hint={periodLabel(draft)}
            />
          ) : null}
          <details open={draft.kind === "range"}>
            <summary className="t-label" onClick={() => choose("range")}>
              Rango explícito
            </summary>
            <div className="row" style={{ marginTop: 12 }}>
              <TextField
                label="Desde"
                type="date"
                value={draft.from}
                onChange={(e) => setDraft({ kind: "range", from: e.target.value, to: draft.to })}
              />
              <TextField
                label="Hasta"
                type="date"
                value={draft.to}
                onChange={(e) => setDraft({ kind: "range", from: draft.from, to: e.target.value })}
              />
            </div>
          </details>
        </div>
      </Sheet>
      <Sheet open={products} onOpenChange={setProducts} title="Productos entregados" description={periodLabel(period)}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Unidades</th>
                <th scope="col">Monto</th>
              </tr>
            </thead>
            <tbody>
              {summary?.products.map((p) => (
                <tr key={p.product_id + p.name_snapshot}>
                  <td>{p.name_snapshot}</td>
                  <td className="num">{p.units}</td>
                  <td>
                    <Price amount={p.total_minor} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sheet>
    </section>
  );
}
