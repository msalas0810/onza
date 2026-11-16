import Link from "next/link";
import { getVenue, getPublishedMenu } from "@/features/catalog/server/queries";
import { ProductMenu } from "@/features/catalog/components/product-menu";
import { ConfigurationState } from "@/components/ui/configuration-state";
import { StatusBadge } from "@/components/ui/primitives";
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
  return (
    <div className="page">
      <Link className="link-button" href="/">
        ← Locales
      </Link>
      <header className="menu-header">
        <p className="eyebrow">{venue.zone}</p>
        <h1>{venue.name}</h1>
        <p className="muted">
          {venue.pickup_label}
          {venue.hours !== "Consultar al local" && ` · ${venue.hours}`}
        </p>
        <StatusBadge
          tone={
            venue.paused || venue.open_state === "closed"
              ? "warning"
              : "success"
          }
        >
          {venue.open_state === "closed"
            ? "Cerrado"
            : venue.paused
              ? "Pedidos pausados"
              : "Recibiendo pedidos"}
        </StatusBadge>
      </header>
      {venue.open_state === "closed" ? (
        <p className="notice">
          Este local está cerrado y no recibe pedidos. Tus pedidos anteriores
          siguen en <Link href="/orders">Pedidos</Link>.
        </p>
      ) : (
        <ProductMenu venue={venue} {...menu} />
      )}
    </div>
  );
}
