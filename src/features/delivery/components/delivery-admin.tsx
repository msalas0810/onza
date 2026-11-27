"use client";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Circle, Copy, Printer, QrCode } from "lucide-react";
import type { Venue } from "@/features/catalog/server/queries";
import {
  Button,
  Notice,
  SegmentedControl,
  StatusBadge,
  TextField,
  Toggle,
} from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import {
  isPasswordChangeError,
  isSessionError,
  sendCommand,
} from "@/features/orders/client-api";
import { SessionExpiredSheet } from "@/features/orders/components/session-expired-sheet";
import { groupSpots, type DeliveryMode, type Spot, type VenueMap } from "../types";
import { MapAdmin } from "./map-admin";
import { QrImage } from "./qr-image";

const modeOptions = [
  { value: "bar", label: "Solo barra" },
  { value: "both", label: "Barra y lugar" },
  { value: "location", label: "Solo lugar" },
] as const;
const modeCopy: Record<DeliveryMode, string> = {
  bar: "Los clientes retiran en la barra con su QR o código. Es lo que hace hoy el local.",
  both: "Cada cliente elige: retirar en la barra o recibirlo donde está.",
  location: "Todos los pedidos se llevan al lugar del cliente. No hay retiro en la barra.",
};
const nounSuggestions = ["Mesa", "Zona", "Puesto", "Gradas", "Lugar"];

type Props = { venue: Venue; spots: Spot[]; map: VenueMap | null; availableProducts: number };

/**
 * Entrega en el lugar: cómo reciben los clientes, qué lugares hay (mesas, zonas o puestos), y el enlace y los QR para
 * entrar directo al local o a una mesa. La administración del local lo gestiona sola; la base valida cada cambio.
 */
export function DeliveryAdmin({ venue, spots, map, availableProducts }: Props) {
  const router = useRouter();
  const mode = (venue.delivery_mode ?? "bar") as DeliveryMode;
  const [draftMode, setDraftMode] = useState<DeliveryMode>(mode);
  const [noun, setNoun] = useState(venue.spot_noun ?? "Mesa");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [expired, setExpired] = useState(false);
  const [editing, setEditing] = useState<Spot | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editArea, setEditArea] = useState("");
  const [qrFor, setQrFor] = useState<Spot | "venue" | null>(null);
  const [removing, setRemoving] = useState<Spot | null>(null);
  // El origen solo existe en el navegador; en el servidor queda vacío y los enlaces aparecen al hidratar.
  const origin = useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState(false);
  const [bulk, setBulk] = useState({ prefix: venue.spot_noun ?? "Mesa", from: "1", to: "10", area: "" });
  const [one, setOne] = useState({ label: "", area: "" });

  const enabledCount = spots.filter((s) => s.enabled).length;
  const open = venue.open_state === "open" && !venue.paused;
  const ready = mode !== "bar" && (enabledCount > 0 || map !== null);
  const entryUrl = `${origin}/v/${venue.slug}`;
  const spotUrl = (spot: Spot) => `${entryUrl}?spot=${spot.id}`;

  const run = async (input: Record<string, unknown>, message: string) => {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const result = await sendCommand(input);
      setSaved(message);
      router.refresh();
      return result;
    } catch (e) {
      if (isSessionError(e)) setExpired(true);
      else if (isPasswordChangeError(e)) router.push("/equipo/clave");
      else setError(e instanceof Error ? e.message : "No se guardó el cambio.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("No pudimos copiar. Seleccioná el enlace y copialo a mano.");
    }
  };
  const groups = groupSpots(spots);

  return (
    <div className="stack loose">
      {error && <Notice tone="danger">{error}</Notice>}
      {saved && (
        <p role="status" className="saved">
          {saved}
        </p>
      )}
      <section className="block-card" aria-labelledby="delivery-ready">
        <div className="row between wrap">
          <h2 id="delivery-ready">Listo para operar</h2>
          <StatusBadge tone={open && ready && availableProducts > 0 ? "success" : "warning"}>
            {open && ready && availableProducts > 0 ? "Todo listo" : "Falta algo"}
          </StatusBadge>
        </div>
        <ul className="checklist">
          {[
            {
              done: ready,
              text: "La entrega en el lugar está activa y hay un mapa o lugares habilitados",
              fix: "Activala acá abajo",
            },
            {
              done: availableProducts > 0,
              text: `${availableProducts} ${availableProducts === 1 ? "producto disponible" : "productos disponibles"} en el menú`,
              href: `/admin/${venue.id}?tab=menu`,
              fix: "Revisá el menú",
            },
            {
              done: open,
              text: venue.open_state !== "open" ? "El local está cerrado" : venue.paused ? "Los pedidos están pausados" : "El local recibe pedidos",
              href: `/admin/${venue.id}?tab=ahora`,
              fix: "Cambiá el estado",
            },
          ].map((item) => (
            <li key={item.text} data-done={item.done || undefined}>
              {item.done ? <Check size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
              <span className="grow">{item.text}</span>
              {!item.done && item.href && <Link href={item.href}>{item.fix}</Link>}
              {!item.done && !item.href && <span className="muted t-label">{item.fix}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="block-card" aria-labelledby="delivery-how">
        <h2 id="delivery-how">Cómo reciben los clientes</h2>
        <SegmentedControl<DeliveryMode>
          block
          label="Cómo reciben los clientes"
          value={draftMode}
          options={modeOptions}
          onChange={setDraftMode}
        />
        <p className="muted">{modeCopy[draftMode]}</p>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              { action: "venue_delivery", venueId: venue.id, mode: draftMode, noun: noun.trim() || "Mesa" },
              draftMode === "bar" ? "Guardado: solo retiro en la barra." : "Guardado: la entrega en el lugar está activa.",
            );
          }}
        >
          <TextField
            label="Cómo se llaman los lugares"
            value={noun}
            maxLength={20}
            onChange={(e) => setNoun(e.target.value)}
            hint="La palabra que ve el cliente: «Elegí tu mesa», «Elegí tu zona»…"
            style={{ maxWidth: 240 }}
          />
          <div className="chips" role="group" aria-label="Sugerencias de nombre">
            {nounSuggestions.map((suggestion) => (
              <button
                type="button"
                className="chip"
                key={suggestion}
                aria-current={noun === suggestion ? "true" : undefined}
                onClick={() => setNoun(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
          <div>
            <Button
              type="submit"
              loading={busy}
              disabled={draftMode === mode && noun.trim() === (venue.spot_noun ?? "Mesa")}
            >
              Guardar
            </Button>
          </div>
        </form>
        {draftMode !== "bar" && enabledCount === 0 && !map && (
          <Notice tone="warning">Cargá el mapa o agregá al menos un lugar abajo antes de activar la entrega en el lugar.</Notice>
        )}
      </section>

      <MapAdmin venue={venue} map={map} spots={spots} noun={venue.spot_noun ?? "Mesa"} busy={busy} run={run} />

      <section className="block-card" aria-labelledby="delivery-spots">
        <div className="row between wrap">
          <h2 id="delivery-spots">Lugares ({spots.length})</h2>
          <span className="muted t-label">{enabledCount} habilitados</span>
        </div>
        {!spots.length && (
          <p className="muted">
            Todavía no cargaste lugares. Creá varios de una vez (por ejemplo «Mesa 1» a «Mesa 20») o uno por uno.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.area || "_"}>
            <h3 className="eyebrow section-label">{group.area || "Sin zona"}</h3>
            <div className="rows">
              {group.spots.map((spot) => (
                <div className="r wrap" key={spot.id}>
                  <strong className="grow">
                    {spot.label}
                    {!spot.enabled && (
                      <>
                        {" "}
                        <StatusBadge>Deshabilitado</StatusBadge>
                      </>
                    )}
                    {map && spot.shape && (
                      <>
                        {" "}
                        <StatusBadge tone="success">En el mapa</StatusBadge>
                      </>
                    )}
                  </strong>
                  <Toggle
                    label={<span className="t-label">Habilitado<span className="sr-only"> {spot.label}</span></span>}
                    checked={spot.enabled}
                    disabled={busy}
                    onChange={(enabled) =>
                      void run(
                        { action: "spot_save", venueId: venue.id, spotId: spot.id, label: spot.label, area: spot.area, enabled },
                        enabled ? `${spot.label} habilitado.` : `${spot.label} deshabilitado: ya no se puede elegir.`,
                      )
                    }
                  />
                  <Button variant="quiet" size="sm" aria-label={`QR de ${spot.label}`} onClick={() => setQrFor(spot)}>
                    <QrCode size={16} aria-hidden="true" /> QR
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => {
                      setEditing(spot);
                      setEditLabel(spot.label);
                      setEditArea(spot.area);
                    }}
                  >
                    Editar
                  </Button>
                  <Button variant="quiet" size="sm" onClick={() => setRemoving(spot)}>
                    Borrar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await run(
              {
                action: "spot_bulk",
                venueId: venue.id,
                prefix: bulk.prefix,
                from: Number(bulk.from),
                to: Number(bulk.to),
                area: bulk.area,
              },
              "",
            );
            const r = result as { created?: number; skipped?: number } | null;
            if (r)
              setSaved(
                `Se crearon ${r.created ?? 0} lugares${r.skipped ? ` y se omitieron ${r.skipped} que ya existían` : ""}.`,
              );
          }}
        >
          <h3>Crear varios de una vez</h3>
          <div className="spot-form">
            <TextField label="Nombre" value={bulk.prefix} maxLength={30} onChange={(e) => setBulk({ ...bulk, prefix: e.target.value })} />
            <TextField label="Desde" type="number" min={1} max={9999} value={bulk.from} onChange={(e) => setBulk({ ...bulk, from: e.target.value })} />
            <TextField label="Hasta" type="number" min={1} max={9999} value={bulk.to} onChange={(e) => setBulk({ ...bulk, to: e.target.value })} />
            <TextField label="Zona (opcional)" value={bulk.area} maxLength={40} onChange={(e) => setBulk({ ...bulk, area: e.target.value })} />
          </div>
          <div>
            <Button type="submit" variant="secondary" size="sm" loading={busy}>
              Crear lugares
            </Button>
          </div>
        </form>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run({ action: "spot_save", venueId: venue.id, label: one.label, area: one.area }, `${one.label.trim()} agregado.`))
              setOne({ label: "", area: one.area });
          }}
        >
          <h3>Agregar uno</h3>
          <div className="spot-form">
            <TextField label="Nombre" value={one.label} maxLength={40} required onChange={(e) => setOne({ ...one, label: e.target.value })} />
            <TextField label="Zona (opcional)" value={one.area} maxLength={40} onChange={(e) => setOne({ ...one, area: e.target.value })} />
          </div>
          <div>
            <Button type="submit" variant="secondary" size="sm" loading={busy} disabled={!one.label.trim()}>
              Agregar
            </Button>
          </div>
        </form>
      </section>

      <section className="block-card" aria-labelledby="delivery-qr">
        <h2 id="delivery-qr">Entrada directa y QR</h2>
        <p className="muted">
          El enlace abre el menú del local. Con el QR de una mesa, el cliente entra con su lugar ya elegido (igual puede
          cambiarlo). Los QR solo contienen la dirección: nunca datos de pago ni del pedido.
        </p>
        <div className="entry-link">
          <a href={entryUrl} target="_blank" rel="noreferrer" className="grow">
            {entryUrl}
          </a>
          <Button variant="secondary" size="sm" onClick={() => void copy(entryUrl)}>
            <Copy size={16} aria-hidden="true" /> {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <div className="row wrap">
          <Button variant="secondary" onClick={() => setQrFor("venue")}>
            <QrCode size={18} aria-hidden="true" /> QR del local
          </Button>
          <Link
            className="btn secondary"
            href={`/admin/${venue.id}/qr`}
            target="_blank"
            aria-disabled={!enabledCount}
          >
            <Printer size={18} aria-hidden="true" /> Imprimir QR de todos los lugares
          </Link>
        </div>
      </section>

      <Sheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing ? `Editar ${editing.label}` : "Editar"}
        description="El nombre nuevo se usa en los pedidos que vengan; los pedidos anteriores conservan el nombre que tenían."
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Volver
            </Button>
            <Button
              loading={busy}
              disabled={!editLabel.trim()}
              onClick={async () => {
                if (!editing) return;
                const ok = await run(
                  { action: "spot_save", venueId: venue.id, spotId: editing.id, label: editLabel, area: editArea },
                  "Lugar actualizado.",
                );
                if (ok) setEditing(null);
              }}
            >
              Guardar
            </Button>
          </>
        }
      >
        <div className="stack">
          <TextField label="Nombre" value={editLabel} maxLength={40} onChange={(e) => setEditLabel(e.target.value)} />
          <TextField label="Zona (opcional)" value={editArea} maxLength={40} onChange={(e) => setEditArea(e.target.value)} />
        </div>
      </Sheet>
      <Sheet
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing ? `¿Borrar ${removing.label}?` : "Borrar"}
        description="Solo se puede borrar un lugar que nunca recibió pedidos. Si ya se usó, deshabilitalo: el historial conserva su nombre."
        actions={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Volver
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                if (!removing) return;
                const target = removing;
                setRemoving(null);
                await run({ action: "spot_delete", venueId: venue.id, spotId: target.id }, `${target.label} borrado.`);
              }}
            >
              Borrar
            </Button>
          </>
        }
      />
      <Sheet
        open={qrFor !== null}
        onOpenChange={(o) => !o && setQrFor(null)}
        title={qrFor === "venue" ? `QR de ${venue.name}` : qrFor ? `QR de ${qrFor.label}` : "QR"}
        description={
          qrFor === "venue"
            ? "Abre el menú del local."
            : "Abre el menú del local con este lugar ya elegido. Imprimilo y pegalo en el lugar."
        }
      >
        {qrFor && origin && (
          <div className="stack center">
            <QrImage
              url={qrFor === "venue" ? entryUrl : spotUrl(qrFor)}
              label={`QR de ${qrFor === "venue" ? venue.name : qrFor.label}`}
            />
            <a className="muted t-label" href={qrFor === "venue" ? entryUrl : spotUrl(qrFor)} target="_blank" rel="noreferrer">
              {qrFor === "venue" ? entryUrl : spotUrl(qrFor)}
            </a>
          </div>
        )}
      </Sheet>
      <SessionExpiredSheet open={expired} area="equipo" next={`/admin/${venue.id}?tab=entrega`} />
    </div>
  );
}
