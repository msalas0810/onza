"use client";
import { useEffect, useState } from "react";
import { Copy, Download, QrCode, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import {
  ELEMENT_TYPES,
  ZONE_DELIVERY,
  ZONE_KINDS,
  elementTypeLabels,
  zoneDeliveryLabels,
  zoneKindLabels,
  type MapDetail,
  type MapElement,
  type MapZone,
  type ZoneDelivery,
} from "../types";
import styles from "./maps.module.css";

const deliveryHelp: Record<ZoneDelivery, string> = {
  default: "Solo informativa: no cambia dónde se puede entregar.",
  allow:
    "Si el plano tiene zonas de este tipo, la entrega solo se acepta dentro de ellas.",
  restrict:
    "El cliente no puede marcar su ubicación aquí. Útil para cocina, backstage o zonas cerradas.",
};

/** Enlace y QR de una mesa: al escanearlo, el cliente queda ubicado en esa mesa sin abrir el plano. */
function TableQr({ slug, element }: { slug: string; element: MapElement }) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const url =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/v/${slug}?mesa=${element.id}`;
  useEffect(() => {
    let closed = false;
    if (!url) return;
    void import("qrcode").then(({ default: QRCode }) =>
      QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: "M",
      }).then((data) => !closed && setQr(data)),
    );
    return () => {
      closed = true;
    };
  }, [url]);
  return (
    <div className={styles.qrBox}>
      <div className="t-label muted">
        <QrCode
          size={14}
          aria-hidden="true"
          style={{ verticalAlign: "-2px" }}
        />{" "}
        QR de la {element.label}
      </div>
      <p className="muted t-label">
        Imprimilo en la mesa. El cliente que lo escanee queda ubicado ahí; el QR
        no contiene datos personales ni de pago.
      </p>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt={`QR de ${element.label}`} width={160} height={160} />
      )}
      <div className={styles.cardRow}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(url)
              .then(() => setCopied(true));
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          <Copy size={16} aria-hidden="true" />{" "}
          {copied ? "Copiado" : "Copiar enlace"}
        </Button>
        {qr && (
          <a
            className="btn secondary sm"
            href={qr}
            download={`qr-${element.label.replace(/\W+/g, "-").toLowerCase()}.png`}
          >
            <Download size={16} aria-hidden="true" /> Descargar QR
          </a>
        )}
      </div>
    </div>
  );
}

export function ElementInspector({
  element,
  slug,
  onChange,
  onDelete,
}: {
  element: MapElement;
  slug: string;
  onChange: (patch: Partial<MapElement>) => void;
  onDelete: () => void;
}) {
  return (
    <div className={styles.inspector} data-testid="element-inspector">
      <label className="field">
        <span>Nombre</span>
        <input
          value={element.label}
          maxLength={60}
          onChange={(e) => onChange({ label: e.target.value })}
          aria-invalid={!element.label.trim()}
        />
      </label>
      <label className="field">
        <span>Tipo</span>
        <select
          value={element.type}
          onChange={(e) =>
            onChange({ type: e.target.value as MapElement["type"] })
          }
        >
          {ELEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {elementTypeLabels[t]}
            </option>
          ))}
        </select>
      </label>
      <p className="muted t-label">
        Arrastrá el marcador en el plano para moverlo.
      </p>
      {element.type === "table" && <TableQr slug={slug} element={element} />}
      <Button variant="danger" size="sm" onClick={onDelete}>
        <Trash2 size={16} aria-hidden="true" /> Eliminar
      </Button>
    </div>
  );
}

export function ZoneInspector({
  zone,
  team,
  assigned,
  onChange,
  onDelete,
  onAssign,
}: {
  zone: MapZone;
  team: MapDetail["team"];
  assigned: string[];
  onChange: (patch: Partial<MapZone>) => void;
  onDelete: () => void;
  onAssign: (userIds: string[]) => void;
}) {
  return (
    <div className={styles.inspector} data-testid="zone-inspector">
      <label className="field">
        <span>Nombre de la zona</span>
        <input
          value={zone.name}
          maxLength={60}
          onChange={(e) => onChange({ name: e.target.value })}
          aria-invalid={!zone.name.trim()}
        />
      </label>
      <label className="field">
        <span>Tipo</span>
        <select
          value={zone.kind}
          onChange={(e) =>
            onChange({ kind: e.target.value as MapZone["kind"] })
          }
        >
          {ZONE_KINDS.map((k) => (
            <option key={k} value={k}>
              {zoneKindLabels[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Entrega</span>
        <select
          value={zone.delivery}
          onChange={(e) =>
            onChange({ delivery: e.target.value as ZoneDelivery })
          }
        >
          {ZONE_DELIVERY.map((d) => (
            <option key={d} value={d}>
              {zoneDeliveryLabels[d]}
            </option>
          ))}
        </select>
        <span className="hint">{deliveryHelp[zone.delivery]}</span>
      </label>
      <p className="muted t-label">
        Arrastrá los puntos de la zona en el plano para ajustar su forma.
      </p>
      {team.length > 0 && (
        <fieldset className={styles.staffBox}>
          <legend className="t-label">Personal asignado a esta zona</legend>
          {team.map((person) => (
            <label key={person.user_id} className="checkbox">
              <input
                type="checkbox"
                checked={assigned.includes(person.user_id)}
                onChange={(e) =>
                  onAssign(
                    e.target.checked
                      ? [...assigned, person.user_id]
                      : assigned.filter((id) => id !== person.user_id),
                  )
                }
              />
              <span>{person.name}</span>
            </label>
          ))}
          <span className="hint">
            Se guarda el borrador al asignar. El equipo ve a quién corresponde
            la zona de cada pedido.
          </span>
        </fieldset>
      )}
      <Button variant="danger" size="sm" onClick={onDelete}>
        <Trash2 size={16} aria-hidden="true" /> Eliminar zona
      </Button>
    </div>
  );
}
