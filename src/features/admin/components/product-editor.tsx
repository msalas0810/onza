"use client";
import { useState } from "react";
import { Button, TextField } from "@/components/ui/primitives";
import { sendCommand } from "@/features/orders/client-api";
import type { Product } from "@/features/catalog/server/queries";
import { ProductImage } from "@/features/catalog/components/product-image";
import { productImageSrc } from "@/features/catalog/product-image-src";
import { removeVenueImages, uploadVenueImage } from "../upload-venue-image";
import { VENUE_IMAGE_ACCEPT, venueImagePathFromUrl } from "../venue-image";
export function ProductEditor({
  venueId,
  product,
  categories,
  onSaved,
}: {
  venueId: string;
  product: Product | null;
  categories: { id: string; label: string }[];
  onSaved: (warning?: string) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Image draft. `image` is the URL to publish (null = no image); `pending` is a file uploaded here but not saved yet.
  const savedImage = product?.image_url ?? null;
  const [image, setImage] = useState<string | null>(savedImage);
  const [pending, setPending] = useState<string | null>(null);
  const shownImage =
    image ??
    (savedImage === null && !pending
      ? productImageSrc(product ?? { image_url: null, photo_path: null })
      : null);
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
          const saved = await sendCommand({
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
          });
          // The image is applied as a second step because a new product has no id until it is saved.
          let warning: string | undefined;
          if (image !== savedImage) {
            const productId =
              product?.id ??
              (typeof saved === "object" && saved && "id" in saved
                ? String(saved.id)
                : null);
            try {
              if (!productId) throw new Error("sin id");
              await sendCommand({
                action: "product_image",
                productId,
                imageUrl: image,
              });
              await removeVenueImages(
                [venueImagePathFromUrl(savedImage, venueId)].filter(
                  (path): path is string => !!path,
                ),
              );
            } catch (imageError) {
              warning = `El trago se guardó, pero su imagen no se pudo aplicar${
                imageError instanceof Error && imageError.message !== "sin id"
                  ? `: ${imageError.message}`
                  : ""
              }. Abrí Editar para reintentar.`;
            }
          }
          onSaved(warning);
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
      <div className="stack">
        <div className="row wrap">
          <ProductImage
            name={String(product?.name ?? "Nuevo trago")}
            src={shownImage}
          />
          <div className="stack">
            <label className="field">
              <span>Imagen del trago</span>
              <input
                type="file"
                accept={VENUE_IMAGE_ACCEPT}
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setError("");
                  setBusy(true);
                  const result = await uploadVenueImage(
                    venueId,
                    "product",
                    file,
                  );
                  setBusy(false);
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  if (pending) await removeVenueImages([pending]);
                  setPending(result.path);
                  setImage(result.url);
                }}
              />
            </label>
            <p className="muted">
              JPG, PNG o WebP, máximo 2 MB. Recomendado vertical 4:5, por
              ejemplo 800 × 1000 px, con fondo claro.
            </p>
            {(image || shownImage) && (
              <Button
                type="button"
                variant="quiet"
                disabled={busy}
                onClick={async () => {
                  if (pending) await removeVenueImages([pending]);
                  setPending(null);
                  setImage(null);
                }}
              >
                Quitar imagen
              </Button>
            )}
          </div>
        </div>
        <p className="muted" role="status">
          {pending
            ? "Imagen lista. Guardá el trago para publicarla."
            : image !== savedImage
              ? "Imagen quitada. Guardá el trago para aplicar el cambio."
              : image
                ? "Esta es la imagen publicada."
                : "Sin imagen: se muestra un marcador de posición."}
        </p>
      </div>
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
