"use client";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import {
  inServiceArea,
  shortLabel,
  type ServicePolygon,
  type ShapedSpot,
} from "../geometry";

type Pin = { x: number; y: number };
type View = { s: number; x: number; y: number };

const MIN_SCALE = 1;
const MAX_SCALE = 6;
/** Hasta cuántos píxeles puede moverse un dedo y seguir siendo un toque (no un arrastre). */
const TAP_SLOP = 8;
const TAP_MS = 600;

/**
 * Plano o foto del local con zoom y desplazamiento que nunca se confunden con marcar un punto:
 * un toque corto y quieto marca el pin (otro toque lo mueve); un dedo que arrastra mueve el plano cuando está ampliado;
 * dos dedos acercan o alejan; la rueda hace zoom en la computadora. Todo en coordenadas relativas a la imagen (0 a 1), así
 * el pin cae en el mismo lugar en el teléfono del cliente y en la pantalla de la barra.
 * Sin `onPick` es de solo lectura (la barra y el resumen del pedido).
 */
export function PlanMap({
  map,
  serviceArea = [],
  spots = [],
  pin = null,
  selectedSpotId = null,
  onPick,
  onOutside,
  restrict = true,
  overlay,
  label,
  maxVh = 62,
  className = "",
}: {
  map: { imageUrl: string; width: number; height: number };
  serviceArea?: readonly ServicePolygon[];
  spots?: readonly ShapedSpot[];
  pin?: Pin | null;
  selectedSpotId?: string | null;
  onPick?: (point: Pin) => void;
  /** Un toque fuera del área de servicio (el pin no se mueve). */
  onOutside?: (point: Pin) => void;
  /** Rechaza los toques fuera del área de servicio. Se apaga al dibujar el área en la administración. */
  restrict?: boolean;
  /** Dibujo extra en coordenadas de imagen (viewBox 0 0 ancho alto): lo usa el editor de la administración. */
  overlay?: ReactNode;
  label: string;
  /** Alto máximo en % de la pantalla: el plano nunca pasa de ahí y el resto de la página sigue accesible. */
  maxVh?: number;
  className?: string;
}) {
  const { width: W, height: H } = map;
  const maskId = useId();
  const box = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const [flash, setFlash] = useState(false);
  const [rejected, setRejected] = useState<Pin | null>(null);
  const timers = useRef<number[]>([]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    kind: "none" | "maybe-tap" | "pan" | "pinch";
    startX: number;
    startY: number;
    at: number;
    view: View;
    dist: number;
    mid: { x: number; y: number };
  }>({
    kind: "none",
    startX: 0,
    startY: 0,
    at: 0,
    view: { s: 1, x: 0, y: 0 },
    dist: 0,
    mid: { x: 0, y: 0 },
  });

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const clamp = useCallback((v: View): View => {
    const el = box.current;
    if (!el) return v;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s));
    return {
      s,
      x: Math.min(0, Math.max(w - w * s, v.x)),
      y: Math.min(0, Math.max(h - h * s, v.y)),
    };
  }, []);

  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) =>
      setView((v) => {
        const el = box.current;
        const px = cx ?? (el ? el.clientWidth / 2 : 0);
        const py = cy ?? (el ? el.clientHeight / 2 : 0);
        const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s * factor));
        const k = s / v.s;
        return clamp({ s, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
      }),
    [clamp],
  );

  // Rueda: zoom en la computadora, sin desplazar la página.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(
        e.deltaY < 0 ? 1.2 : 1 / 1.2,
        e.clientX - r.left,
        e.clientY - r.top,
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const toPoint = (clientX: number, clientY: number): Pin | null => {
    const r = layer.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return null;
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    return x < 0 || x > 1 || y < 0 || y > 1 ? null : { x, y };
  };

  const pick = (p: Pin | null) => {
    if (!onPick || !p) return;
    if (restrict && !inServiceArea(serviceArea, p.x, p.y)) {
      setRejected(p);
      setFlash(true);
      timers.current.push(
        window.setTimeout(() => setRejected(null), 1200),
        window.setTimeout(() => setFlash(false), 900),
      );
      onOutside?.(p);
      return;
    }
    setRejected(null);
    onPick(p);
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-plan-control]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const r = box.current?.getBoundingClientRect();
      g.kind = "pinch";
      g.dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      g.mid = {
        x: (a.x + b.x) / 2 - (r?.left ?? 0),
        y: (a.y + b.y) / 2 - (r?.top ?? 0),
      };
      g.view = view;
      return;
    }
    g.kind = "maybe-tap";
    g.startX = e.clientX;
    g.startY = e.clientY;
    g.at = Date.now();
    g.view = view;
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const s = Math.min(
        MAX_SCALE,
        Math.max(
          MIN_SCALE,
          g.view.s * (Math.hypot(a.x - b.x, a.y - b.y) / g.dist),
        ),
      );
      const k = s / g.view.s;
      setView(
        clamp({
          s,
          x: g.mid.x - (g.mid.x - g.view.x) * k,
          y: g.mid.y - (g.mid.y - g.view.y) * k,
        }),
      );
      return;
    }
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (g.kind === "maybe-tap" && Math.hypot(dx, dy) > TAP_SLOP) g.kind = "pan";
    if (g.kind === "pan")
      setView(clamp({ s: g.view.s, x: g.view.x + dx, y: g.view.y + dy }));
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    const had = pointers.current.delete(e.pointerId);
    if (!had) return;
    if (
      g.kind === "maybe-tap" &&
      e.type === "pointerup" &&
      Date.now() - g.at < TAP_MS
    )
      pick(toPoint(e.clientX, e.clientY));
    // Al levantar un dedo después de pellizcar no hay toque ni salto.
    if (pointers.current.size === 0 || g.kind === "pinch") g.kind = "none";
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onPick) return;
    const step = e.shiftKey ? 0.1 : 0.02;
    const move: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = move[e.key];
    if (!delta) return;
    e.preventDefault();
    const from = pin ?? { x: 0.5, y: 0.5 };
    pick({
      x: Math.min(1, Math.max(0, from.x + delta[0])),
      y: Math.min(1, Math.max(0, from.y + delta[1])),
    });
  };

  return (
    <div
      className={`plan ${className}`}
      style={{ width: `min(100%, calc(${maxVh}dvh * ${W / H}))` }}
    >
      <div
        ref={box}
        role="application"
        aria-label={label}
        tabIndex={onPick ? 0 : undefined}
        className="plan-box"
        data-pickable={onPick ? "true" : undefined}
        style={{ aspectRatio: `${W} / ${H}` }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <div
          ref={layer}
          className="plan-layer"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- el plano lo sirve Storage o el repo; el tamaño ya está fijado por el contenedor */}
          <img
            className="plan-img"
            src={map.imageUrl}
            alt=""
            draggable={false}
            width={W}
            height={H}
          />
          <svg
            className="plan-svg"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {serviceArea.length > 0 && (
              <>
                <mask id={maskId}>
                  <rect width={W} height={H} fill="white" />
                  {serviceArea.map((p, i) => (
                    <polygon
                      key={i}
                      points={p.points
                        .map(([x, y]) => `${x * W},${y * H}`)
                        .join(" ")}
                      fill="black"
                    />
                  ))}
                </mask>
                <rect
                  className="plan-dim"
                  width={W}
                  height={H}
                  mask={`url(#${maskId})`}
                />
                {serviceArea.map((p, i) => (
                  <polygon
                    key={i}
                    className="plan-area"
                    data-flash={flash || undefined}
                    points={p.points
                      .map(([x, y]) => `${x * W},${y * H}`)
                      .join(" ")}
                  />
                ))}
              </>
            )}
            {spots
              .filter((s) => s.enabled && s.shape?.kind === "polygon")
              .map((s) =>
                s.shape?.kind === "polygon" ? (
                  <polygon
                    key={s.id}
                    className="plan-zone"
                    data-on={selectedSpotId === s.id || undefined}
                    points={s.shape.points
                      .map(([x, y]) => `${x * W},${y * H}`)
                      .join(" ")}
                  />
                ) : null,
              )}
            {spots
              .filter((s) => s.enabled && s.shape?.kind === "circle")
              .map((s) =>
                s.shape?.kind === "circle" ? (
                  <g
                    key={s.id}
                    className="plan-table"
                    data-on={selectedSpotId === s.id || undefined}
                  >
                    <circle
                      cx={s.shape.x * W}
                      cy={s.shape.y * H}
                      r={s.shape.r * W}
                    />
                    <text
                      x={s.shape.x * W}
                      y={s.shape.y * H}
                      fontSize={Math.max(14, s.shape.r * W * 1.05)}
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {shortLabel(s.label)}
                    </text>
                  </g>
                ) : null,
              )}
            {overlay}
          </svg>
          {rejected && (
            <span
              className="plan-nope"
              aria-hidden="true"
              style={{
                left: `${rejected.x * 100}%`,
                top: `${rejected.y * 100}%`,
                transform: `translate(-50%, -50%) scale(${1 / view.s})`,
              }}
            />
          )}
          {pin && (
            <span
              key={`${pin.x},${pin.y}`} // cada toque vuelve a «soltar» el pin
              className="plan-pin"
              data-plan-pin
              aria-hidden="true"
              style={{
                left: `${pin.x * 100}%`,
                top: `${pin.y * 100}%`,
                transform: `translate(-50%, -100%) scale(${1 / view.s})`,
              }}
            >
              <svg
                width="36"
                height="46"
                viewBox="0 0 36 46"
                role="presentation"
              >
                <path
                  d="M18 45s15.5-15.2 15.5-27.2A15.5 15.5 0 0 0 2.5 17.8C2.5 29.8 18 45 18 45Z"
                  className="plan-pin-body"
                />
                <circle cx="18" cy="18" r="6" className="plan-pin-dot" />
              </svg>
            </span>
          )}
        </div>
      </div>
      <div className="plan-controls" data-plan-control>
        <button
          type="button"
          aria-label="Acercar el mapa"
          onClick={() => zoomAt(1.5)}
          disabled={view.s >= MAX_SCALE}
        >
          <Plus size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Alejar el mapa"
          onClick={() => zoomAt(1 / 1.5)}
          disabled={view.s <= MIN_SCALE}
        >
          <Minus size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Ver el mapa completo"
          onClick={() => setView({ s: 1, x: 0, y: 0 })}
          disabled={view.s === 1}
        >
          <Maximize2 size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
