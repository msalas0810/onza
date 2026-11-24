"use client";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Armchair,
  DoorOpen,
  Flag,
  Maximize2,
  MapPin,
  Minus,
  Music,
  Navigation,
  Plus,
  Wine,
  type LucideIcon,
} from "lucide-react";
import {
  centerOn,
  clamp01,
  clampView,
  fitBase,
  initialView,
  insideUnit,
  normToScreen,
  nudge,
  panBy,
  pinchView,
  screenToNorm,
  zoneCenter,
  zoomAt,
  type Point,
  type Size,
  type View,
} from "../geometry";
import type { ElementType, MapZone } from "../types";
import styles from "./maps.module.css";

export const elementIcons: Record<ElementType, LucideIcon> = {
  table: Armchair,
  bar: Wine,
  entrance: DoorOpen,
  stage: Music,
  poi: Flag,
  delivery_point: Navigation,
};

export type ViewportMarker = {
  id: string;
  point: Point;
  /** `pin`: marcador del cliente (la punta marca el punto) · `icon`: elemento del plano · `vertex`: vértice de una zona. */
  kind: "pin" | "icon" | "vertex";
  icon?: ElementType;
  label?: string;
  ariaLabel: string;
  tone?: "default" | "selected" | "invalid" | "vip";
  draggable?: boolean;
  /** Mostrar la etiqueta aunque el zoom sea bajo. */
  alwaysLabel?: boolean;
  onSelect?: () => void;
  onMove?: (p: Point) => void;
  onMoveEnd?: (p: Point) => void;
};
export type ViewportZone = Pick<
  MapZone,
  "id" | "points" | "delivery" | "kind"
> & {
  name?: string;
  selected?: boolean;
  /** Borrador sin cerrar (se dibuja como línea, no como polígono). */
  draft?: boolean;
};

type Props = {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  /** Nombre accesible del plano. */
  label: string;
  zones?: ViewportZone[];
  markers?: ViewportMarker[];
  /** Toque o clic sobre el plano (no sobre un marcador). `inside` indica si cae dentro de la imagen. */
  onTap?: (p: Point, info: { inside: boolean }) => void;
  /** Cambia la clave para volver a centrar en un punto (p. ej. «Ver ubicación»). */
  focus?: { key: string | number; point: Point; scale?: number };
  maxScale?: number;
  doubleTapZoom?: boolean;
  showZoneNames?: boolean;
  /** Botones de acercar, alejar y ver completo (se ocultan en las miniaturas; los gestos y el teclado siguen). */
  controls?: boolean;
  className?: string;
};

const TAP_SLOP = 8;
const DOUBLE_TAP_MS = 320;

/**
 * Visor interactivo del plano: pellizco para ampliar, arrastre para mover, rueda y doble toque/clic, botones y teclado.
 * Trabaja en coordenadas normalizadas: el plano se ajusta al contenedor y todo (marcadores, zonas, toques) se calcula sobre
 * la imagen, no sobre píxeles de pantalla. Los marcadores no se escalan con el zoom y tienen un área táctil de 44 px.
 */
export function MapViewport({
  imageUrl,
  imageWidth,
  imageHeight,
  label,
  zones = [],
  markers = [],
  onTap,
  focus,
  maxScale = 8,
  doubleTapZoom = true,
  showZoneNames = true,
  controls = true,
  className = "",
}: Props) {
  const hintId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [view, setViewState] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const [image, setImage] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const limits = useMemo(() => ({ min: 1, max: maxScale }), [maxScale]);
  const imageSize = useMemo(
    () => ({ w: imageWidth, h: imageHeight }),
    [imageWidth, imageHeight],
  );
  const base = useMemo(() => fitBase(size, imageSize), [size, imageSize]);

  const viewRef = useRef(view);
  const sizeRef = useRef(size);
  const frame = useRef(0);
  const pending = useRef<View | null>(null);
  /** Aplica una vista: el valor de referencia cambia al instante y React se actualiza como máximo una vez por cuadro. */
  const apply = useCallback((next: View) => {
    viewRef.current = next;
    pending.current = next;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (pending.current) setViewState(pending.current);
    });
  }, []);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Tamaño del contenedor: al cambiar (giro de pantalla, ventana) se conserva el punto que estaba en el centro.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = { w: entry.contentRect.width, h: entry.contentRect.height };
      const old = sizeRef.current;
      sizeRef.current = next;
      setSize(next);
      if (next.w <= 0 || next.h <= 0) return;
      const nextBase = fitBase(next, imageSize);
      if (old.w > 0 && old.h > 0) {
        const center = screenToNorm(viewRef.current, fitBase(old, imageSize), {
          x: old.w / 2,
          y: old.h / 2,
        });
        apply(centerOn(center, viewRef.current.scale, next, nextBase, limits));
      } else apply(initialView(next, nextBase));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [apply, imageSize, limits]);

  const focusKey = focus?.key;
  const focusPoint = focus?.point;
  const focusScale = focus?.scale;
  useEffect(() => {
    if (focusKey === undefined || !focusPoint || size.w <= 0) return;
    apply(
      centerOn(
        focusPoint,
        focusScale ?? 2.5,
        size,
        fitBase(size, imageSize),
        limits,
      ),
    );
    // Solo cuando cambia la clave o aparece el tamaño: el punto en sí puede moverse sin recentrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, size.w > 0]);

  // La rueda necesita un oyente no pasivo para impedir el desplazamiento de la página.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      apply(
        zoomAt(
          viewRef.current,
          factor,
          { x: e.clientX - rect.left, y: e.clientY - rect.top },
          sizeRef.current,
          fitBase(sizeRef.current, imageSize),
          limits,
        ),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [apply, imageSize, limits]);

  // --- Gestos -----------------------------------------------------------------------------------------------------------
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<
    | { mode: "idle" }
    | { mode: "pan"; start: Point; from: View; moved: boolean }
    | { mode: "pinch"; from: View; a: Point; b: Point }
  >({ mode: "idle" });
  const lastTap = useRef<{ at: number; p: Point } | null>(null);
  const relative = (e: { clientX: number; clientY: number }): Point => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const currentBase = () => fitBase(sizeRef.current, imageSize);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    containerRef.current?.setPointerCapture(e.pointerId);
    const p = relative(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1)
      gesture.current = {
        mode: "pan",
        start: p,
        from: viewRef.current,
        moved: false,
      };
    else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { mode: "pinch", from: viewRef.current, a, b };
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = relative(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (g.mode === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      apply(
        pinchView(
          g.from,
          g.a,
          g.b,
          a,
          b,
          sizeRef.current,
          currentBase(),
          limits,
        ),
      );
    } else if (g.mode === "pan") {
      const dx = p.x - g.start.x;
      const dy = p.y - g.start.y;
      if (!g.moved && Math.hypot(dx, dy) > TAP_SLOP) g.moved = true;
      if (g.moved)
        apply(
          clampView(
            { ...g.from, tx: g.from.tx + dx, ty: g.from.ty + dy },
            sizeRef.current,
            currentBase(),
            limits,
          ),
        );
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const g = gesture.current;
    const p = relative(e);
    pointers.current.delete(e.pointerId);
    containerRef.current?.releasePointerCapture?.(e.pointerId);
    if (pointers.current.size === 1) {
      // Queda un dedo tras un pellizco: sigue como desplazamiento desde su posición actual, sin saltos ni toque falso.
      const [rest] = [...pointers.current.values()];
      gesture.current = {
        mode: "pan",
        start: rest,
        from: viewRef.current,
        moved: true,
      };
      return;
    }
    if (pointers.current.size > 0) return;
    gesture.current = { mode: "idle" };
    if (g.mode !== "pan" || g.moved || e.type === "pointercancel") return;
    // Doble toque: se comprueba primero, porque el primer toque ya pudo colocar un marcador justo debajo del segundo.
    const now = e.timeStamp;
    const previous = lastTap.current;
    const isDouble =
      doubleTapZoom &&
      previous !== null &&
      now - previous.at < DOUBLE_TAP_MS &&
      Math.hypot(p.x - previous.p.x, p.y - previous.p.y) < 28;
    lastTap.current = isDouble ? null : { at: now, p };
    if (isDouble) {
      const v = viewRef.current;
      apply(
        v.scale >= limits.max - 0.01
          ? initialView(sizeRef.current, currentBase())
          : zoomAt(v, 2, p, sizeRef.current, currentBase(), limits),
      );
      return;
    }
    // Toque: primero marcadores del plano (botones), luego el plano.
    const hit = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-marker-id]");
    if (hit) {
      markers.find((m) => m.id === hit.dataset.markerId)?.onSelect?.();
      return;
    }
    const norm = screenToNorm(viewRef.current, currentBase(), p);
    onTap?.(norm, { inside: insideUnit(norm) });
  };

  const zoomBy = (factor: number) => {
    const s = sizeRef.current;
    apply(
      zoomAt(
        viewRef.current,
        factor,
        { x: s.w / 2, y: s.h / 2 },
        s,
        currentBase(),
        limits,
      ),
    );
  };
  const reset = () => apply(initialView(sizeRef.current, currentBase()));
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const step = 48;
    const s = sizeRef.current;
    const b = currentBase();
    const keys: Record<string, () => void> = {
      ArrowLeft: () => apply(panBy(viewRef.current, step, 0, s, b, limits)),
      ArrowRight: () => apply(panBy(viewRef.current, -step, 0, s, b, limits)),
      ArrowUp: () => apply(panBy(viewRef.current, 0, step, s, b, limits)),
      ArrowDown: () => apply(panBy(viewRef.current, 0, -step, s, b, limits)),
      "+": () => zoomBy(1.4),
      "=": () => zoomBy(1.4),
      "-": () => zoomBy(1 / 1.4),
      "0": reset,
    };
    const action = keys[e.key];
    if (action) {
      e.preventDefault();
      action();
    }
  };

  // --- Marcadores arrastrables ----------------------------------------------------------------------------------------------
  const drag = useRef<{ id: string; grab: Point } | null>(null);
  const markerPoint = (
    e: { clientX: number; clientY: number },
    grab: Point,
  ): Point => {
    const n = screenToNorm(viewRef.current, currentBase(), {
      x: relative(e).x + grab.x,
      y: relative(e).y + grab.y,
    });
    return { x: clamp01(n.x), y: clamp01(n.y) };
  };
  const onMarkerDown = (
    m: ViewportMarker,
    e: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (!m.draggable) return;
    // Segundo toque de un doble toque sobre el marcador recién colocado: lo resuelve el visor (zoom), no el arrastre.
    const previous = lastTap.current;
    const at = relative(e);
    if (
      doubleTapZoom &&
      previous &&
      e.timeStamp - previous.at < DOUBLE_TAP_MS &&
      Math.hypot(at.x - previous.p.x, at.y - previous.p.y) < 28
    )
      return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Diferencia entre el punto del marcador y el dedo: el marcador no salta al empezar a arrastrar.
    const markerAt = normToScreen(viewRef.current, currentBase(), m.point);
    drag.current = {
      id: m.id,
      grab: { x: markerAt.x - at.x, y: markerAt.y - at.y },
    };
  };
  const onMarkerMove = (
    m: ViewportMarker,
    e: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (drag.current?.id === m.id)
      m.onMove?.(markerPoint(e, drag.current.grab));
  };
  const onMarkerUp = (
    m: ViewportMarker,
    e: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (drag.current?.id !== m.id) return;
    const p = markerPoint(e, drag.current.grab);
    drag.current = null;
    m.onMove?.(p);
    m.onMoveEnd?.(p);
  };
  const onMarkerKey = (
    m: ViewportMarker,
    e: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (!m.draggable) return;
    const step = e.shiftKey ? 0.02 : 0.005;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const p = nudge(m.point, d[0], d[1]);
    m.onMove?.(p);
    m.onMoveEnd?.(p);
  };

  const ready = size.w > 0 && size.h > 0;
  const showAllLabels = view.scale >= 1.6;
  const margin = 56;
  const toScreen = (p: Point) => normToScreen(view, base, p);

  return (
    <div
      ref={containerRef}
      className={`${styles.viewport} ${className}`}
      tabIndex={0}
      role="group"
      aria-roledescription="plano interactivo"
      aria-label={label}
      aria-describedby={hintId}
      aria-busy={image === "loading"}
      data-testid="map-viewport"
      data-scale={view.scale.toFixed(3)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      {ready && (
        <>
          <div
            className={styles.layer}
            style={{
              width: base.w,
              height: base.h,
              transform: `translate3d(${view.tx}px, ${view.ty}px, 0) scale(${view.scale})`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={attempt}
              className={styles.image}
              src={imageUrl}
              alt=""
              draggable={false}
              decoding="async"
              fetchPriority="high"
              onLoad={() => setImage("ready")}
              onError={() => setImage("error")}
            />
            <svg
              className={styles.zones}
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {zones.map((z) => {
                const points = z.points.map((p) => `${p.x},${p.y}`).join(" ");
                const cls = [
                  styles.zone,
                  z.delivery === "restrict"
                    ? styles.zoneRestrict
                    : z.delivery === "allow"
                      ? styles.zoneAllow
                      : z.kind === "vip"
                        ? styles.zoneVip
                        : styles.zoneGeneral,
                  z.selected && styles.zoneSelected,
                ]
                  .filter(Boolean)
                  .join(" ");
                return z.draft ? (
                  <polyline
                    key={z.id}
                    className={`${styles.zone} ${styles.zoneDraft}`}
                    points={points}
                    fill="none"
                  />
                ) : (
                  <polygon key={z.id} className={cls} points={points} />
                );
              })}
            </svg>
          </div>
          <div className={styles.overlay}>
            {showZoneNames &&
              zones
                .filter(
                  (z) => z.name && !z.draft && (z.selected || showAllLabels),
                )
                .map((z) => {
                  const c = toScreen(zoneCenter(z));
                  return (
                    <span
                      key={`n-${z.id}`}
                      className={`${styles.zoneName} ${z.delivery === "restrict" ? styles.zoneNameRestrict : ""}`}
                      style={{
                        transform: `translate(${c.x}px, ${c.y}px) translate(-50%, -50%)`,
                      }}
                    >
                      {z.delivery === "restrict"
                        ? `${z.name} · sin entrega`
                        : z.name}
                    </span>
                  );
                })}
            {markers.map((m) => {
              const s = toScreen(m.point);
              if (
                !m.draggable &&
                (s.x < -margin ||
                  s.y < -margin ||
                  s.x > size.w + margin ||
                  s.y > size.h + margin)
              )
                return null;
              const Icon = m.icon ? elementIcons[m.icon] : MapPin;
              const tone = m.tone ?? "default";
              const labelVisible =
                m.label &&
                (m.alwaysLabel || showAllLabels || tone === "selected");
              return (
                <div
                  key={m.id}
                  className={styles.markerWrap}
                  style={{ transform: `translate(${s.x}px, ${s.y}px)` }}
                >
                  <button
                    type="button"
                    data-marker-id={m.id}
                    aria-label={m.ariaLabel}
                    className={`${styles.marker} ${m.kind === "pin" ? styles.markerPin : ""} ${styles[`tone_${tone}`]} ${m.kind === "vertex" ? styles.markerVertex : ""} ${m.draggable ? styles.markerDraggable : ""}`}
                    onPointerDown={(e) => onMarkerDown(m, e)}
                    onPointerMove={(e) => onMarkerMove(m, e)}
                    onPointerUp={(e) => onMarkerUp(m, e)}
                    onPointerCancel={(e) => onMarkerUp(m, e)}
                    onKeyDown={(e) => onMarkerKey(m, e)}
                    onClick={(e) => {
                      // Teclado (Enter/Espacio). El toque ya se resolvió en el visor para no seleccionar dos veces.
                      if (e.detail === 0) m.onSelect?.();
                    }}
                  >
                    {m.kind === "vertex" ? (
                      <span className={styles.vertexDot} aria-hidden="true" />
                    ) : m.kind === "pin" ? (
                      <svg
                        viewBox="0 0 32 44"
                        width="32"
                        height="44"
                        aria-hidden="true"
                        className={styles.pinSvg}
                      >
                        <path d="M16 43C16 43 3 27.5 3 16a13 13 0 0 1 26 0c0 11.5-13 27-13 27Z" />
                        <circle cx="16" cy="16" r="5.5" />
                      </svg>
                    ) : (
                      <span className={styles.dot}>
                        <Icon size={16} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                  {labelVisible && (
                    <span className={styles.markerLabel}>{m.label}</span>
                  )}
                </div>
              );
            })}
          </div>
          {controls && (
            <div
              className={styles.controls}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Acercar"
                onClick={() => zoomBy(1.6)}
                disabled={view.scale >= limits.max - 0.01}
              >
                <Plus size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Alejar"
                onClick={() => zoomBy(1 / 1.6)}
                disabled={view.scale <= 1.01}
              >
                <Minus size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Ver el plano completo"
                onClick={reset}
                disabled={view.scale <= 1.01}
              >
                <Maximize2 size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}
      {image === "loading" && (
        <div className={styles.status} role="status">
          <span className="spin" aria-hidden="true" />
          Cargando plano…
        </div>
      )}
      {image === "error" && (
        <div className={styles.status} role="alert">
          <strong>No pudimos cargar el plano</strong>
          <span>Revisá tu conexión e intentá de nuevo.</span>
          <button
            type="button"
            className="btn secondary sm"
            onClick={() => {
              setImage("loading");
              setAttempt((n) => n + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      )}
      <p id={hintId} className="sr-only">
        Plano interactivo. Usá las flechas para mover, más y menos para ampliar,
        y cero para ver el plano completo.
      </p>
    </div>
  );
}
