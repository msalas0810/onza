"use client";
import { useRef, useState } from "react";
import { ImagePlus, Trash2, Undo2 } from "lucide-react";
import type { Venue } from "@/features/catalog/server/queries";
import {
  Button,
  Notice,
  SegmentedControl,
  StatusBadge,
  TextField,
} from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { uploadVenueImage } from "@/features/admin/upload-venue-image";
import {
  CIRCLE_MAX_R,
  DEFAULT_TABLE_R,
  hitSpot,
  roundPoint,
  type CircleShape,
  type Pt,
  type Shape,
} from "../geometry";
import { prepareMapImage } from "../prepare-map-image";
import type { Spot, VenueMap } from "../types";
import { PlanMap } from "./plan-map";

type Run = (
  input: Record<string, unknown>,
  message: string,
) => Promise<unknown | null>;
type Tool = "select" | "place" | "zone" | "area";
type Naming =
  { kind: "table"; x: number; y: number } | { kind: "zone"; points: Pt[] };

const toolOptions = [
  { value: "select", label: "Editar" },
  { value: "place", label: "Mesas" },
  { value: "zone", label: "Zonas" },
  { value: "area", label: "Área" },
] as const;
const toolHelp: Record<Tool, string> = {
  select:
    "Tocá una mesa o una zona del mapa para cambiarle el nombre, el tamaño o la posición.",
  place:
    "Elegí qué lugar ubicar y tocá el mapa donde está. Cada toque ubica uno y pasa al siguiente.",
  zone: "Tocá las esquinas de la zona en orden, como si la dibujaras con el dedo. Hacen falta al menos 3.",
  area: "Tocá las esquinas del área donde sí se entrega. Lo que quede fuera se oscurece para el cliente. Sin áreas, vale toda la imagen.",
};

/** «Mesa 11»: la palabra del local y el número siguiente al más alto que ya existe. */
function nextLabel(spots: Spot[], noun: string) {
  const top = spots.reduce((max, s) => {
    const n = /(\d+)\s*$/.exec(s.label);
    return n ? Math.max(max, Number(n[1])) : max;
  }, 0);
  return `${noun} ${top + 1}`.slice(0, 40);
}

/**
 * Mapa del local en Administración → Entrega: se sube el plano o una foto y se marcan sobre la imagen el área de servicio, las
 * mesas (círculos) y las zonas (polígonos), reutilizando los lugares que el local ya tiene. La base valida cada cambio.
 */
export function MapAdmin({
  venue,
  map,
  spots,
  noun,
  busy,
  run,
}: {
  venue: Venue;
  map: VenueMap | null;
  spots: Spot[];
  noun: string;
  busy: boolean;
  run: Run;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [tool, setToolState] = useState<Tool>("select");
  const [armed, setArmed] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Pt[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editR, setEditR] = useState(DEFAULT_TABLE_R);
  const [relocating, setRelocating] = useState(false);
  const [naming, setNaming] = useState<Naming | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [areaValue, setAreaValue] = useState("");
  const [lastR, setLastR] = useState(DEFAULT_TABLE_R);
  const [removing, setRemoving] = useState(false);

  const unplaced = spots.filter((s) => !s.shape);
  const selected = spots.find((s) => s.id === selectedId) ?? null;
  const placedCount = spots.length - unplaced.length;

  const setTool = (next: Tool) => {
    setToolState(next);
    setDraft([]);
    setRelocating(false);
    setSelectedId(null);
    setArmed(
      next === "place" ? (spots.find((s) => !s.shape)?.id ?? "new") : null,
    );
  };

  const upload = async (file: File) => {
    setUploading(true);
    setUploadError("");
    try {
      const prepared = await prepareMapImage(file);
      if (!prepared.ok) return setUploadError(prepared.message);
      const stored = await uploadVenueImage(
        venue.id,
        "map",
        prepared.image.file,
      );
      if (!stored.ok) return setUploadError(stored.message);
      await run(
        {
          action: "map_save",
          venueId: venue.id,
          imageUrl: stored.url,
          width: prepared.image.width,
          height: prepared.image.height,
        },
        map
          ? "Imagen reemplazada. Revisá que las mesas sigan en su lugar."
          : "Mapa cargado. Ahora marcá el área y las mesas.",
      );
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const select = (spot: Spot | null) => {
    setSelectedId(spot?.id ?? null);
    setRelocating(false);
    if (spot) {
      setEditName(spot.label);
      setEditArea(spot.area);
      if (spot.shape?.kind === "circle") setEditR(spot.shape.r);
    }
  };

  const circleAt = (x: number, y: number, r: number): CircleShape => ({
    kind: "circle",
    x: roundPoint(x),
    y: roundPoint(y),
    r,
  });

  const onPick = async (p: { x: number; y: number }) => {
    if (!map || busy) return;
    if (tool === "select") {
      if (relocating && selected?.shape?.kind === "circle") {
        const ok = await run(
          {
            action: "spot_save",
            venueId: venue.id,
            spotId: selected.id,
            label: selected.label,
            area: selected.area,
            shape: circleAt(p.x, p.y, editR),
          },
          `${selected.label} movida.`,
        );
        if (ok) setRelocating(false);
        return;
      }
      select(hitSpot(spots, map, p.x, p.y));
      return;
    }
    if (tool === "place") {
      const target =
        armed && armed !== "new"
          ? spots.find((s) => s.id === armed)
          : undefined;
      if (target) {
        const ok = await run(
          {
            action: "spot_save",
            venueId: venue.id,
            spotId: target.id,
            label: target.label,
            area: target.area,
            shape: circleAt(p.x, p.y, lastR),
          },
          `${target.label} ubicada.`,
        );
        if (ok)
          setArmed(
            spots.find((s) => !s.shape && s.id !== target.id)?.id ?? "new",
          );
        return;
      }
      setNameValue(nextLabel(spots, noun));
      setAreaValue("");
      setNaming({ kind: "table", x: p.x, y: p.y });
      return;
    }
    // Zona o área de servicio: cada toque agrega una esquina.
    setDraft((d) =>
      d.length < 60 ? [...d, [roundPoint(p.x), roundPoint(p.y)]] : d,
    );
  };

  const closeDraft = async () => {
    if (draft.length < 3) return;
    if (tool === "zone") {
      setNameValue(
        `Zona ${spots.filter((s) => s.shape?.kind === "polygon").length + 1}`,
      );
      setNaming({ kind: "zone", points: draft });
      return;
    }
    const ok = await run(
      {
        action: "map_area",
        venueId: venue.id,
        serviceArea: [...(map?.serviceArea ?? []), { points: draft }],
      },
      "Área de servicio guardada.",
    );
    if (ok) setDraft([]);
  };

  const confirmNaming = async () => {
    if (!naming) return;
    const ok = await run(
      naming.kind === "table"
        ? {
            action: "spot_save",
            venueId: venue.id,
            label: nameValue,
            area: areaValue,
            shape: circleAt(naming.x, naming.y, lastR),
          }
        : {
            action: "spot_save",
            venueId: venue.id,
            label: nameValue,
            area: "",
            shape: { kind: "polygon", points: naming.points } satisfies Shape,
          },
      naming.kind === "table"
        ? `${nameValue.trim()} ubicada.`
        : `${nameValue.trim()} guardada.`,
    );
    if (ok) {
      setNaming(null);
      if (naming.kind === "zone") setDraft([]);
    }
  };

  const saveSelected = async () => {
    if (!selected) return;
    const shape: Shape | null | undefined =
      selected.shape?.kind === "circle"
        ? { ...selected.shape, r: editR }
        : selected.shape;
    const ok = await run(
      {
        action: "spot_save",
        venueId: venue.id,
        spotId: selected.id,
        label: editName,
        area: editArea,
        shape,
      },
      "Cambios guardados.",
    );
    if (ok && selected.shape?.kind === "circle") setLastR(editR);
  };

  // La administración ve el tamaño nuevo mientras lo mueve, antes de guardar.
  const shownSpots = spots.map((s) =>
    s.id === selectedId && s.shape?.kind === "circle"
      ? { ...s, shape: { ...s.shape, r: editR } }
      : s,
  );
  const pts = (list: Pt[]) =>
    list
      .map(([x, y]) => `${x * (map?.width ?? 1)},${y * (map?.height ?? 1)}`)
      .join(" ");
  const W = map?.width ?? 1;
  const H = map?.height ?? 1;

  return (
    <section className="block-card" aria-labelledby="delivery-map">
      <div className="row between wrap">
        <h2 id="delivery-map">Mapa del local</h2>
        {map ? (
          <StatusBadge tone="success">Mapa cargado</StatusBadge>
        ) : (
          <StatusBadge>Sin mapa</StatusBadge>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Elegir la imagen del mapa"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {uploadError && <Notice tone="danger">{uploadError}</Notice>}
      {!map ? (
        <>
          <p className="muted">
            Subí el plano del local o una foto desde arriba. El cliente toca el
            mapa donde está sentado y el pin le llega a la barra en el mismo
            lugar. Después marcás el área de servicio y las mesas sobre la
            imagen.
          </p>
          <div>
            <Button
              variant="secondary"
              loading={uploading}
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus size={18} aria-hidden="true" /> Subir plano o foto
            </Button>
          </div>
          <p className="muted t-label">
            JPG, PNG o WebP. Se reduce solo para que cargue rápido en el
            teléfono. Sin mapa, el cliente elige de la lista de lugares.
          </p>
        </>
      ) : (
        <>
          <SegmentedControl<Tool>
            block
            label="Qué marcar en el mapa"
            value={tool}
            options={toolOptions}
            onChange={setTool}
          />
          <p className="muted t-label" role="status">
            {toolHelp[tool]}
          </p>
          <PlanMap
            map={map}
            serviceArea={map.serviceArea}
            spots={shownSpots}
            selectedSpotId={selectedId}
            restrict={false}
            maxVh={64}
            label={`Mapa de ${venue.name} para marcar áreas y mesas`}
            onPick={(p) => void onPick(p)}
            overlay={
              draft.length > 0 ? (
                <>
                  {draft.length >= 3 && (
                    <polygon className="plan-draft-fill" points={pts(draft)} />
                  )}
                  <polyline className="plan-draft" points={pts(draft)} />
                  {draft.map(([x, y], i) => (
                    <circle
                      key={i}
                      className="plan-vertex"
                      cx={x * W}
                      cy={y * H}
                      r={0.008 * W}
                    />
                  ))}
                </>
              ) : null
            }
          />

          {tool === "place" && (
            <div className="stack">
              <div className="chips" role="group" aria-label="Qué lugar ubicar">
                {unplaced.map((s) => (
                  <button
                    type="button"
                    className="chip"
                    key={s.id}
                    aria-current={armed === s.id ? "true" : undefined}
                    onClick={() => setArmed(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="chip"
                  aria-current={armed === "new" ? "true" : undefined}
                  onClick={() => setArmed("new")}
                >
                  + Nuevo
                </button>
              </div>
              <p className="muted t-label">
                {unplaced.length
                  ? `${unplaced.length} ${unplaced.length === 1 ? "lugar sin ubicar" : "lugares sin ubicar"} en el mapa.`
                  : "Todos los lugares de la lista ya están en el mapa."}
                {armed && armed !== "new"
                  ? " Tocá el mapa para ubicar el elegido."
                  : " Tocá el mapa para crear uno nuevo."}
              </p>
            </div>
          )}

          {(tool === "zone" || tool === "area") && (
            <div className="row wrap">
              <Button
                size="sm"
                onClick={() => void closeDraft()}
                disabled={draft.length < 3}
                loading={busy}
              >
                {tool === "zone" ? "Cerrar la zona" : "Guardar el área"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setDraft((d) => d.slice(0, -1))}
                disabled={!draft.length}
              >
                <Undo2 size={16} aria-hidden="true" /> Deshacer punto
              </Button>
              <Button
                size="sm"
                variant="quiet"
                onClick={() => setDraft([])}
                disabled={!draft.length}
              >
                Cancelar
              </Button>
              <span className="muted t-label">{draft.length} puntos</span>
            </div>
          )}

          {tool === "area" && (
            <div className="rows">
              {map.serviceArea.length === 0 && (
                <p className="muted t-label">
                  Sin área de servicio: se puede marcar en toda la imagen.
                </p>
              )}
              {map.serviceArea.map((_, i) => (
                <div className="r wrap" key={i}>
                  <strong className="grow">Área {i + 1}</strong>
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() =>
                      void run(
                        {
                          action: "map_area",
                          venueId: venue.id,
                          serviceArea: map.serviceArea.filter(
                            (_, j) => j !== i,
                          ),
                        },
                        "Área quitada.",
                      )
                    }
                  >
                    <Trash2 size={16} aria-hidden="true" /> Quitar
                  </Button>
                </div>
              ))}
            </div>
          )}

          {tool === "select" && selected && (
            <div className="stack block-inner" aria-live="polite">
              <h3>{selected.label}</h3>
              {!selected.shape ? (
                <p className="muted t-label">
                  Este lugar todavía no está en el mapa. Usá «Mesas» para
                  ubicarlo.
                </p>
              ) : null}
              <div className="spot-form">
                <TextField
                  label="Nombre"
                  value={editName}
                  maxLength={40}
                  onChange={(e) => setEditName(e.target.value)}
                />
                {selected.shape?.kind !== "polygon" && (
                  <TextField
                    label="Zona (opcional)"
                    value={editArea}
                    maxLength={40}
                    onChange={(e) => setEditArea(e.target.value)}
                  />
                )}
              </div>
              {selected.shape?.kind === "circle" && (
                <label className="field">
                  <span>Tamaño del área de la mesa</span>
                  <input
                    type="range"
                    min={0.008}
                    max={Math.min(CIRCLE_MAX_R, 0.1)}
                    step={0.001}
                    value={editR}
                    onChange={(e) => setEditR(Number(e.target.value))}
                  />
                  <span className="muted t-label">
                    Todo toque dentro del círculo cuenta como esta mesa.
                  </span>
                </label>
              )}
              <div className="row wrap">
                <Button
                  size="sm"
                  loading={busy}
                  disabled={!editName.trim()}
                  onClick={() => void saveSelected()}
                >
                  Guardar
                </Button>
                {selected.shape?.kind === "circle" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setRelocating((v) => !v)}
                  >
                    {relocating ? "Tocá el mapa para moverla" : "Mover"}
                  </Button>
                )}
                {selected.shape && (
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() =>
                      void run(
                        {
                          action: "spot_save",
                          venueId: venue.id,
                          spotId: selected.id,
                          label: selected.label,
                          area: selected.area,
                          shape: null,
                        },
                        `${selected.label} quitada del mapa (sigue en la lista).`,
                      )
                    }
                  >
                    Quitar del mapa
                  </Button>
                )}
              </div>
            </div>
          )}

          <p className="muted t-label">
            {placedCount} de {spots.length} lugares en el mapa ·{" "}
            {map.serviceArea.length || "sin"}{" "}
            {map.serviceArea.length === 1 ? "área" : "áreas"} de servicio.
          </p>
          <div className="row wrap">
            <Button
              variant="secondary"
              size="sm"
              loading={uploading}
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus size={16} aria-hidden="true" /> Cambiar la imagen
            </Button>
            <Button variant="quiet" size="sm" onClick={() => setRemoving(true)}>
              Quitar el mapa
            </Button>
          </div>
        </>
      )}

      <Sheet
        open={naming !== null}
        onOpenChange={(o) => !o && setNaming(null)}
        title={
          naming?.kind === "zone"
            ? "Nombre de la zona"
            : `Nueva ${noun.toLowerCase()}`
        }
        description={
          naming?.kind === "zone"
            ? "Así la ve el cliente cuando toca dentro de ella."
            : "Quedará ubicada donde tocaste."
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setNaming(null)}>
              Volver
            </Button>
            <Button
              loading={busy}
              disabled={!nameValue.trim()}
              onClick={() => void confirmNaming()}
            >
              Guardar
            </Button>
          </>
        }
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameValue.trim()) void confirmNaming();
          }}
        >
          <TextField
            label="Nombre"
            value={nameValue}
            maxLength={40}
            autoFocus
            onChange={(e) => setNameValue(e.target.value)}
          />
          {naming?.kind === "table" && (
            <TextField
              label="Zona (opcional)"
              value={areaValue}
              maxLength={40}
              onChange={(e) => setAreaValue(e.target.value)}
            />
          )}
        </form>
      </Sheet>
      <Sheet
        open={removing}
        onOpenChange={setRemoving}
        title="¿Quitar el mapa?"
        description="Los lugares siguen en la lista, pero pierden su posición en el mapa. Los pedidos anteriores conservan su pin."
        actions={
          <>
            <Button variant="secondary" onClick={() => setRemoving(false)}>
              Volver
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                setRemoving(false);
                setTool("select");
                await run(
                  { action: "map_remove", venueId: venue.id },
                  "Mapa quitado: el cliente elige de la lista.",
                );
              }}
            >
              Quitar
            </Button>
          </>
        }
      />
    </section>
  );
}
