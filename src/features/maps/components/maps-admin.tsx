"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Map as MapIcon, Pencil, Plus } from "lucide-react";
import {
  Button,
  EmptyState,
  Notice,
  SegmentedControl,
  StatusBadge,
  TextField,
} from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { mapsCommand, mapsGet } from "../client-api";
import {
  mapSummariesSchema,
  mapSummarySchema,
  type MapSummary,
} from "../types";
import { MapEditor } from "./map-editor";
import styles from "./maps.module.css";

type Venue = { id: string; slug: string; name: string };
type Kind = "permanent" | "edition";
const formatDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("es-CR", {
    dateStyle: "medium",
  });

type FormState = {
  name: string;
  kind: Kind;
  eventName: string;
  siteLabel: string;
  eventDate: string;
};
const blank: FormState = {
  name: "",
  kind: "permanent",
  eventName: "",
  siteLabel: "",
  eventDate: "",
};

function MapForm({
  value,
  onChange,
  allowKind = true,
}: {
  value: FormState;
  onChange: (v: FormState) => void;
  allowKind?: boolean;
}) {
  return (
    <div className="stack">
      <TextField
        label="Nombre del mapa"
        value={value.name}
        maxLength={100}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        placeholder="Planta baja, Terraza, Festival 2027…"
      />
      {allowKind && (
        <SegmentedControl
          label="Tipo de mapa"
          value={value.kind}
          options={[
            { value: "permanent", label: "Permanente" },
            { value: "edition", label: "Edición de evento" },
          ]}
          onChange={(kind) => onChange({ ...value, kind })}
          block
        />
      )}
      {value.kind === "edition" && (
        <>
          <TextField
            label="Evento"
            value={value.eventName}
            maxLength={100}
            onChange={(e) => onChange({ ...value, eventName: e.target.value })}
          />
          <TextField
            label="Sede"
            value={value.siteLabel}
            maxLength={100}
            onChange={(e) => onChange({ ...value, siteLabel: e.target.value })}
          />
          <TextField
            label="Fecha de la edición"
            type="date"
            value={value.eventDate}
            onChange={(e) => onChange({ ...value, eventDate: e.target.value })}
            hint="El plano se ofrece a los clientes solo la noche de esta fecha."
          />
        </>
      )}
    </div>
  );
}

/** Pestaña «Mapas» de administración: lista, crea, duplica, archiva y abre el editor. */
export function MapsAdmin({
  venue,
  editMapId,
}: {
  venue: Venue;
  editMapId?: string;
}) {
  const router = useRouter();
  const [maps, setMaps] = useState<MapSummary[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [duplicating, setDuplicating] = useState<MapSummary | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setMaps(
        mapSummariesSchema.parse(
          await mapsGet({ venue: venue.id, scope: "admin" }),
        ),
      );
    } catch (e) {
      setMaps(null);
      setError(e instanceof Error ? e.message : "No pudimos cargar los mapas.");
    }
  }, [venue.id]);
  useEffect(() => {
    // La carga es asíncrona: el estado se aplica al responder.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editMapId) void load();
  }, [load, editMapId]);

  const open = (id: string) =>
    router.push(`/admin/${venue.id}?tab=mapas&mapa=${id}`);
  const back = () => router.push(`/admin/${venue.id}?tab=mapas`);
  const payload = (f: FormState) => ({
    name: f.name.trim(),
    kind: f.kind,
    eventName: f.eventName.trim(),
    siteLabel: f.siteLabel.trim(),
    ...(f.kind === "edition" ? { eventDate: f.eventDate } : {}),
  });
  const valid = (f: FormState) =>
    f.name.trim().length > 0 &&
    (f.kind === "permanent" || /^\d{4}-\d{2}-\d{2}$/.test(f.eventDate));

  const create = async () => {
    setBusy("create");
    try {
      const summary = mapSummarySchema.parse(
        await mapsCommand({
          action: "map_create",
          venueId: venue.id,
          ...payload(form),
        }),
      );
      setCreating(false);
      open(summary.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos crear el mapa.");
      setCreating(false);
    } finally {
      setBusy(null);
    }
  };
  const duplicate = async () => {
    if (!duplicating) return;
    setBusy("duplicate");
    try {
      const summary = mapSummarySchema.parse(
        await mapsCommand({
          action: "map_duplicate",
          mapId: duplicating.id,
          ...payload(form),
        }),
      );
      setDuplicating(null);
      open(summary.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos duplicar el mapa.");
      setDuplicating(null);
    } finally {
      setBusy(null);
    }
  };
  const archive = async (m: MapSummary) => {
    setBusy(m.id);
    try {
      await mapsCommand({
        action: "map_archive",
        mapId: m.id,
        archived: m.status !== "archived",
      });
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos cambiar el estado del mapa.",
      );
    } finally {
      setBusy(null);
    }
  };

  if (editMapId)
    return <MapEditor venue={venue} mapId={editMapId} onBack={back} />;
  return (
    <div className="stack" data-testid="maps-admin">
      <div className="row between wrap">
        <div>
          <h2>Mapas del local</h2>
          <p className="muted t-label">
            Con un plano, el cliente marca dónde está y el equipo le lleva el
            pedido. Sin plano, se retira en la barra como siempre.
          </p>
        </div>
        <Button
          onClick={() => {
            setForm(blank);
            setCreating(true);
          }}
        >
          <Plus size={18} aria-hidden="true" /> Nuevo mapa
        </Button>
      </div>
      {error && (
        <Notice
          tone="danger"
          title="No se pudo completar"
          action={
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Notice>
      )}
      {!maps && !error && (
        <div
          className="sk"
          style={{ height: 120 }}
          aria-busy="true"
          aria-label="Cargando mapas"
        />
      )}
      {maps && maps.length === 0 && (
        <EmptyState title="Todavía no hay mapas" icon={MapIcon}>
          Subí el plano de tu local o de un evento y marcá mesas, barras y
          zonas.
        </EmptyState>
      )}
      <div className={styles.mapList}>
        {maps?.map((m) => (
          <article
            key={m.id}
            className={styles.card}
            aria-label={`Mapa ${m.name}`}
            data-testid="map-card"
          >
            <div className="row between wrap" style={{ gap: 8 }}>
              <strong>{m.name}</strong>
              <div className="row wrap" style={{ gap: 6 }}>
                <StatusBadge
                  tone={
                    m.status === "published"
                      ? "success"
                      : m.status === "archived"
                        ? "danger"
                        : "neutral"
                  }
                >
                  {m.status === "published"
                    ? `Publicado v${m.published_version}`
                    : m.status === "archived"
                      ? "Archivado"
                      : "Borrador"}
                </StatusBadge>
                {m.has_unpublished_changes && m.status !== "draft" && (
                  <StatusBadge tone="warning">Cambios sin publicar</StatusBadge>
                )}
                {m.available_now && (
                  <StatusBadge tone="brand">Visible ahora</StatusBadge>
                )}
              </div>
            </div>
            <div className="muted t-label">
              {m.kind === "edition"
                ? `Edición${m.event_name ? ` · ${m.event_name}` : ""}${m.event_date ? ` · ${formatDate(m.event_date)}` : ""}${m.site_label ? ` · ${m.site_label}` : ""}`
                : "Permanente"}
              {" · "}
              {m.elements} {m.elements === 1 ? "elemento" : "elementos"} ·{" "}
              {m.zones} {m.zones === 1 ? "zona" : "zonas"}
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              <Button variant="secondary" size="sm" onClick={() => open(m.id)}>
                <Pencil size={16} aria-hidden="true" /> Editar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setForm({
                    name: `${m.name} (copia)`.slice(0, 100),
                    kind: m.kind,
                    eventName: m.event_name ?? "",
                    siteLabel: m.site_label ?? "",
                    eventDate: m.event_date ?? "",
                  });
                  setDuplicating(m);
                }}
              >
                <Copy size={16} aria-hidden="true" /> Duplicar
              </Button>
              <Button
                variant="quiet"
                size="sm"
                loading={busy === m.id}
                onClick={() => void archive(m)}
              >
                {m.status === "archived" ? "Restaurar" : "Archivar"}
              </Button>
            </div>
          </article>
        ))}
      </div>
      <Sheet
        open={creating}
        onOpenChange={(o) => busy !== "create" && setCreating(o)}
        title="Nuevo mapa"
        description="Después subís el plano y colocás mesas, barras y zonas."
        actions={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button
              loading={busy === "create"}
              disabled={!valid(form)}
              onClick={() => void create()}
            >
              Crear y editar
            </Button>
          </>
        }
      >
        <MapForm value={form} onChange={setForm} />
      </Sheet>
      <Sheet
        open={!!duplicating}
        onOpenChange={(o) => busy !== "duplicate" && !o && setDuplicating(null)}
        title="Duplicar mapa"
        description="Copia la imagen y el plano como un borrador nuevo. No copia versiones ni personal asignado; podés ajustarlo antes de publicar."
        actions={
          <>
            <Button variant="secondary" onClick={() => setDuplicating(null)}>
              Cancelar
            </Button>
            <Button
              loading={busy === "duplicate"}
              disabled={!valid(form)}
              onClick={() => void duplicate()}
            >
              Duplicar y editar
            </Button>
          </>
        }
      >
        <MapForm value={form} onChange={setForm} />
      </Sheet>
    </div>
  );
}
