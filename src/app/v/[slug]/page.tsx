import Link from "next/link";
import { ChevronLeft, MapPinCheck } from "lucide-react";
import { getVenue, getPublishedMenu } from "@/features/catalog/server/queries";
import { ProductMenu } from "@/features/catalog/components/product-menu";
import { VenueHero } from "@/features/catalog/components/venue-hero";
import { ConfigurationState } from "@/components/ui/configuration-state";
import { Notice, buttonClass } from "@/components/ui/primitives";
import { getVenueMap, listSpots } from "@/features/delivery/server/queries";
import { SpotEntry } from "@/features/delivery/components/spot-entry";
import { offersLocation, type DeliveryMode } from "@/features/delivery/types";

export const dynamic = "force-dynamic";
export default async function MenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ spot?: string }>;
}) {
  const { slug } = await params;
  const { spot } = await searchParams;
  let venue, menu, spots, map;
  try {
    venue = await getVenue(slug);
    // Un local sin publicar no se abre ni por enlace directo.
    if (venue.demo_listed === false) throw new Error("RESOURCE_NOT_FOUND");
    menu = await getPublishedMenu(venue.id);
    // Un local que entrega en el lugar ofrece sus lugares habilitados; el del QR (?spot=) solo cuenta si es de este local.
    spots = offersLocation(venue.delivery_mode as DeliveryMode)
      ? (await listSpots(venue.id)).filter((s) => s.enabled)
      : [];
    map = offersLocation(venue.delivery_mode as DeliveryMode) ? await getVenueMap(venue.id) : null;
  } catch (error) {
    return (
      <div className="page">
        <ConfigurationState error={error} />
      </div>
    );
  }
  const closed = venue.open_state === "closed";
  return (
    <div className="page menu">
      <div className="row between venue-top">
        <Link className="back" href="/">
          <ChevronLeft size={16} aria-hidden="true" />
          Explorar
        </Link>
        {/* Voluntario y aparte del pedido: marcar que estás acá no pide nada ni comparte nada por sí solo. */}
        {!closed && (
          <Link className="btn quiet sm" href={`/amigos?local=${encodeURIComponent(venue.slug)}`}>
            <MapPinCheck size={16} aria-hidden="true" /> Estoy acá
          </Link>
        )}
      </div>
      <VenueHero venue={venue} />
      {closed ? (
        <Notice
          title="Cerrado"
          action={
            <Link
              className={buttonClass({ variant: "secondary", size: "sm" })}
              href="/orders"
            >
              Ver mis pedidos
            </Link>
          }
        >
          Este local no recibe pedidos ahora. Tus pedidos anteriores siguen en
          Pedidos.
        </Notice>
      ) : (
        <>
          {venue.paused && (
            <Notice tone="warning" title="Pedidos pausados">
              Podés armar tu ronda. Vas a poder pedir cuando el local reanude.
            </Notice>
          )}
          <SpotEntry
            venueId={venue.id}
            mode={venue.delivery_mode as DeliveryMode}
            noun={venue.spot_noun}
            spots={spots}
            map={map}
            presetSpotId={spots.find((s) => s.id === spot)?.id}
          />
          <ProductMenu venue={venue} {...menu} />
        </>
      )}
    </div>
  );
}
