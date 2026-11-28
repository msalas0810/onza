"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice, TextField } from "@/components/ui/primitives";
import { browserDb } from "@/lib/supabase/browser";
import { gameApi } from "../client-api";
import styles from "./game.module.css";

type VenueOption = { id: string; name: string; products: { id: string; name: string }[] };
const IMAGE = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
const VIDEO = { "video/mp4": "mp4", "video/webm": "webm" } as const;
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

/** Publica una Drink Story: sube la foto o el video al bucket privado y registra la historia (la base valida todo). */
export function StoryComposer({ userId, venues }: { userId: string; venues: VenueOption[] }) {
  const router = useRouter();
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const [productId, setProductId] = useState("");
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"friends" | "public">("friends");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const venue = venues.find((v) => v.id === venueId);

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!file) return setError("Elegí una foto o un video.");
    const ext = (IMAGE as Record<string, string>)[file.type] ?? (VIDEO as Record<string, string>)[file.type];
    if (!ext) return setError("Usá una foto JPG, PNG o WebP, o un video MP4 o WebM.");
    const isVideo = file.type.startsWith("video/");
    if (file.size > (isVideo ? MAX_VIDEO : MAX_IMAGE))
      return setError(isVideo ? "El video supera los 50 MB." : "La foto supera los 10 MB.");
    setBusy(true);
    const path = `${userId}/story-${crypto.randomUUID()}.${ext}`;
    const uploaded = await browserDb().storage.from("stories").upload(path, file, { contentType: file.type, upsert: false });
    if (uploaded.error) {
      setBusy(false);
      return setError("No pudimos subir el archivo. Intentá de nuevo.");
    }
    const created = await gameApi({
      action: "story_create",
      venueId,
      productId: productId || null,
      mediaPath: path,
      mediaType: isVideo ? "video" : "image",
      caption,
      visibility,
    });
    if (!created.ok) {
      await browserDb().storage.from("stories").remove([path]);
      setBusy(false);
      return setError(created.message);
    }
    setBusy(false);
    setFile(null);
    setCaption("");
    setProductId("");
    router.refresh();
  }

  return (
    <form className="stack tight" onSubmit={publish} noValidate>
      <h2>Compartir un trago</h2>
      <label className="field">
        <span>Bar</span>
        <select value={venueId} onChange={(e) => { setVenueId(e.target.value); setProductId(""); }}>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Producto del menú (opcional)</span>
        <select value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Sin producto</option>
          {venue?.products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Foto o video</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <TextField label="Descripción" maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} />
      <label className="field">
        <span>Quién la ve</span>
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as "friends" | "public")}>
          <option value="friends">Mis amistades</option>
          <option value="public">Todos los que visiten el bar</option>
        </select>
      </label>
      <p className={styles.muted}>Las historias duran 24 horas. Solo para mayores de 18 años. No subas fotos de otras personas sin su permiso.</p>
      {error && (
        <div aria-live="polite">
          <Notice tone="danger" title="No se pudo publicar">{error}</Notice>
        </div>
      )}
      <Button type="submit" loading={busy} disabled={!venueId}>Publicar</Button>
    </form>
  );
}
