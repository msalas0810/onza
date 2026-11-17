import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getVenue, getPublishedMenu } from "@/features/catalog/server/queries";
import { ProductMenu } from "@/features/catalog/components/product-menu";
import { VenueHero } from "@/features/catalog/components/venue-hero";
import { ConfigurationState } from "@/components/ui/configuration-state";
import { Notice, buttonClass } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export default async function MenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let venue, menu;
  try {
    venue = await getVenue(slug);
    menu = await getPublishedMenu(venue.id);
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
          <ProductMenu venue={venue} {...menu} />
        </>
      )}
    </div>
  );
}
