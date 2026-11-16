"use client";
import { useState } from "react";
import { Button, TextField } from "@/components/ui/primitives";
import { sendCommand } from "@/features/orders/client-api";
import { browserDb } from "@/lib/supabase/browser";
import type { Product } from "@/features/catalog/server/queries";
export function ProductEditor({
  venueId,
  product,
  categories,
  onSaved,
}: {
  venueId: string;
  product: Product | null;
  categories: { id: string; label: string }[];
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoPath, setPhotoPath] = useState<string | null>(
    product?.photo_path ?? null,
  );
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setBusy(true);
        setError("");
        try {
          const price = String(data.get("price"));
          if (!/^\d+(\.\d{1,2})?$/.test(price))
            throw new Error("Usá un precio positivo con hasta dos decimales.");
          const [whole, fraction = ""] = price.split(".");
          const priceMinor =
            Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
          await sendCommand({
            action: "product_save",
            venueId,
            productId: product?.id,
            expectedVersion: product?.version,
            name: String(data.get("name")),
            description: String(data.get("description")),
            categoryId: String(data.get("category")),
            priceMinor,
            size: String(data.get("size")),
            allergens: String(data.get("allergens")),
            available: data.get("available") === "on",
            photoPath,
          });
          onSaved();
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "No se guardó el producto.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <TextField
        name="name"
        label="Nombre"
        required
        maxLength={100}
        defaultValue={product?.name}
      />
      <label className="field">
        Descripción
        <textarea
          name="description"
          maxLength={500}
          defaultValue={product?.description}
        />
      </label>
      <label className="field">
        Categoría
        <select
          name="category"
          defaultValue={product?.category_id ?? categories[0]?.id}
          required
        >
          {categories.map((c) => (
            <option value={c.id} key={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <TextField
        name="price"
        label="Precio final en colones"
        inputMode="decimal"
        required
        defaultValue={product ? String(product.price_minor / 100) : ""}
      />
      <TextField
        name="size"
        label="Tamaño"
        maxLength={100}
        defaultValue={product?.size}
      />
      <TextField
        name="allergens"
        label="Alérgenos informados"
        maxLength={200}
        defaultValue={product?.allergens ?? "No informado por el local"}
      />
      <label className="checkbox">
        <input
          type="checkbox"
          name="available"
          defaultChecked={product?.available ?? true}
        />
        <span>Disponible para pedir</span>
      </label>
      <label className="field">
        Foto propia o con licencia (máximo 5 MB)
        <input
          type="file"
          accept="image/webp,image/avif,image/jpeg,image/png"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              if (file.size > 5 * 1024 * 1024)
                throw new Error("La imagen supera los 5 MB.");
              const extension = (
                {
                  "image/webp": "webp",
                  "image/avif": "avif",
                  "image/jpeg": "jpg",
                  "image/png": "png",
                } as Record<string, string>
              )[file.type];
              if (!extension) throw new Error("Formato no permitido.");
              const path = `${venueId}/${crypto.randomUUID()}.${extension}`;
              const { error } = await browserDb()
                .storage.from("menu-photos")
                .upload(path, file, { contentType: file.type, upsert: false });
              if (error) throw error;
              setPhotoPath(path);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "No se pudo subir la imagen.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <p className="muted">
        {photoPath
          ? "Foto cargada. Guardá el producto para publicarla."
          : "Sin foto: se mostrará el fallback."}
      </p>
      {photoPath && (
        <Button
          type="button"
          variant="quiet"
          onClick={() => setPhotoPath(null)}
        >
          Quitar foto del producto
        </Button>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <Button type="submit" loading={busy}>
        Guardar producto
      </Button>
    </form>
  );
}
