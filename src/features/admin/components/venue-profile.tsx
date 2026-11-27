"use client";
import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, StatusBadge, TextField } from "@/components/ui/primitives";
import { VenueCard, coverPosition } from "@/features/catalog/components/venue-card";
import { VenueMark } from "@/features/catalog/components/venue-parts";
import type { Venue } from "@/features/catalog/server/queries";
import { sendCommand } from "@/features/orders/client-api";
import { browserDb } from "@/lib/supabase/browser";
import {
  VENUE_IMAGE_ACCEPT,
  VENUE_IMAGE_BUCKET,
  checkVenueImage,
  venueImagePath,
  venueImagePathFromUrl,
  type VenueImageKind,
} from "../venue-image";

/** The venue profile only handles these two; product images are edited in the drink editor. */
type BrandingKind = Exclude<VenueImageKind, "product" | "map">;

const copy: Record<
  BrandingKind,
  { label: string; hint: string; remove: string }
> = {
  cover: {
    label: "Portada del local",
    hint: "JPG, PNG o WebP, máximo 2 MB. Horizontal, 1600 × 1000 px. Tocá la imagen para elegir el punto focal.",
    remove: "Quitar portada",
  },
  logo: {
    label: "Logo del local",
    hint: "JPG, PNG o WebP, máximo 2 MB. Recomendado cuadrado, 512 × 512 px.",
    remove: "Quitar logo",
  },
};

/** Admin screen: cover, logo, name and location of the venue, with a live preview of the list card. */
export function VenueProfile({ venue }: { venue: Venue }) {
  const router = useRouter();
  const [saved, setSaved] = useState({
    cover: venue.cover_url,
    logo: venue.logo_url,
    focusX: venue.cover_focus_x ?? 50,
    focusY: venue.cover_focus_y ?? 50,
  });
  const [focus, setFocus] = useState({
    x: venue.cover_focus_x ?? 50,
    y: venue.cover_focus_y ?? 50,
  });
  const [kindError, setKindError] = useState<Record<BrandingKind, string>>({
    cover: "",
    logo: "",
  });
  const inputs = { cover: useRef<HTMLInputElement>(null), logo: useRef<HTMLInputElement>(null) };
  const [draft, setDraft] = useState({
    latitude: venue.latitude?.toString() ?? "",
    longitude: venue.longitude?.toString() ?? "",
    name: venue.name,
    zone: venue.zone,
    cover: venue.cover_url,
    logo: venue.logo_url,
  });
  // Objects uploaded in this session but not saved yet, so they can be cleaned up if replaced or discarded.
  const [pending, setPending] = useState<Record<BrandingKind, string | null>>({
    cover: null,
    logo: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const storage = () => browserDb().storage.from(VENUE_IMAGE_BUCKET);

  const upload = async (kind: BrandingKind, file: File) => {
    setError("");
    setNotice("");
    setKindError((current) => ({ ...current, [kind]: "" }));
    const check = await checkVenueImage(file);
    if (!check.ok) {
      setKindError((current) => ({ ...current, [kind]: check.message }));
      return;
    }
    setBusy(true);
    try {
      const path = venueImagePath(
        venue.id,
        kind,
        check.extension,
        crypto.randomUUID(),
      );
      const { error: uploadError } = await storage().upload(path, file, {
        contentType: check.type,
        cacheControl: "31536000",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const previous = pending[kind];
      if (previous) await storage().remove([previous]);
      setPending((current) => ({ ...current, [kind]: path }));
      setDraft((current) => ({
        ...current,
        [kind]: storage().getPublicUrl(path).data.publicUrl,
      }));
      setNotice("Imagen lista. Guardá el perfil para publicarla.");
    } catch {
      setKindError((current) => ({
        ...current,
        [kind]:
          "No se pudo subir la imagen. Revisá tu conexión y que tu cuenta sea administradora de este local.",
      }));
    } finally {
      setBusy(false);
    }
  };

  const clear = async (kind: BrandingKind) => {
    setError("");
    setNotice("");
    const previous = pending[kind];
    if (previous) {
      await storage().remove([previous]);
      setPending((current) => ({ ...current, [kind]: null }));
    }
    setDraft((current) => ({ ...current, [kind]: null }));
    setNotice("Imagen quitada. Guardá el perfil para aplicar el cambio.");
  };

  const save = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const latitude =
        draft.latitude.trim() === "" ? null : Number(draft.latitude);
      const longitude =
        draft.longitude.trim() === "" ? null : Number(draft.longitude);
      if (
        (latitude === null) !== (longitude === null) ||
        (latitude !== null &&
          (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) ||
        (longitude !== null &&
          (!Number.isFinite(longitude) || Math.abs(longitude) > 180))
      )
        throw new Error(
          "Ingresá ambas coordenadas válidas o dejá ambas vacías.",
        );
      await sendCommand({
        action: "venue_branding",
        venueId: venue.id,
        name: draft.name.trim(),
        zone: draft.zone.trim(),
        coverUrl: draft.cover,
        logoUrl: draft.logo,
        latitude,
        longitude,
      });
      if (focus.x !== saved.focusX || focus.y !== saved.focusY) {
        const { error: focusError } = await browserDb().rpc(
          "update_venue_cover_focus",
          { venue: venue.id, x: focus.x, y: focus.y },
        );
        if (focusError) throw new Error("No se guardó el punto focal de la portada.");
      }
      // Best effort: remove files that are no longer referenced. The database already holds the new values.
      const stale = (["cover", "logo"] as const)
        .filter((kind) => saved[kind] && saved[kind] !== draft[kind])
        .map((kind) => venueImagePathFromUrl(saved[kind], venue.id))
        .filter((path): path is string => !!path);
      if (stale.length)
        await storage()
          .remove(stale)
          .catch(() => undefined);
      setSaved({ cover: draft.cover, logo: draft.logo, focusX: focus.x, focusY: focus.y });
      setPending({ cover: null, logo: null });
      setNotice("Perfil guardado. Ya se ve así en la lista de locales.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se guardó el perfil.");
    } finally {
      setBusy(false);
    }
  };

  const dirty =
    draft.cover !== saved.cover ||
    draft.logo !== saved.logo ||
    focus.x !== saved.focusX ||
    focus.y !== saved.focusY ||
    draft.name !== venue.name ||
    draft.zone !== venue.zone;
  const previewVenue = {
    slug: venue.slug,
    name: draft.name.trim() || "Nombre del local",
    zone: draft.zone,
    cover_url: draft.cover,
    logo_url: draft.logo,
    cover_focus_x: focus.x,
    cover_focus_y: focus.y,
  };
  /** Control de una imagen: miniatura, subir/reemplazar con botón propio (el selector del sistema conserva su UI), quitar y error al lado. */
  const picker = (kind: BrandingKind) => (
    <div className="image-control" key={kind}>
      <div className="image-control-head">
        <strong>{copy[kind].label}</strong>
        <p className="hint">{copy[kind].hint}</p>
      </div>
      <div
        className={`image-control-preview ${kind}`}
        data-empty={draft[kind] ? undefined : "true"}
        onClick={(event) => {
          if (kind !== "cover" || !draft.cover) return;
          const box = event.currentTarget.getBoundingClientRect();
          setFocus({
            x: Math.round(((event.clientX - box.left) / box.width) * 100),
            y: Math.round(((event.clientY - box.top) / box.height) * 100),
          });
        }}
      >
        {draft[kind] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={draft[kind] ?? ""}
            alt=""
            style={kind === "cover" ? { objectPosition: coverPosition({ cover_focus_x: focus.x, cover_focus_y: focus.y }) } : undefined}
          />
        ) : (
          <span className="muted t-label">Sin {kind === "cover" ? "portada" : "logo"}</span>
        )}
        {kind === "cover" && draft.cover && (
          <span className="focus-dot" style={{ left: `${focus.x}%`, top: `${focus.y}%` }} aria-hidden="true" />
        )}
      </div>
      {kind === "cover" && draft.cover && (
        <div className="row wrap" role="group" aria-label="Punto focal de la portada">
          {(
            [
              ["Izquierda", { x: 20, y: focus.y }],
              ["Centro", { x: 50, y: 50 }],
              ["Derecha", { x: 80, y: focus.y }],
              ["Arriba", { x: focus.x, y: 25 }],
              ["Abajo", { x: focus.x, y: 75 }],
            ] as const
          ).map(([label, value]) => (
            <Button key={label} type="button" variant="quiet" size="sm" onClick={() => setFocus({ ...value })}>
              {label}
            </Button>
          ))}
        </div>
      )}
      <input
        ref={inputs[kind]}
        type="file"
        accept={VENUE_IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(kind, file);
        }}
      />
      <div className="row wrap">
        <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => inputs[kind].current?.click()}>
          <ImagePlus size={16} aria-hidden="true" />
          {draft[kind] ? "Reemplazar" : "Subir"}
        </Button>
        {draft[kind] && (
          <Button type="button" variant="quiet" size="sm" disabled={busy} onClick={() => void clear(kind)}>
            <Trash2 size={16} aria-hidden="true" />
            {copy[kind].remove}
          </Button>
        )}
      </div>
      {kindError[kind] && (
        <p role="alert" className="field-error">
          {kindError[kind]}
        </p>
      )}
    </div>
  );
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="row between wrap">
        <h2>Perfil del local</h2>
        <StatusBadge tone={dirty ? "warning" : "success"}>
          {dirty ? "Sin guardar" : "Guardado"}
        </StatusBadge>
      </div>
      <p className="muted">Así se ven la tarjeta de Explorar y la cabecera del local.</p>
      <div className="profile-previews">
        <div className="profile-preview" aria-label="Vista previa de la tarjeta de Explorar">
          <p className="eyebrow">Tarjeta · 16:10</p>
          <VenueCard preview venue={previewVenue} />
        </div>
        <div className="profile-preview" aria-label="Vista previa de la cabecera del local">
          <p className="eyebrow">Cabecera móvil · 3:2</p>
          <div className="header-preview">
            {draft.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.cover} alt="" style={{ objectPosition: coverPosition(previewVenue) }} />
            ) : (
              <span className="vcard-fallback" aria-hidden="true" />
            )}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <VenueMark venue={previewVenue} large />
            <strong>{previewVenue.name}</strong>
          </div>
        </div>
      </div>
      <TextField
        name="name"
        label="Nombre del local"
        required
        maxLength={100}
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />
      <TextField
        name="zone"
        label="Ubicación (opcional)"
        maxLength={100}
        placeholder="Barrio, ciudad o zona"
        value={draft.zone}
        onChange={(e) => setDraft({ ...draft, zone: e.target.value })}
      />
      {picker("cover")}
      {picker("logo")}
      <h3>Coordenadas del local (opcional)</h3>
      <p className="muted">
        Usá la ubicación real del local para aparecer por cercanía. Si no la
        tenés, dejá ambos campos vacíos; la búsqueda por nombre sigue
        disponible.
      </p>
      <div className="row">
        <TextField
          label="Latitud"
          type="number"
          step="any"
          min={-90}
          max={90}
          value={draft.latitude}
          onChange={(e) => setDraft({ ...draft, latitude: e.target.value })}
        />
        <TextField
          label="Longitud"
          type="number"
          step="any"
          min={-180}
          max={180}
          value={draft.longitude}
          onChange={(e) => setDraft({ ...draft, longitude: e.target.value })}
        />
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="muted">
          {notice}
        </p>
      )}
      <Button type="submit" loading={busy} disabled={!draft.name.trim()}>
        Guardar perfil
      </Button>
    </form>
  );
}
