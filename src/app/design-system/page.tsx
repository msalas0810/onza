import { notFound } from "next/navigation";
import {
  Button,
  IconButton,
  TextField,
  Price,
  StatusBadge,
  PhotoFallback,
  ErrorState,
} from "@/components/ui/primitives";
import { Plus } from "lucide-react";
import { VenueCard } from "@/features/catalog/components/venue-card";
import { EnjoyMoment } from "@/features/orders/components/enjoy";
import { VenueProfile } from "@/features/admin/components/venue-profile";
import { ProductMenu } from "@/features/catalog/components/product-menu";
import { ProductEditorSample } from "./product-editor-sample";
import { ControlsSample } from "./controls-sample";
import type { Product, Venue } from "@/features/catalog/server/queries";
import type { VenueCardData } from "@/features/catalog/components/venue-card";

// Sample row so the admin profile form can be reviewed here. It does not save anything: no session, no Supabase.
const sampleVenue: Venue = {
  id: "20000000-0000-4000-8000-000000000001",
  slug: "sala-norte",
  name: "Sala Norte",
  zone: "San José",
  timezone: "America/Costa_Rica",
  currency: "CRC",
  open_state: "open",
  paused: false,
  pickup_label: "Barra principal",
  support_contact: "",
  hours: "Consultar al local",
  eta_minutes: 15,
  capacity: 30,
  max_units: 20,
  latitude: null,
  longitude: null,
  cover_url: "/demo-venues/sala-norte-cover.jpg",
  logo_url: "/demo-venues/sala-norte-logo.png",
  demo_listed: true,
};

// Sample drinks for reviewing the menu rows and the drink editor. Nothing here is saved.
const sampleCategory = "ad46cb30-426b-52bb-8358-ac044919d89a";
const sampleProduct = (id: string, patch: Partial<Product>): Product => ({
  id,
  venue_id: sampleVenue.id,
  category_id: sampleCategory,
  name: "Trago",
  description: "",
  price_minor: 450000,
  photo_path: null,
  image_url: null,
  size: "",
  allergens: "No informado por el local",
  available: true,
  archived: false,
  version: 1,
  ...patch,
});
const sampleProducts: Product[] = [
  sampleProduct("30000000-0000-4000-8000-000000000001", {
    name: "Paloma",
    description: "Tequila, toronja y soda.",
    image_url: "/demo-products/highball.png",
  }),
  sampleProduct("30000000-0000-4000-8000-000000000002", {
    name: "Negroni",
    description: "Gin, vermut rosso y bitter.",
    price_minor: 550000,
    image_url: "/demo-products/cocktail.png",
  }),
  sampleProduct("30000000-0000-4000-8000-000000000020", {
    name: "Sin imagen",
    description:
      "Este trago aún no tiene imagen: se muestra el marcador de posición.",
  }),
  sampleProduct("30000000-0000-4000-8000-000000000021", {
    name: "Imagen que no carga",
    description:
      "La URL falla y cae al marcador de posición sin dejar una caja rota.",
    image_url: "/demo-products/no-existe.png",
  }),
  sampleProduct("30000000-0000-4000-8000-000000000022", {
    name: "Cóctel de la casa con un nombre muy largo que ocupa varias líneas",
    description:
      "Una descripción larga para comprobar que el texto se ajusta a su columna sin empujar ni deformar la imagen del trago.",
    price_minor: 1250000,
    image_url: "/demo-products/wine.png",
  }),
  sampleProduct("30000000-0000-4000-8000-000000000023", {
    name: "Shot",
    description: "Trago corto.",
    image_url: "/demo-products/shot.png",
  }),
  sampleProduct("30000000-0000-4000-8000-000000000024", {
    name: "Cerveza",
    description: "Botella individual.",
    price_minor: 250000,
    image_url: "/demo-products/beer.png",
  }),
  sampleProduct("30000000-0000-4000-8000-000000000025", {
    name: "Soda cítrica",
    description: "Bebida sin alcohol.",
    price_minor: 200000,
    image_url: "/demo-products/soft.png",
  }),
];

// Static samples for reviewing the venue card; they use the original placeholder art in /public/demo-venues.
const venueSamples: { title: string; venue: VenueCardData }[] = [
  {
    title: "Con portada y logo",
    venue: {
      slug: "sala-norte",
      name: "Sala Norte",
      zone: "San José",
      cover_url: "/demo-venues/sala-norte-cover.jpg",
      logo_url: "/demo-venues/sala-norte-logo.png",
    },
  },
  {
    title: "Con portada, sin ubicación",
    venue: {
      slug: "patio-central",
      name: "Patio Central",
      zone: "",
      cover_url: "/demo-venues/patio-central-cover.jpg",
      logo_url: "/demo-venues/patio-central-logo.png",
    },
  },
  {
    title: "Sin imágenes (placeholder)",
    venue: {
      slug: "club-cero",
      name: "Club Cero",
      zone: "San José",
      cover_url: null,
      logo_url: null,
    },
  },
  {
    title: "Nombre y ubicación largos",
    venue: {
      slug: "largo",
      name: "Cervecería y Taller de Cocteles del Patio Antiguo de la Estación",
      zone: "Barrio Escalante, San José, Costa Rica",
      cover_url: "/demo-venues/club-cero-cover.jpg",
      logo_url: null,
    },
  },
  {
    title: "Portada casi blanca (peor caso de contraste)",
    venue: {
      slug: "clara",
      name: "Cervecería y Taller de Cocteles del Patio Antiguo",
      zone: "Barrio Escalante, San José, Costa Rica, Centroamérica",
      cover_url: `data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='16' height='10'><rect width='16' height='10' fill='white'/></svg>")}`,
      logo_url: null,
    },
  },
  {
    title: "Imagen que no carga (cae al placeholder)",
    venue: {
      slug: "rota",
      name: "Imagen rota",
      zone: "Heredia",
      cover_url: "/demo-venues/no-existe-cover.jpg",
      logo_url: "/demo-venues/no-existe-logo.png",
    },
  },
];
export default function DesignSystem() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_DESIGN_SYSTEM !== "true"
  )
    notFound();
  return (
    <div className="page wide">
      <p className="eyebrow">Onza · componentes</p>
      <h1>Sistema de diseño</h1>
      <p className="muted">
        Una misma identidad para elegir, preparar y recoger.
      </p>
      <div className="stack loose" style={{ marginTop: 32 }}>
        <section className="stack">
          <h2>Acciones</h2>
          <Button>
            Pedir · <Price amount={950000} />
          </Button>
          <Button variant="secondary">Aceptar y preparar</Button>
          <Button variant="quiet">Volver al menú</Button>
          <Button variant="danger">Cancelar pedido</Button>
          <Button loading>Confirmando pedido</Button>
          <Button disabled>No disponible</Button>
          <IconButton label="Agregar">
            <Plus size={20} />
          </IconButton>
        </section>
        <section className="stack" aria-label="Controles">
          <h2>Controles y estados</h2>
          <ControlsSample />
        </section>
        <section className="stack" aria-labelledby="venue-cards">
          <h2 id="venue-cards">Tarjeta de local</h2>
          <div className="vgrid">
            {venueSamples.map(({ title, venue }) => (
              <div
                className="stack tight"
                key={venue.slug}
                data-sample={venue.slug}
              >
                <p className="muted">{title}</p>
                <VenueCard preview venue={venue} />
              </div>
            ))}
          </div>
        </section>
        <section className="stack" aria-label="Momento final">
          <h2>Momento final del retiro</h2>
          <EnjoyMoment venueName="Sala Norte" menuHref="/v/sala-norte" />
        </section>
        <section className="stack" aria-label="Menú de tragos">
          <h2>Menú de tragos</h2>
          <ProductMenu
            venue={sampleVenue}
            products={sampleProducts}
            categories={[{ id: sampleCategory, label: "Cocteles" }]}
          />
        </section>
        <section className="stack" aria-label="Editor de trago">
          <h2>Editor de trago</h2>
          <ProductEditorSample
            venueId={sampleVenue.id}
            product={sampleProducts[0]}
            categories={[{ id: sampleCategory, label: "Cocteles" }]}
          />
        </section>
        <section className="stack" aria-label="Perfil del local">
          <VenueProfile venue={sampleVenue} />
        </section>
        <section className="stack">
          <h2>Estados y formularios</h2>
          <StatusBadge>Recibido · esperando al local</StatusBadge>
          <StatusBadge tone="success">Listo para retirar</StatusBadge>
          <StatusBadge tone="warning">
            Reserva pendiente de confirmación
          </StatusBadge>
          <TextField label="Código de retiro" placeholder="ABC234" />
          <TextField
            label="Nombre del producto"
            error="Ingresá un nombre antes de publicar."
          />
          <PhotoFallback name="Paloma" />
          <ErrorState message="No pudimos confirmar el cobro. Consultá el estado antes de reintentar." />
        </section>
      </div>
    </div>
  );
}
