"use client";
import { useEffect, useRef, useState } from "react";
import { Price } from "@/components/ui/primitives";
import { periodBuckets } from "../period";
import type { RangeSummary } from "../types";

export type ChartMetric = "orders" | "net";
const H = 200;
const PAD = { top: 28, right: 8, bottom: 26, left: 8 };

function bucketLabel(grain: RangeSummary["grain"], bucket: string) {
  if (grain === "hour") return `${Number(bucket)}:00`;
  const d = new Date(`${grain === "month" ? `${bucket}-01` : bucket}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "UTC",
    ...(grain === "month" ? { month: "short" } : { day: "numeric", month: "short" }),
  })
    .format(d)
    .replace(/\.$/, "");
}

/**
 * Una serie (pedidos por hora de entrada o ventas netas por hora de cada captura/devolución), barras finas con extremo
 * redondeado desde una sola línea base. Sin leyenda: el selector nombra la serie. Pico rotulado, tooltip por barra
 * (puntero y teclado) y tabla equivalente para lectores de pantalla.
 */
export function SummaryChart({ summary, metric }: { summary: RangeSummary; metric: ChartMetric }) {
  const [active, setActive] = useState<number | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setW(Math.max(240, Math.round(entry.contentRect.width))),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const byBucket = new Map(summary.series.map((s) => [s.bucket, s]));
  const rows = periodBuckets(summary.grain, summary.from, summary.to).map((bucket) => ({
    bucket,
    label: bucketLabel(summary.grain, bucket),
    value: metric === "orders" ? (byBucket.get(bucket)?.orders ?? 0) : (byBucket.get(bucket)?.net_minor ?? 0),
  }));
  const max = Math.max(0, ...rows.map((r) => r.value));
  const min = Math.min(0, ...rows.map((r) => r.value));
  const span = max - min || 1;
  const innerH = H - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((max - v) / span) * innerH;
  const base = y(0);
  const slot = (W - PAD.left - PAD.right) / rows.length;
  const barW = Math.max(2, Math.min(24, slot - 2));
  const peak = rows.reduce((best, r, i) => (r.value > rows[best].value ? i : best), 0);
  const empty = rows.every((r) => r.value === 0);
  const every = Math.ceil(rows.length / Math.max(3, Math.floor(W / 64)));
  const format = (v: number) => (metric === "orders" ? String(v) : null);
  const bar = (i: number, v: number) => {
    const x = PAD.left + i * slot + (slot - barW) / 2;
    const top = Math.min(y(v), base);
    const h = Math.max(v === 0 ? 0 : 2, Math.abs(y(v) - base));
    const r = Math.min(4, barW / 2, h);
    // Extremo de dato redondeado, base recta.
    return v >= 0
      ? `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + barW - r}Q${x + barW},${top} ${x + barW},${top + r}V${base}Z`
      : `M${x},${base}V${top + h - r}Q${x},${top + h} ${x + r},${top + h}H${x + barW - r}Q${x + barW},${top + h} ${x + barW},${top + h - r}V${base}Z`;
  };
  const current = active === null ? null : rows[active];
  return (
    <figure className="summary-chart">
      <div className="chart-frame" ref={frame}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={metric === "orders" ? "Pedidos por período" : "Ventas netas por período"}>
          {[0.5, 1].map((f) => (
            <line key={f} className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(max * f)} y2={y(max * f)} />
          ))}
          <line className="axis" x1={PAD.left} x2={W - PAD.right} y1={base} y2={base} />
          {rows.map((r, i) => (
            <g
              key={r.bucket}
              tabIndex={0}
              role="img"
              aria-label={`${r.label}: ${metric === "orders" ? `${r.value} pedidos` : `${r.value / 100} colones netos`}`}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <rect className="hit" x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH} />
              <path className={`bar ${active === i ? "on" : ""}`} d={bar(i, r.value)} />
              {i % every === 0 && (
                <text className="chart-tick" x={PAD.left + i * slot + slot / 2} y={H - 8} textAnchor="middle">
                  {r.label}
                </text>
              )}
            </g>
          ))}
          {!empty && metric === "orders" && rows[peak].value > 0 && (
            <text className="peak" x={PAD.left + peak * slot + slot / 2} y={y(rows[peak].value) - 8} textAnchor="middle">
              Pico · {rows[peak].value}
            </text>
          )}
        </svg>
        {current && (
          <div className="chart-tip" role="status" style={{ left: `${((PAD.left + (active ?? 0) * slot + slot / 2) / W) * 100}%` }}>
            <strong>{current.label}</strong>
            <span>{metric === "orders" ? `${current.value} pedidos` : <Price amount={current.value} />}</span>
          </div>
        )}
        {empty && <p className="chart-empty muted t-label">Sin operaciones en este período.</p>}
      </div>
      <details className="chart-table">
        <summary>Ver tabla</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{summary.grain === "hour" ? "Hora" : summary.grain === "day" ? "Noche" : "Mes"}</th>
              <th scope="col">{metric === "orders" ? "Pedidos" : "Ventas netas"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.filter((r) => r.value !== 0).map((r) => (
              <tr key={r.bucket}>
                <td>{r.label}</td>
                <td className="num">{format(r.value) ?? <Price amount={r.value} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
