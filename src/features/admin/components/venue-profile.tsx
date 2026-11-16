"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@/components/ui/primitives";
import { VenueCard } from "@/features/catalog/components/venue-card";
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

const copy: Record<
  VenueImageKind,
  { label: string; hint: string; remove: string }
> = {
  cover: {
    label: "Foto de portada",
    hint: "JPG, PNG o WebP, máximo 2 MB. Recomendado 1600 × 1000 px, horizontal.",
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
  });
  const [draft, setDraft] = useState({
    name: venue.name,
    zone: venue.zone,
    cover: venue.cover_url,
    logo: venue.logo_url,
  });
  // Objects uploaded in this session but not saved yet, so they can be cleaned up if replaced or discarded.
  const [pending, setPending] = useState<Record<VenueImageKind, string | null>>(
    { cover: null, logo: null },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const storage = () => browserDb().storage.from(VENUE_IMAGE_BUCKET);

  const upload = async (kind: VenueImageKind, file: File) => {
    setError("");
    setNotice("");
    const check = await checkVenueImage(file);
    if (!check.ok) {
      setError(check.message);
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
      setError(
        "No se pudo subir la imagen. Revisá tu conexión y que tu cuenta sea administradora de este local.",
      );
    } finally {
      setBusy(false);
    }
  };

  const clear = async (kind: VenueImageKind) => {
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
      await sendCommand({
        action: "venue_branding",
        venueId: venue.id,
        name: draft.name.trim(),
        zone: draft.zone.trim(),
        coverUrl: draft.cover,
        logoUrl: draft.logo,
      });
      // Best effort: remove files that are no longer referenced. The database already holds the new values.
      const stale = (["cover", "logo"] as const)
        .filter((kind) => saved[kind] && saved[kind] !== draft[kind])
        .map((kind) => venueImagePathFromUrl(saved[kind], venue.id))
        .filter((path): path is string => !!path);
      if (stale.length)
        await storage()
          .remove(stale)
          .catch(() => undefined);
      setSaved({ cover: draft.cover, logo: draft.logo });
      setPending({ cover: null, logo: null });
      setNotice("Perfil guardado. Ya se ve así en la lista de locales.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se guardó el perfil.");
    } finally {
      setBusy(false);
    }
  };

  const picker = (kind: VenueImageKind) => (
    <div className="stack" key={kind}>
      <label className="field">
        <span>{copy[kind].label}</span>
        <input
          type="file"
          accept={VENUE_IMAGE_ACCEPT}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(kind, file);
          }}
        />
      </label>
      <p className="muted">{copy[kind].hint}</p>
      {draft[kind] && (
        <Button
          type="button"
          variant="quiet"
          disabled={busy}
          onClick={() => void clear(kind)}
        >
          {copy[kind].remove}
        </Button>
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
      <h2>Perfil del local</h2>
      <p className="muted">Así se verá tu tarjeta en la lista de locales.</p>
      <div className="profile-preview" aria-label="Vista previa de la tarjeta">
        <VenueCard
          preview
          venue={{
            slug: venue.slug,
            name: draft.name.trim() || "Nombre del local",
            zone: draft.zone,
            cover_url: draft.cover,
            logo_url: draft.logo,
          }}
        />
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
