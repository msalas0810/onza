import type { PGlite } from "@electric-sql/pglite";
import { describe, it, expect } from "vitest";
import { database, actor, ids, installStorageStub } from "./helpers";

const adminPatio = "10000000-0000-4000-8000-000000000005";
const patioProduct = "30000000-0000-4000-8000-000000000007";
const base = "https://demo.supabase.co/storage/v1/object/public/venue-images";
const image = (venue: string, file = "product-1.jpg") =>
  `${base}/${venue}/${file}`;

async function setImage(db: PGlite, input: Record<string, unknown>) {
  const result = await db.query<{ result: Record<string, unknown> }>(
    "select public.update_product_image($1::jsonb) as result",
    [JSON.stringify(input)],
  );
  return result.rows[0].result;
}
async function productRow(db: PGlite, id: string) {
  await db.exec("reset role");
  const { rows } = await db.query<{
    image_url: string | null;
    version: number;
    name: string;
    price_minor: number;
  }>(
    "select image_url,version,name,price_minor from public.products where id=$1",
    [id],
  );
  return rows[0];
}
async function withTwoVenues() {
  const db = await database();
  await db.exec(
    `insert into auth.users values('${adminPatio}');insert into public.memberships(user_id,venue_id,role) values('${adminPatio}','${ids.patio}','admin')`,
  );
  return db;
}

describe("imagen de trago (columna y función)", () => {
  it("el admin del local cambia la imagen de su trago, no sube la versión y el público la lee", async () => {
    const db = await withTwoVenues();
    try {
      const before = await productRow(db, ids.product);
      expect(before.image_url).toBeNull();
      await actor(db, ids.admin, "admin-device", false);
      const result = await setImage(db, {
        productId: ids.product,
        imageUrl: image(ids.venue),
      });
      expect(result).toMatchObject({
        id: ids.product,
        image_url: image(ids.venue),
      });
      const after = await productRow(db, ids.product);
      // El carrito guarda la versión del producto: una imagen no debe invalidarlo.
      expect(after).toMatchObject({
        version: before.version,
        name: before.name,
        price_minor: before.price_minor,
      });
      await db.exec(
        "select set_config('request.jwt.claims','',false);set role anon",
      );
      const { rows } = await db.query<{ image_url: string }>(
        `select image_url from public.products where id='${ids.product}'`,
      );
      expect(rows[0].image_url).toBe(image(ids.venue));
    } finally {
      await db.close();
    }
  });

  it("null borra la imagen", async () => {
    const db = await withTwoVenues();
    try {
      await actor(db, ids.admin, "admin-device", false);
      await setImage(db, {
        productId: ids.product,
        imageUrl: image(ids.venue),
      });
      await setImage(db, { productId: ids.product, imageUrl: null });
      expect((await productRow(db, ids.product)).image_url).toBeNull();
    } finally {
      await db.close();
    }
  });

  it("un admin no cambia tragos de otro local, en ambos sentidos, ni usando su propia carpeta", async () => {
    const db = await withTwoVenues();
    try {
      await actor(db, ids.admin, "admin-device", false);
      await expect(
        setImage(db, { productId: patioProduct, imageUrl: image(ids.patio) }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      await expect(
        setImage(db, { productId: patioProduct, imageUrl: image(ids.venue) }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      await expect(
        setImage(db, { productId: patioProduct, imageUrl: null }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      await actor(db, adminPatio, "patio-device", false);
      await expect(
        setImage(db, { productId: ids.product, imageUrl: image(ids.venue) }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      await expect(
        setImage(db, { productId: ids.product, imageUrl: image(ids.patio) }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      expect((await productRow(db, ids.product)).image_url).toBeNull();
      expect((await productRow(db, patioProduct)).image_url).toBeNull();
    } finally {
      await db.close();
    }
  });

  it("un producto que no existe responde igual que uno ajeno (no revela nada)", async () => {
    const db = await withTwoVenues();
    try {
      await actor(db, ids.admin, "admin-device", false);
      await expect(
        setImage(db, {
          productId: "30000000-0000-4000-8000-0000000000ff",
          imageUrl: image(ids.venue),
        }),
      ).rejects.toThrow("NOT_AUTHORIZED");
    } finally {
      await db.close();
    }
  });

  it("bartender, invitado y anon no pueden; la tabla no admite escritura directa", async () => {
    const db = await withTwoVenues();
    try {
      await actor(db, ids.staff, "bar-device", false);
      await expect(
        setImage(db, { productId: ids.product, imageUrl: image(ids.venue) }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      await actor(db, ids.customer, "guest-device", true);
      await expect(
        setImage(db, { productId: ids.product, imageUrl: image(ids.venue) }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      await db.exec("reset role");
      await db.exec(
        "select set_config('request.jwt.claims','',false);set role anon",
      );
      await expect(
        setImage(db, { productId: ids.product, imageUrl: image(ids.venue) }),
      ).rejects.toThrow();
      await actor(db, ids.admin, "admin-device", false);
      await expect(
        db.query(
          `update public.products set image_url='https://evil.example/x.png' where id='${ids.product}'`,
        ),
      ).rejects.toThrow(/permission denied/);
      expect((await productRow(db, ids.product)).image_url).toBeNull();
    } finally {
      await db.close();
    }
  });

  it("rechaza URLs externas, de otra carpeta, anidadas, sin prefijo product-, svg/gif y entradas mal formadas", async () => {
    const db = await withTwoVenues();
    try {
      await actor(db, ids.admin, "admin-device", false);
      const invalid: Record<string, unknown>[] = [
        { imageUrl: "https://evil.example/product-1.png" },
        { imageUrl: image(ids.patio) },
        { imageUrl: `${base}/${ids.venue}/nested/product-1.jpg` },
        { imageUrl: image(ids.venue, "cover-1.jpg") },
        { imageUrl: image(ids.venue, "logo-1.png") },
        { imageUrl: image(ids.venue, "product-1.svg") },
        { imageUrl: image(ids.venue, "product-1.gif") },
        { imageUrl: "javascript:alert(1)" },
        { imageUrl: `${base}/${ids.venue}/..%2F${ids.patio}%2Fproduct-1.png` },
        { imageUrl: 123 },
        { imageUrl: "" },
      ];
      for (const patch of invalid)
        await expect(
          setImage(db, { productId: ids.product, ...patch }),
          JSON.stringify(patch),
        ).rejects.toThrow("INVALID_PRODUCT_IMAGE");
      await expect(setImage(db, { productId: ids.product })).rejects.toThrow(
        "INVALID_PRODUCT_IMAGE",
      );
      await expect(
        setImage(db, { productId: "no-es-uuid", imageUrl: null }),
      ).rejects.toThrow("INVALID_PRODUCT_IMAGE");
      expect((await productRow(db, ids.product)).image_url).toBeNull();
    } finally {
      await db.close();
    }
  });
});

describe("el bucket venue-images cubre los archivos de tragos", () => {
  const insertObject = (db: PGlite, name: string) =>
    db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
      "venue-images",
      name,
    ]);
  it("el admin sube product-*.ext solo en la carpeta de su local; otro local, bartender y anon no", async () => {
    const db = await withTwoVenues();
    try {
      await installStorageStub(db);
      await actor(db, ids.admin, "admin-device", false);
      for (const ext of ["jpg", "png", "webp"])
        await insertObject(db, `${ids.venue}/product-${ext}.${ext}`);
      await expect(
        insertObject(db, `${ids.patio}/product-x.jpg`),
      ).rejects.toThrow(/row-level security/);
      await expect(
        insertObject(db, `${ids.venue}/product-x.svg`),
      ).rejects.toThrow(/row-level security/);
      await expect(
        insertObject(db, `${ids.venue}/otra/product-x.jpg`),
      ).rejects.toThrow(/row-level security/);
      await actor(db, adminPatio, "patio-device", false);
      await expect(
        insertObject(db, `${ids.venue}/product-y.jpg`),
      ).rejects.toThrow(/row-level security/);
      await insertObject(db, `${ids.patio}/product-y.jpg`);
      await actor(db, ids.staff, "bar-device", false);
      await expect(
        insertObject(db, `${ids.venue}/product-z.jpg`),
      ).rejects.toThrow(/row-level security/);
      await db.exec("reset role");
      await db.exec(
        "select set_config('request.jwt.claims','',false);set role anon",
      );
      await expect(
        insertObject(db, `${ids.venue}/product-z.jpg`),
      ).rejects.toThrow(/permission denied|row-level security/);
    } finally {
      await db.close();
    }
  });
});
