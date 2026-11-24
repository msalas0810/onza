"use client";
import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, Check, X } from "lucide-react";
import { Button, Notice, SegmentedControl } from "@/components/ui/primitives";
import { mapImageUrl } from "../image";
import {
  rejectionMessage,
  resolveSelection,
  type Point,
  type ResolveResult,
} from "../geometry";
import type { LocationSelection, PublishedMap } from "../types";
import { MapViewport, type ViewportMarker } from "./map-viewport";
import styles from "./maps.module.css";

const roundPoint = (p: Point): Point => ({
  x: Math.round(p.x * 100000) / 100000,
  y: Math.round(p.y * 100000) / 100000,
});
const byLabel = (a: { label: string }, b: { label: string }) =>
  a.label.localeCompare(b.label, "es", { numeric: true });

/** Texto corto de lo elegido: «Mesa 12 · Zona VIP» o «Cerca de Barra principal». */
export function selectionSummary(r: Extract<ResolveResult, { ok: true }>) {
  const where = r.table
    ? r.table.label
    : r.reference
      ? `Cerca de ${r.reference.label}`
      : "Ubicación marcada";
  return r.zone ? `${where} · ${r.zone.name}` : where;
}

type Draft =
  { kind: "point"; point: Point } | { kind: "table"; tableId: string } | null;

function draftFrom(
  initial: LocationSelection | null | undefined,
  map: PublishedMap | undefined,
): Draft {
  if (!initial || !map || initial.mapId !== map.id) return null;
  if (initial.method === "location_on_map")
    return { kind: "point", point: { x: initial.x, y: initial.y } };
  return { kind: "table", tableId: initial.tableId };
}

/**
 * «¿Dónde te entregamos?»: el cliente toca el plano del local, ajusta el marcador y confirma con «Estoy aquí». Si el local tiene
 * mesas numeradas puede elegir la suya directamente. Valida en el momento (fuera del plano, zonas sin entrega); el servidor
 * vuelve a validar al guardar.
 */
export function LocationPicker({
  open,
  onOpenChange,
  maps,
  initial,
  onConfirm,
  onClear,
  preview = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maps: PublishedMap[];
  initial?: LocationSelection | null;
  onConfirm: (selection: LocationSelection) => Promise<void> | void;
  onClear?: () => Promise<void> | void;
  /** Vista previa del administrador: se prueba el selector sin guardar nada. */
  preview?: boolean;
}) {
  const [mapId, setMapId] = useState(() =>
    initial && maps.some((m) => m.id === initial.mapId)
      ? initial.mapId
      : (maps[0]?.id ?? ""),
  );
  const map = maps.find((m) => m.id === mapId) ?? maps[0];
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial, map));
  const [tapError, setTapError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [focusKey, setFocusKey] = useState(0);

  const image = useMemo(
    () => ({ w: map?.image_width ?? 1, h: map?.image_height ?? 1 }),
    [map],
  );
  const resolved: ResolveResult | null = useMemo(() => {
    if (!map || !draft) return null;
    return resolveSelection(
      map.layout,
      image,
      draft.kind === "point"
        ? { method: "location_on_map", ...draft.point }
        : { method: "table", tableId: draft.tableId },
    );
  }, [map, draft, image]);
  const tables = useMemo(
    () =>
      map
        ? map.layout.elements.filter((e) => e.type === "table").sort(byLabel)
        : [],
    [map],
  );
  const pinPoint =
    draft?.kind === "point"
      ? draft.point
      : draft?.kind === "table"
        ? (tables.find((t) => t.id === draft.tableId) ?? null)
        : null;
  const invalid =
    resolved && !resolved.ok ? rejectionMessage[resolved.reason] : "";
  const hasRestricted = !!map?.layout.zones.some(
    (z) => z.delivery === "restrict",
  );
  const hasAllowed = !!map?.layout.zones.some((z) => z.delivery === "allow");

  const reset = (next: PublishedMap | undefined, d: Draft) => {
    setMapId(next?.id ?? "");
    setDraft(d);
    setTapError("");
    setSaveError("");
    setSaved(false);
  };
  const place = (p: Point, inside: boolean) => {
    setSaved(false);
    if (!inside) {
      setTapError(rejectionMessage.out_of_map);
      return;
    }
    setTapError("");
    setDraft({ kind: "point", point: roundPoint(p) });
  };

  const markers: ViewportMarker[] = useMemo(() => {
    if (!map) return [];
    const list: ViewportMarker[] = map.layout.elements.map((e) => ({
      id: `e-${e.id}`,
      point: e,
      kind: "icon",
      icon: e.type,
      label: e.label,
      ariaLabel: e.type === "table" ? `Elegir ${e.label}` : e.label,
      tone:
        draft?.kind === "table" && draft.tableId === e.id
          ? "selected"
          : "default",
      alwaysLabel:
        e.type === "table" && draft?.kind === "table" && draft.tableId === e.id,
      onSelect:
        e.type === "table"
          ? () => {
              setTapError("");
              setSaved(false);
              setDraft({ kind: "table", tableId: e.id });
            }
          : undefined,
    }));
    if (draft?.kind === "point")
      list.push({
        id: "me",
        point: draft.point,
        kind: "pin",
        ariaLabel:
          "Tu ubicación. Arrastralo o usá las flechas para corregirla.",
        tone: resolved && !resolved.ok ? "invalid" : "default",
        draggable: true,
        onMove: (p) => {
          setDraft({ kind: "point", point: p });
          setSaved(false);
        },
        onMoveEnd: (p) => setDraft({ kind: "point", point: roundPoint(p) }),
      });
    else if (draft?.kind === "table" && pinPoint)
      list.push({
        id: "me",
        point: pinPoint,
        kind: "pin",
        ariaLabel: "Tu mesa",
        draggable: true,
        onMove: (p) => setDraft({ kind: "point", point: p }),
        onMoveEnd: (p) => setDraft({ kind: "point", point: roundPoint(p) }),
      });
    return list;
  }, [map, draft, resolved, pinPoint]);

  const confirm = async () => {
    if (!map || !draft || !resolved?.ok || saving) return;
    const selection: LocationSelection =
      draft.kind === "point"
        ? { method: "location_on_map", mapId: map.id, ...draft.point }
        : { method: "table", mapId: map.id, tableId: draft.tableId };
    setSaving(true);
    setSaveError("");
    try {
      await onConfirm(selection);
      if (preview) setSaved(true);
      else onOpenChange(false);
    } catch (e) {
      setSaveError(
        e instanceof Error
          ? e.message
          : "No pudimos guardar la ubicación. Intentá de nuevo.",
      );
    } finally {
      setSaving(false);
    }
  };
  const clear = async () => {
    if (!onClear || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await onClear();
      onOpenChange(false);
    } catch (e) {
      setSaveError(
        e instanceof Error
          ? e.message
          : "No pudimos quitar la ubicación. Intentá de nuevo.",
      );
    } finally {
      setSaving(false);
    }
  };

  const status = resolved?.ok ? selectionSummary(resolved) : "";
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => !saving && onOpenChange(next)}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content
          className={styles.dialog}
          aria-describedby="picker-desc"
          data-testid="location-picker"
        >
          <header className={styles.dialogHead}>
            <div className="grow">
              <Dialog.Title asChild>
                <h2>¿Dónde te entregamos?</h2>
              </Dialog.Title>
              <Dialog.Description id="picker-desc" className="muted t-label">
                Tocá el plano donde estás. Podés arrastrar el marcador para
                corregirlo.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="icon-btn" aria-label="Cerrar">
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>
          {maps.length > 1 && (
            <div className={styles.dialogTabs}>
              <SegmentedControl
                label="Plano"
                value={map?.id ?? ""}
                options={maps.map((m) => ({
                  value: m.id,
                  label: m.site_label ? `${m.name} · ${m.site_label}` : m.name,
                }))}
                onChange={(id) =>
                  reset(
                    maps.find((m) => m.id === id),
                    draftFrom(
                      initial,
                      maps.find((m) => m.id === id),
                    ),
                  )
                }
                block
              />
            </div>
          )}
          <div className={styles.dialogMap}>
            {map ? (
              <MapViewport
                key={map.id}
                imageUrl={mapImageUrl(map.image_path)}
                imageWidth={map.image_width}
                imageHeight={map.image_height}
                label={`Plano de ${map.name}`}
                zones={map.layout.zones.map((z) => ({ ...z }))}
                markers={markers}
                onTap={(p, info) => place(p, info.inside)}
                focus={
                  focusKey
                    ? {
                        key: focusKey,
                        point: pinPoint ?? { x: 0.5, y: 0.5 },
                        scale: 2.2,
                      }
                    : undefined
                }
              />
            ) : (
              <Notice tone="warning" title="Plano no disponible">
                Este local no tiene un plano disponible ahora. Podés pedir igual
                y retirar en la barra.
              </Notice>
            )}
          </div>
          <div className={styles.dialogFoot}>
            {(hasRestricted || hasAllowed) && (
              <p className={styles.legend}>
                {hasRestricted && (
                  <span className={styles.legendRestrict}>Sin entrega</span>
                )}
                {hasAllowed && (
                  <span className={styles.legendAllow}>
                    Entrega solo en esta zona
                  </span>
                )}
              </p>
            )}
            <div
              aria-live="polite"
              className={styles.summary}
              data-testid="picker-summary"
            >
              {tapError || invalid ? (
                <span role="alert" className={styles.summaryError}>
                  <AlertCircle size={16} aria-hidden="true" />{" "}
                  {tapError || invalid}
                </span>
              ) : status ? (
                <span className={styles.summaryOk}>
                  <Check size={16} aria-hidden="true" /> {status}
                </span>
              ) : (
                <span className="muted">
                  Tocá el plano para marcar dónde estás.
                </span>
              )}
            </div>
            {tables.length > 0 && (
              <label className="field">
                <span>O elegí tu mesa</span>
                <select
                  value={draft?.kind === "table" ? draft.tableId : ""}
                  onChange={(e) => {
                    setTapError("");
                    setSaved(false);
                    if (e.target.value) {
                      setDraft({ kind: "table", tableId: e.target.value });
                      setFocusKey((n) => n + 1);
                    }
                  }}
                >
                  <option value="">Sin mesa</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {saveError && (
              <Notice tone="danger" title="No se guardó la ubicación">
                {saveError}
              </Notice>
            )}
            {preview && saved && (
              <Notice tone="success" title="Vista previa">
                Así se confirmaría: {status}. No se guardó nada.
              </Notice>
            )}
            <div className={styles.dialogActions}>
              {initial && onClear && (
                <Button
                  variant="quiet"
                  onClick={() => void clear()}
                  disabled={saving}
                >
                  Quitar ubicación
                </Button>
              )}
              <Button
                size="lg"
                onClick={() => void confirm()}
                disabled={!resolved?.ok}
                loading={saving}
              >
                Estoy aquí
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
