import { headers } from "next/headers";
import Link from "next/link";
import QRCode from "qrcode";
import { StaffShell } from "@/components/ui/staff-shell";
import { staffGate } from "@/components/ui/staff-gate";
import { buttonClass } from "@/components/ui/primitives";
import { loadStaffContext } from "@/features/team/server/staff-context";
import { listSpots } from "@/features/delivery/server/queries";
import { PrintButton } from "@/features/delivery/components/print-button";
import { spotText } from "@/features/delivery/types";

export const dynamic = "force-dynamic";

/** Hoja para imprimir: el QR del local y el de cada lugar habilitado. Solo codifican direcciones públicas del menú. */
export default async function Page({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  const context = await loadStaffContext(venueId, true);
  const gate = staffGate(context, `/admin/${venueId}/qr`);
  if (gate || !context.ok) return gate;
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const origin =
    process.env.APP_ORIGIN ??
    `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${host}`;
  const entry = `${origin}/v/${context.venue.slug}`;
  const spots = (await listSpots(venueId).catch(() => [])).filter((s) => s.enabled);
  const qr = (url: string) =>
    QRCode.toDataURL(url, { width: 480, margin: 2, errorCorrectionLevel: "M" });
  const cards = [
    {
      key: "venue",
      title: context.venue.name,
      caption: "Escaneá para ver el menú y pedir",
      src: await qr(entry),
    },
    ...(await Promise.all(
      spots.map(async (spot) => ({
        key: spot.id,
        title: spotText({ spot_label: spot.label, spot_area: spot.area }),
        caption: `Escaneá, pedí y te lo llevamos a ${context.venue.spot_noun.toLowerCase()} ${spot.label.replace(new RegExp(`^${context.venue.spot_noun}\\s*`, "i"), "")}`.trim(),
        src: await qr(`${entry}?spot=${spot.id}`),
      })),
    )),
  ];
  return (
    <StaffShell
      venue={context.venue}
      person={context.person}
      canSwitch={context.venueCount > 1}
    >
      <div className="row between wrap no-print" style={{ marginBottom: 16 }}>
        <div>
          <p className="eyebrow">Administración</p>
          <h1 className="t-title">QR para imprimir</h1>
          <p className="muted t-label">
            {cards.length - 1} lugares habilitados. Cada QR abre el menú de {context.venue.name}
            {spots.length ? " con el lugar ya elegido" : ""}.
          </p>
        </div>
        <div className="row wrap">
          <Link
            className={buttonClass({ variant: "secondary" })}
            href={`/admin/${venueId}?tab=entrega`}
          >
            Volver a Entrega
          </Link>
          <PrintButton />
        </div>
      </div>
      <div className="qr-sheet">
        {cards.map((card) => (
          <figure className="qr-card" key={card.key}>
            {/* Data URL local: no hay nada que optimizar ni pedir a la red. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.src} alt={`QR de ${card.title}`} width={240} height={240} />
            <figcaption>
              <strong>{card.title}</strong>
              <span>{card.caption}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </StaffShell>
  );
}
