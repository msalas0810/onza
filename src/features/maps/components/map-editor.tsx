"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Eye,
  ImagePlus,
  MousePointer2,
  Pentagon,
  Save,
  Square,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import {
  Button,
  Notice,
  StatusBadge,
  TextField,
} from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { mapImageUrl, MAP_IMAGE_ACCEPT } from "../image";
import { mapsCommand, mapsGet } from "../client-api";
import { roundCoord, zonesAt, type Point } from "../geometry";
import {
  ELEMENT_TYPES,
  elementTypeLabels,
  emptyLayout,
  mapDetailSchema,
  mapLayoutSchema,
  mapSummarySchema,
  type ElementType,
  type MapDetail,
  type MapElement,
  type MapLayout,
  type MapZone,
} from "../types";
import { removeMapImages, uploadMapImage } from "../upload-map-image";
import { ElementInspector, ZoneInspector } from "./map-editor-inspector";
import { LocationPicker } from "./location-picker";
import {
  elementIcons,
  MapViewport,
  type ViewportMarker,
  type ViewportZone,
} from "./map-viewport";
import styles from "./maps.module.css";

type Tool = "select" | ElementType | "zone" | "rect";
type Selection = { kind: "element" | "zone"; id: string } | null;
type Image = { path: string; width: number; height: number };

const tools: { id: Tool; label: string; icon: LucideIcon }[] = [
  { id: "select", label: "Seleccionar", icon: MousePointer2 },
  { id: "table", label: "Mesa", icon: elementIcons.table },
  { id: "bar", label: "Barra", icon: elementIcons.bar },
  { id: "entrance", label: "Entrada", icon: elementIcons.entrance },
  { id: "stage", label: "Escenario", icon: elementIcons.stage },
  { id: "poi", label: "Referencia", icon: elementIcons.poi },
  {
    id: "delivery_point",
    label: "Punto de entrega",
    icon: elementIcons.delivery_point,
  },
  { id: "zone", label: "Zona", icon: Pentagon },
  { id: "rect", label: "Rectángulo", icon: Square },
];
const toolHint: Record<Tool, string> = {
  select:
    "Tocá un elemento o una zona para editarlo. Arrastrá los marcadores para moverlos.",
  table: "Tocá el plano para colocar una mesa.",
  bar: "Tocá el plano para colocar una barra.",
  entrance: "Tocá el plano para colocar una entrada.",
  stage: "Tocá el plano para colocar un escenario.",
  poi: "Tocá el plano para colocar un punto de referencia.",
  delivery_point: "Tocá el plano para colocar un punto de entrega.",
  zone: "Tocá el plano para marcar cada esquina de la zona y después cerrala.",
  rect: "Tocá dos esquinas opuestas para dibujar una zona rectangular.",
};
const newId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

function nextLabel(layout: MapLayout, type: ElementType) {
  if (type === "table") {
    const numbers = layout.elements
      .filter((e) => e.type === "table")
      .map((e) => Number(/(\d+)\s*$/.exec(e.label)?.[1] ?? 0));
    return `Mesa ${Math.max(0, ...numbers) + 1}`;
  }
  const count = layout.elements.filter((e) => e.type === type).length;
  return count
    ? `${elementTypeLabels[type]} ${count + 1}`
    : elementTypeLabels[type];
}

/**
 * Editor de mapas del administrador. Se trabaja sobre un borrador (se guarda sin afectar a los clientes) y «Publicar» crea una
 * versión nueva e inmutable: los pedidos anteriores conservan la versión del plano con la que se hicieron. Todo se coloca
 * tocando el plano; no hay coordenadas que escribir.
 */
export function MapEditor({
  venue,
  mapId,
  onBack,
}: {
  venue: { id: string; slug: string; name: string };
  mapId: string;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<MapDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [layout, setLayout] = useState<MapLayout>(emptyLayout());
  const [image, setImage] = useState<Image | null>(null);
  const [revision, setRevision] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection>(null);
  const [zoneDraft, setZoneDraft] = useState<Point[]>([]);
  const [rectStart, setRectStart] = useState<Point | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [upload, setUpload] = useState<"idle" | "preparing" | "uploading">(
    "idle",
  );
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [meta, setMeta] = useState({
    name: "",
    eventName: "",
    siteLabel: "",
    eventDate: "",
  });
  const [metaBusy, setMetaBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  /** Imágenes subidas que ya no se usan en el borrador: se intentan borrar al guardar (la base protege las publicadas). */
  const replaced = useRef<string[]>([]);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const d = mapDetailSchema.parse(
        await mapsGet({ map: mapId, detail: "1" }),
      );
      setDetail(d);
      setLayout(d.layout);
      setImage(
        d.image_path && d.image_width && d.image_height
          ? { path: d.image_path, width: d.image_width, height: d.image_height }
          : null,
      );
      setRevision(d.draft_revision);
      setMeta({
        name: d.name,
        eventName: d.event_name ?? "",
        siteLabel: d.site_label ?? "",
        eventDate: d.event_date ?? "",
      });
      setDirty(false);
      setSelection(null);
      replaced.current = [];
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "No pudimos cargar el mapa.",
      );
    }
  }, [mapId]);
  useEffect(() => {
    // La carga es asíncrona: el estado se aplica al responder, no durante el efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const readOnly = detail?.status === "archived";
  const edit = useCallback((change: (l: MapLayout) => MapLayout) => {
    setLayout(change);
    setDirty(true);
    setNotice("");
    setError("");
  }, []);
  const updateElement = (id: string, patch: Partial<MapElement>) =>
    edit((l) => ({
      ...l,
      elements: l.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  const updateZone = (id: string, patch: Partial<MapZone>) =>
    edit((l) => ({
      ...l,
      zones: l.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)),
    }));

  const addElement = (type: ElementType, at: Point) => {
    if (layout.elements.length >= 300)
      return setError("El plano admite hasta 300 elementos.");
    const element: MapElement = {
      id: newId("e"),
      type,
      label: nextLabel(layout, type),
      x: at.x,
      y: at.y,
    };
    edit((l) => ({ ...l, elements: [...l.elements, element] }));
    setSelection({ kind: "element", id: element.id });
  };
  const addZone = (points: Point[]) => {
    if (layout.zones.length >= 60)
      return setError("El plano admite hasta 60 zonas.");
    const zone: MapZone = {
      id: newId("z"),
      name: `Zona ${layout.zones.length + 1}`,
      kind: "general",
      delivery: "default",
      points,
    };
    edit((l) => ({ ...l, zones: [...l.zones, zone] }));
    setSelection({ kind: "zone", id: zone.id });
    setTool("select");
    setZoneDraft([]);
    setRectStart(null);
  };
  const cancelDrawing = () => {
    setZoneDraft([]);
    setRectStart(null);
  };
  const chooseTool = (next: Tool) => {
    cancelDrawing();
    setTool(next);
  };

  const onTap = (p: Point, { inside }: { inside: boolean }) => {
    if (readOnly || !inside) return;
    const q = { x: roundCoord(p.x), y: roundCoord(p.y) };
    if (tool === "select") {
      const zones = zonesAt(layout, q);
      const top = zones[zones.length - 1];
      setSelection(top ? { kind: "zone", id: top.id } : null);
    } else if (tool === "zone")
      setZoneDraft((d) => (d.length < 40 ? [...d, q] : d));
    else if (tool === "rect") {
      if (!rectStart) setRectStart(q);
      else {
        const [x1, x2] = [
          Math.min(rectStart.x, q.x),
          Math.max(rectStart.x, q.x),
        ];
        const [y1, y2] = [
          Math.min(rectStart.y, q.y),
          Math.max(rectStart.y, q.y),
        ];
        if (x2 - x1 < 0.01 || y2 - y1 < 0.01) return setRectStart(null);
        addZone([
          { x: x1, y: y1 },
          { x: x2, y: y1 },
          { x: x2, y: y2 },
          { x: x1, y: y2 },
        ]);
      }
    } else addElement(tool, q);
  };

  const markers = useMemo<ViewportMarker[]>(() => {
    const list: ViewportMarker[] = layout.elements.map((e) => ({
      id: `e-${e.id}`,
      point: e,
      kind: "icon",
      icon: e.type,
      label: e.label,
      ariaLabel: `${elementTypeLabels[e.type]} ${e.label}`,
      tone:
        selection?.kind === "element" && selection.id === e.id
          ? "selected"
          : "default",
      draggable: tool === "select" && !readOnly,
      alwaysLabel: selection?.kind === "element" && selection.id === e.id,
      onSelect: () => setSelection({ kind: "element", id: e.id }),
      onMove: (p) => {
        setSelection({ kind: "element", id: e.id });
        updateElement(e.id, { x: p.x, y: p.y });
      },
      onMoveEnd: (p) =>
        updateElement(e.id, { x: roundCoord(p.x), y: roundCoord(p.y) }),
    }));
    const zone =
      selection?.kind === "zone"
        ? layout.zones.find((z) => z.id === selection.id)
        : undefined;
    if (zone && tool === "select" && !readOnly)
      zone.points.forEach((pt, i) =>
        list.push({
          id: `v-${zone.id}-${i}`,
          point: pt,
          kind: "vertex",
          ariaLabel: `Punto ${i + 1} de ${zone.name}`,
          draggable: true,
          onMove: (p) =>
            updateZone(zone.id, {
              points: zone.points.map((q, j) => (j === i ? p : q)),
            }),
          onMoveEnd: (p) =>
            updateZone(zone.id, {
              points: zone.points.map((q, j) =>
                j === i ? { x: roundCoord(p.x), y: roundCoord(p.y) } : q,
              ),
            }),
        }),
      );
    zoneDraft.forEach((pt, i) =>
      list.push({
        id: `d-${i}`,
        point: pt,
        kind: "vertex",
        ariaLabel: `Punto ${i + 1} de la zona en dibujo`,
        tone: i === 0 ? "selected" : "default",
      }),
    );
    if (rectStart)
      list.push({
        id: "rect-start",
        point: rectStart,
        kind: "vertex",
        ariaLabel: "Primera esquina del rectángulo",
        tone: "selected",
      });
    return list;
    // `updateElement`/`updateZone` solo dependen de `edit`, que es estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, selection, tool, zoneDraft, rectStart, readOnly]);
  const zones = useMemo<ViewportZone[]>(
    () => [
      ...layout.zones.map((z) => ({
        ...z,
        selected: selection?.kind === "zone" && selection.id === z.id,
      })),
      ...(zoneDraft.length
        ? [
            {
              id: "__draft",
              kind: "general" as const,
              delivery: "default" as const,
              points: zoneDraft,
              draft: true,
            },
          ]
        : []),
    ],
    [layout.zones, selection, zoneDraft],
  );

  /** Guarda el borrador. Devuelve la revisión nueva, o null si no se pudo (el motivo queda en pantalla). */
  const save = async (): Promise<number | null> => {
    if (!detail) return null;
    if (!dirty) return revision;
    const parsed = mapLayoutSchema.safeParse(layout);
    if (!parsed.success) {
      setError("Revisá el plano: hay nombres vacíos o datos fuera del plano.");
      return null;
    }
    setSaving(true);
    setError("");
    try {
      const summary = mapSummarySchema.parse(
        await mapsCommand({
          action: "map_save_draft",
          mapId,
          expectedRevision: revision,
          layout: parsed.data,
          ...(image && image.path !== detail.image_path
            ? {
                imagePath: image.path,
                imageWidth: image.width,
                imageHeight: image.height,
              }
            : {}),
        }),
      );
      setRevision(summary.draft_revision);
      setDetail({ ...detail, ...summary });
      setDirty(false);
      setNotice("Borrador guardado.");
      void removeMapImages(replaced.current);
      replaced.current = [];
      return summary.draft_revision;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar el plano.");
      return null;
    } finally {
      setSaving(false);
    }
  };
  const publish = async () => {
    setPublishing(true);
    setError("");
    try {
      const saved = await save();
      if (saved === null) return;
      const summary = mapSummarySchema.parse(
        await mapsCommand({
          action: "map_publish",
          mapId,
          expectedRevision: saved,
        }),
      );
      setDetail((d) => (d ? { ...d, ...summary } : d));
      setRevision(summary.draft_revision);
      setPublishOpen(false);
      setNotice(
        `Versión ${summary.published_version} publicada. Los clientes ya la ven.`,
      );
    } catch (e) {
      setPublishOpen(false);
      setError(
        e instanceof Error ? e.message : "No pudimos publicar el plano.",
      );
    } finally {
      setPublishing(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !detail) return;
    setError("");
    const result = await uploadMapImage(venue.id, file, setUpload);
    setUpload("idle");
    if (!result.ok) return setError(result.message);
    if (image && image.path !== detail.image_path)
      replaced.current.push(image.path);
    setImage({ path: result.path, width: result.width, height: result.height });
    setDirty(true);
    setNotice(
      image
        ? "Plano cambiado. Revisá la posición de los elementos antes de publicar."
        : "Plano subido. Ya podés colocar mesas, barras y zonas.",
    );
  };

  const saveMeta = async () => {
    setMetaBusy(true);
    setError("");
    try {
      const summary = mapSummarySchema.parse(
        await mapsCommand({
          action: "map_update_meta",
          mapId,
          name: meta.name,
          eventName: meta.eventName,
          siteLabel: meta.siteLabel,
          ...(detail?.kind === "edition"
            ? { eventDate: meta.eventDate || null }
            : {}),
        }),
      );
      setDetail((d) => (d ? { ...d, ...summary } : d));
      setNotice("Datos del mapa guardados.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos guardar los datos.",
      );
    } finally {
      setMetaBusy(false);
    }
  };
  const assign = async (zoneId: string, userIds: string[]) => {
    if ((await save()) === null) return;
    try {
      const zone_staff = (await mapsCommand({
        action: "map_assign_staff",
        mapId,
        zoneId,
        userIds,
      })) as MapDetail["zone_staff"];
      setDetail((d) => (d ? { ...d, zone_staff } : d));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos asignar al personal.",
      );
    }
  };

  if (loadError)
    return (
      <Notice
        tone="danger"
        title="No pudimos abrir el mapa"
        action={
          <div className="row wrap">
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              Reintentar
            </Button>
            <Button variant="quiet" size="sm" onClick={onBack}>
              Volver
            </Button>
          </div>
        }
      >
        {loadError}
      </Notice>
    );
  if (!detail)
    return (
      <div
        className="sk"
        style={{ height: 320 }}
        aria-busy="true"
        aria-label="Abriendo el mapa"
      />
    );

  const selectedElement =
    selection?.kind === "element"
      ? layout.elements.find((e) => e.id === selection.id)
      : undefined;
  const selectedZone =
    selection?.kind === "zone"
      ? layout.zones.find((z) => z.id === selection.id)
      : undefined;
  const nextVersion = (detail.published_version ?? 0) + 1;
  const status = dirty
    ? "Cambios sin guardar"
    : detail.has_unpublished_changes
      ? "Borrador guardado · sin publicar"
      : "Publicado y al día";

  return (
    <div className="stack" data-testid="map-editor">
      <div className="row between wrap">
        <Button variant="quiet" size="sm" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Mapas
        </Button>
        <div className="row wrap" style={{ gap: 8 }}>
          <StatusBadge
            tone={
              detail.status === "published"
                ? "success"
                : detail.status === "archived"
                  ? "danger"
                  : "neutral"
            }
          >
            {detail.status === "published"
              ? `Publicado v${detail.published_version}`
              : detail.status === "archived"
                ? "Archivado"
                : "Borrador"}
          </StatusBadge>
          <StatusBadge tone={dirty ? "warning" : "neutral"} plain>
            {status}
          </StatusBadge>
        </div>
      </div>
      <h2>{detail.name}</h2>
      {readOnly && (
        <Notice tone="warning" title="Mapa archivado">
          Restauralo desde la lista de mapas para editarlo.
        </Notice>
      )}
      {error && (
        <Notice tone="danger" title="No se pudo completar">
          {error}
        </Notice>
      )}
      {notice && !error && <Notice tone="success">{notice}</Notice>}

      <div className={styles.editor}>
        <div className="stack">
          <div className={styles.editorMap}>
            {image ? (
              <MapViewport
                imageUrl={mapImageUrl(image.path)}
                imageWidth={image.width}
                imageHeight={image.height}
                label={`Editor del plano ${detail.name}`}
                zones={zones}
                markers={markers}
                onTap={onTap}
                doubleTapZoom={false}
                maxScale={10}
              />
            ) : (
              <div className={styles.dropzone}>
                <UploadCloud size={32} aria-hidden="true" />
                <strong>Subí el plano del local o del evento</strong>
                <span className="muted t-label">
                  JPG, PNG, WebP o SVG seguro. Se optimiza solo para que cargue
                  rápido en el teléfono.
                </span>
                <Button
                  onClick={() => fileInput.current?.click()}
                  loading={upload !== "idle"}
                  disabled={readOnly}
                >
                  <ImagePlus size={20} aria-hidden="true" />{" "}
                  {upload === "preparing"
                    ? "Optimizando…"
                    : upload === "uploading"
                      ? "Subiendo…"
                      : "Subir plano"}
                </Button>
              </div>
            )}
          </div>
          {image && (
            <p className="muted t-label" role="status">
              {toolHint[tool]}
            </p>
          )}
          {zoneDraft.length > 0 && (
            <div className="row wrap">
              <Button
                size="sm"
                disabled={zoneDraft.length < 3}
                onClick={() => addZone(zoneDraft)}
              >
                Cerrar zona ({zoneDraft.length} puntos)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setZoneDraft((d) => d.slice(0, -1))}
              >
                Deshacer punto
              </Button>
              <Button variant="quiet" size="sm" onClick={cancelDrawing}>
                Cancelar
              </Button>
            </div>
          )}
        </div>

        <aside className={styles.editorSide} aria-label="Herramientas del mapa">
          {image && !readOnly && (
            <div className="stack">
              <div
                className={styles.tools}
                role="group"
                aria-label="Herramientas"
              >
                {tools.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={styles.tool}
                    aria-pressed={tool === id}
                    onClick={() => chooseTool(id)}
                    data-tool={id}
                  >
                    <Icon size={18} aria-hidden="true" /> {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedElement && !readOnly && (
            <ElementInspector
              element={selectedElement}
              slug={venue.slug}
              onChange={(patch) => updateElement(selectedElement.id, patch)}
              onDelete={() => {
                edit((l) => ({
                  ...l,
                  elements: l.elements.filter(
                    (e) => e.id !== selectedElement.id,
                  ),
                }));
                setSelection(null);
              }}
            />
          )}
          {selectedZone && !readOnly && (
            <ZoneInspector
              zone={selectedZone}
              team={detail.team}
              assigned={(detail.zone_staff[selectedZone.id] ?? []).map(
                (s) => s.user_id,
              )}
              onChange={(patch) => updateZone(selectedZone.id, patch)}
              onDelete={() => {
                edit((l) => ({
                  ...l,
                  zones: l.zones.filter((z) => z.id !== selectedZone.id),
                }));
                setSelection(null);
              }}
              onAssign={(ids) => void assign(selectedZone.id, ids)}
            />
          )}
          <section aria-label="Elementos y zonas">
            <h3 className="t-label">
              Elementos ({layout.elements.length}) y zonas (
              {layout.zones.length})
            </h3>
            {layout.elements.length + layout.zones.length === 0 ? (
              <p className="muted t-label">
                Todavía no hay nada. Elegí una herramienta y tocá el plano.
              </p>
            ) : (
              <ul className={styles.itemList} data-testid="item-list">
                {layout.zones.map((z) => (
                  <li key={z.id}>
                    <button
                      type="button"
                      aria-current={
                        selection?.kind === "zone" && selection.id === z.id
                      }
                      onClick={() => {
                        setTool("select");
                        setSelection({ kind: "zone", id: z.id });
                      }}
                    >
                      <Pentagon size={16} aria-hidden="true" /> {z.name}
                    </button>
                  </li>
                ))}
                {layout.elements.map((e) => {
                  const Icon = ELEMENT_TYPES.includes(e.type)
                    ? elementIcons[e.type]
                    : elementIcons.poi;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        aria-current={
                          selection?.kind === "element" && selection.id === e.id
                        }
                        onClick={() => {
                          setTool("select");
                          setSelection({ kind: "element", id: e.id });
                        }}
                      >
                        <Icon size={16} aria-hidden="true" /> {e.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="stack" aria-label="Datos del mapa">
            <h3 className="t-label">Datos del mapa</h3>
            <TextField
              label="Nombre"
              value={meta.name}
              maxLength={100}
              onChange={(e) => setMeta({ ...meta, name: e.target.value })}
            />
            {detail.kind === "edition" && (
              <>
                <TextField
                  label="Evento"
                  value={meta.eventName}
                  maxLength={100}
                  onChange={(e) =>
                    setMeta({ ...meta, eventName: e.target.value })
                  }
                />
                <TextField
                  label="Sede"
                  value={meta.siteLabel}
                  maxLength={100}
                  onChange={(e) =>
                    setMeta({ ...meta, siteLabel: e.target.value })
                  }
                />
                <TextField
                  label="Fecha de la edición"
                  type="date"
                  value={meta.eventDate}
                  onChange={(e) =>
                    setMeta({ ...meta, eventDate: e.target.value })
                  }
                  hint="El plano se ofrece a los clientes solo la noche de esta fecha."
                />
              </>
            )}
            <Button
              variant="secondary"
              size="sm"
              loading={metaBusy}
              disabled={readOnly || !meta.name.trim()}
              onClick={() => void saveMeta()}
            >
              Guardar datos
            </Button>
            <input
              ref={fileInput}
              type="file"
              hidden
              accept={MAP_IMAGE_ACCEPT}
              data-testid="map-image-input"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {image && (
              <Button
                variant="secondary"
                size="sm"
                loading={upload !== "idle"}
                disabled={readOnly}
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus size={16} aria-hidden="true" />{" "}
                {upload === "preparing"
                  ? "Optimizando…"
                  : upload === "uploading"
                    ? "Subiendo…"
                    : "Cambiar plano"}
              </Button>
            )}
          </section>
          {detail.versions.length > 0 && (
            <section aria-label="Versiones publicadas">
              <h3 className="t-label">Versiones publicadas</h3>
              <ul
                className="muted t-label"
                style={{ margin: 0, paddingLeft: 18 }}
              >
                {detail.versions.map((v) => (
                  <li key={v.version}>
                    Versión {v.version} ·{" "}
                    {new Date(v.published_at).toLocaleString("es-CR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </li>
                ))}
              </ul>
              <p className="muted t-label">
                Los pedidos conservan la versión con la que se hicieron.
              </p>
            </section>
          )}
        </aside>
      </div>

      <div className={styles.saveBar}>
        <span className="grow t-label" role="status">
          {saving ? "Guardando…" : status}
        </span>
        <Button
          variant="secondary"
          disabled={!image}
          onClick={() => setPreviewOpen(true)}
        >
          <Eye size={18} aria-hidden="true" /> Probar como cliente
        </Button>
        <Button
          variant="secondary"
          loading={saving}
          disabled={!dirty || readOnly}
          onClick={() => void save()}
        >
          <Save size={18} aria-hidden="true" /> Guardar borrador
        </Button>
        <Button
          disabled={
            !image || readOnly || (!dirty && !detail.has_unpublished_changes)
          }
          onClick={() => setPublishOpen(true)}
        >
          Publicar
        </Button>
      </div>

      <Sheet
        open={publishOpen}
        onOpenChange={(open) => !publishing && setPublishOpen(open)}
        title={`Publicar versión ${nextVersion}`}
        description="Los clientes verán este plano de inmediato. Los pedidos ya hechos conservan su ubicación y la versión del plano con la que se hicieron."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setPublishOpen(false)}
              disabled={publishing}
            >
              Volver
            </Button>
            <Button loading={publishing} onClick={() => void publish()}>
              Publicar versión {nextVersion}
            </Button>
          </>
        }
      />
      {previewOpen && image && (
        <LocationPicker
          open
          preview
          onOpenChange={setPreviewOpen}
          maps={[
            {
              id: detail.id,
              name: detail.name,
              kind: detail.kind,
              event_name: detail.event_name,
              site_label: detail.site_label,
              version: nextVersion,
              image_path: image.path,
              image_width: image.width,
              image_height: image.height,
              layout,
            },
          ]}
          onConfirm={() => undefined}
        />
      )}
    </div>
  );
}
