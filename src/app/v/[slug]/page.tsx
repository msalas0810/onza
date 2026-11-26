import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getVenue, getPublishedMenu } from "@/features/catalog/server/queries";
import { ProductMenu } from "@/features/catalog/components/product-menu";
import { VenueHero } from "@/features/catalog/components/venue-hero";
import { ConfigurationState } from "@/components/ui/configuration-state";
import { Notice, buttonClass } from "@/components/ui/primitives";
import { listSpots } from "@/features/delivery/server/queries";
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
  let venue, menu, spots;
  try {
    venue = await getVenue(slug);
    menu = await getPublishedMenu(venue.id);
    // Un local que entrega en el lugar ofrece sus lugares habilitados; el del QR (?spot=) solo cuenta si es de este local.
    spots = offersLocation(venue.delivery_mode as DeliveryMode)
      ? (await listSpots(venue.id)).filter((s) => s.enabled)
      : [];
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
      <Link className="back" href="/">
        <ChevronLeft size={16} aria-hidden="true" />
        Explorar
      </Link>
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
            presetSpotId={spots.find((s) => s.id === spot)?.id}
          />
          <ProductMenu venue={venue} {...menu} />
        </>
      )}
    </div>
  );
}
