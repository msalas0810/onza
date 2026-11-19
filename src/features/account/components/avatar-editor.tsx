"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { browserDb } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import {
  checkVenueImage,
  VENUE_IMAGE_ACCEPT,
} from "@/features/admin/venue-image";

const BUCKET = "avatars";
const MAX_BYTES = 1024 * 1024;
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("es-CR"))
    .join("") || "O";

/** Foto privada desde el bucket `avatars` (solo la persona la lee). Sin foto o si falla, iniciales. */
function useAvatar(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let revoked = false;
    let objectUrl: string | null = null;
    void browserDb()
      .storage.from(BUCKET)
      .download(path)
      .then(({ data }) => {
        if (!data || revoked) return;
        objectUrl = URL.createObjectURL(data);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return path ? url : null;
}

export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src: string | null;
  size?: "md" | "lg";
}) {
  return (
    <span className={`avatar ${size}`} aria-hidden="true">
      {src ? (
        // Foto privada descargada como blob: next/image no aplica a URLs de objeto locales.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </span>
  );
}

export function AvatarEditor({
  name,
  path,
}: {
  name: string;
  path: string | null;
}) {
  const router = useRouter();
  const current = useAvatar(path);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => void (preview && URL.revokeObjectURL(preview)),
    [preview],
  );

  const pick = async (chosen: File | undefined) => {
    setError("");
    if (!chosen) return;
    const check = await checkVenueImage(chosen);
    if (!check.ok) return setError(check.message);
    if (chosen.size > MAX_BYTES)
      return setError("La foto pesa más de 1 MB. Reducila e intentá otra vez.");
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
  };
  const finish = () => {
    setOpen(false);
    setFile(null);
    setPreview(null);
    router.refresh();
  };
  const save = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const check = await checkVenueImage(file);
      if (!check.ok) throw new Error(check.message);
      const db = browserDb();
      const { data } = await db.auth.getUser();
      if (!data.user) throw new Error("Tu sesión venció. Volvé a entrar.");
      const next = `${data.user.id}/avatar-${crypto.randomUUID()}.${check.extension}`;
      const storage = db.storage.from(BUCKET);
      const upload = await storage.upload(next, file, {
        contentType: check.type,
        upsert: false,
      });
      if (upload.error)
        throw new Error(
          "No pudimos subir la foto. Revisá tu conexión e intentá otra vez.",
        );
      const { data: result, error: rpcError } = await db.rpc(
        "update_profile_avatar",
        { path: next },
      );
      if (rpcError) {
        await storage.remove([next]);
        throw new Error("No pudimos guardar la foto.");
      }
      const previous = (result as { previousPath?: string | null } | null)
        ?.previousPath;
      if (previous) await storage.remove([previous]).catch(() => undefined);
      finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar la foto.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      const db = browserDb();
      const { data, error: rpcError } = await db.rpc("update_profile_avatar", {
        path: null,
      });
      if (rpcError) throw new Error("No pudimos quitar la foto.");
      const previous = (data as { previousPath?: string | null } | null)
        ?.previousPath;
      if (previous)
        await db.storage
          .from(BUCKET)
          .remove([previous])
          .catch(() => undefined);
      finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos quitar la foto.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        className="avatar-button"
        onClick={() => setOpen(true)}
        aria-label="Editar foto de perfil"
      >
        <Avatar name={name} src={current} size="lg" />
        <span className="avatar-edit" aria-hidden="true">
          <Camera size={14} />
        </span>
      </button>
      <Sheet
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            setFile(null);
            setPreview(null);
            setError("");
          }
        }}
        title="Foto de perfil"
        description="Solo vos la ves. JPG, PNG o WebP de hasta 1 MB."
        actions={
          <>
            {path && !file && (
              <Button
                variant="danger"
                loading={busy}
                onClick={() => void remove()}
              >
                Quitar foto
              </Button>
            )}
            <Button
              disabled={!file}
              loading={busy && !!file}
              onClick={() => void save()}
            >
              Guardar
            </Button>
          </>
        }
      >
        <div className="avatar-preview">
          <Avatar name={name} src={preview ?? current} size="lg" />
          <input
            ref={input}
            type="file"
            accept={VENUE_IMAGE_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <Button variant="secondary" onClick={() => input.current?.click()}>
            <Camera size={18} aria-hidden="true" />
            {current || preview ? "Elegir otra foto" : "Elegir foto"}
          </Button>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </Sheet>
    </>
  );
}
