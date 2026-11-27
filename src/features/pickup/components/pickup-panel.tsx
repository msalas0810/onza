"use client";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Keyboard,
  MapPin,
  ScanLine,
} from "lucide-react";
import { Button, Price, Notice } from "@/components/ui/primitives";
import { ProductImage } from "@/features/catalog/components/product-image";
import { productImageSrc } from "@/features/catalog/product-image-src";
import { sendCommand } from "@/features/orders/client-api";
import { orderSchema, type Order } from "@/features/orders/types";
import { formatPickupCode, isPickupCode, normalizePickupCode } from "../code";
import { spotText } from "@/features/delivery/types";
import { OrderMapButton } from "@/features/delivery/components/order-map-button";

type Detector = {
  detect: (video: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

/** Pide la cámara trasera. Llamarla dentro del toque en «Validar retiro»: Safari exige un gesto para abrirla. */
export function startCamera(): Promise<MediaStream> | null {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });
}
const hasDetector = () =>
  typeof window !== "undefined" &&
  !!(window as Window & { BarcodeDetector?: DetectorConstructor })
    .BarcodeDetector;

/**
 * Retiro en la barra. Contra el servidor no cambia nada: resolver (asigna el retiro a esta sesión) → cobro simulado →
 * entrega física. El escaneo solo identifica el pedido; cada confirmación es una acción separada.
 * - Escáner primero; «Ingresar código» siempre visible. Si falla el permiso, la cámara o no hay detector, pasa al código
 *   manual sin perder el contexto.
 * - Un retiro interrumpido se retoma (resumeOrderId) sin volver a cobrar: la captura es idempotente en el servidor.
 */
export function PickupPanel({
  venueId,
  camera,
  resumeOrderId,
  onChanged,
  onDone,
}: {
  venueId: string;
  /** Cámara pedida desde el gesto que abrió el panel; null abre directo en código manual. */
  camera: Promise<MediaStream> | null;
  resumeOrderId?: string | null;
  onChanged: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"scan" | "manual" | "order">(
    resumeOrderId ? "order" : camera ? "scan" : "manual",
  );
  const [stream, setStream] = useState<Promise<MediaStream> | null>(camera);
  const [scanNote, setScanNote] = useState(
    camera ? "" : "Ingresá el código privado del cliente.",
  );
  const [code, setCode] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [physical, setPhysical] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const lock = useRef(false);
  const video = useRef<HTMLVideoElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);

  // Cámara y lectura del QR. Se detiene al salir del modo escáner, al validar o al cerrar.
  useEffect(() => {
    if (mode !== "scan" || !stream) return;
    const element = video.current;
    let stopped = false;
    let active: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fallback = (note: string) => {
      if (stopped) return;
      setScanNote(note);
      setMode("manual");
    };
    stream
      .then(async (media) => {
        active = media;
        if (stopped) return;
        const Detector = (
          window as Window & { BarcodeDetector?: DetectorConstructor }
        ).BarcodeDetector;
        if (!Detector)
          return fallback(
            "Este navegador no lee QR. Ingresá el código privado del cliente.",
          );
        if (!video.current) return;
        video.current.srcObject = media;
        await video.current.play().catch(() => undefined);
        const detector = new Detector({ formats: ["qr_code"] });
        const tick = async () => {
          if (stopped || !video.current) return;
          try {
            const found = (await detector.detect(video.current)).find((m) =>
              m.rawValue.startsWith("onza:"),
            )?.rawValue;
            if (found) {
              void resolve({ token: found.slice(5) });
              return;
            }
          } catch {
            /* El cuadro todavía no está listo. */
          }
          timer = setTimeout(() => void tick(), 250);
        };
        void tick();
      })
      .catch(() =>
        fallback(
          "No pudimos usar la cámara. Ingresá el código privado del cliente.",
        ),
      );
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      active?.getTracks().forEach((track) => track.stop());
      if (element) element.srcObject = null;
    };
    // resolve es estable para este propósito: solo cambia el estado del panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stream]);

  useEffect(() => {
    if (mode === "manual") field.current?.focus();
  }, [mode]);

  // Retomar un retiro ya validado (por ejemplo, tras cortarse la red entre el cobro y la entrega).
  useEffect(() => {
    if (!resumeOrderId) return;
    let closed = false;
    void sendCommand({ action: "get", orderId: resumeOrderId })
      .then((data) => {
        if (closed) return;
        setError("");
        setPhysical(false);
        setOrder(orderSchema.parse(data));
      })
      .catch(() => {
        if (!closed) setError("No pudimos retomar el retiro. Volvé a consultar.");
      });
    return () => {
      closed = true;
    };
  }, [resumeOrderId]);

  async function resolve(input: { token: string } | { code: string }) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const next = orderSchema.parse(
        await sendCommand({ action: "resolve", venueId, ...input }),
      );
      setOrder(next);
      setPhysical(false);
      setDelivered(false);
      setCode("");
      setMode("order");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos validar el retiro.");
      if (mode === "scan" && "token" in input) setMode("manual");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function act(action: "capture" | "reconcile" | "complete") {
    if (!order?.claim_id || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const next = orderSchema.parse(
        await sendCommand({
          action,
          orderId: order.id,
          claimId: order.claim_id,
          physicalHandoff: physical,
        }),
      );
      setOrder(next);
      if (action === "complete" && next.status === "delivered")
        setDelivered(true);
      onChanged();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "La operación no pudo confirmarse.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  const restart = (scan: boolean) => {
    setOrder(null);
    setError("");
    setDelivered(false);
    setPhysical(false);
    setScanNote("");
    if (scan && hasDetector()) {
      setStream(startCamera());
      setMode("scan");
    } else {
      if (scan) setScanNote("Este navegador no lee QR. Ingresá el código privado del cliente.");
      setMode("manual");
    }
  };

  if (order && delivered)
    return (
      <div className="stack">
        <div className="result ok" role="status">
          <span className="big">
            <svg className="ico anim-check" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <strong className="t-heading">
            Entregado #{order.public_code}
            {order.fulfillment === "location" && ` en ${spotText(order)}`}
          </strong>
          <span>
            {order.items.map((i) => `${i.quantity}× ${i.name_snapshot}`).join(", ")}
          </span>
        </div>
        <Button size="lg" block onClick={onDone}>
          Volver a la cola
        </Button>
        <Button variant="quiet" block onClick={() => restart(true)}>
          Validar otro retiro
        </Button>
      </div>
    );

  if (mode === "scan")
    return (
      <div className="stack">
        <div className="scanner">
          <video ref={video} muted playsInline aria-label="Vista de cámara para leer el QR" />
          <span className="scanner-frame" aria-hidden="true" />
        </div>
        <p className="muted t-label center" role="status">
          {busy ? "Validando…" : "Apuntá al QR del ticket del cliente."}
        </p>
        <Button variant="secondary" size="lg" block onClick={() => setMode("manual")}>
          <Keyboard size={20} aria-hidden="true" />
          Ingresar código
        </Button>
      </div>
    );

  if (mode === "manual")
    return (
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (isPickupCode(code)) void resolve({ code: normalizePickupCode(code) });
        }}
      >
        {scanNote && <Notice tone="warning">{scanNote}</Notice>}
        <label className="field">
          <span>Código privado</span>
          <input
            ref={field}
            className="code-input pickup-code-field"
            placeholder="AB12 CD34 EF56"
            value={code}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
            aria-describedby="pickup-code-hint"
            onChange={(e) => setCode(formatPickupCode(e.target.value))}
            onPaste={(e) => {
              e.preventDefault();
              setCode(formatPickupCode(e.clipboardData.getData("text")));
            }}
          />
          <span className="hint" id="pickup-code-hint">
            12 caracteres del ticket del cliente. El número del pedido no sirve.
          </span>
        </label>
        {error && (
          <div className="result bad" role="alert">
            <AlertCircle size={24} aria-hidden="true" />
            <strong>{error}</strong>
          </div>
        )}
        <Button type="submit" size="lg" block loading={busy} disabled={!isPickupCode(code)}>
          Validar
        </Button>
        <Button type="button" variant="quiet" block onClick={() => restart(true)}>
          <ScanLine size={20} aria-hidden="true" />
          Escanear QR
        </Button>
      </form>
    );

  // Pedido identificado: resumen → cobro simulado → entrega física.
  const captured = order?.payment_state === "captured";
  const inProgress = busy || captured || order?.payment_state === "unknown";
  return (
    <section className="stack" aria-live="polite">
      {!order ? (
        error ? (
          <div className="result bad" role="alert">
            <AlertCircle size={24} aria-hidden="true" />
            <strong>{error}</strong>
          </div>
        ) : (
          <p role="status">Consultando el retiro…</p>
        )
      ) : (
        <>
          <div className="pickup-summary">
            <div className="row between">
              <strong className="num">#{order.public_code}</strong>
              <Price amount={order.total_minor} />
            </div>
            {order.fulfillment === "location" && (
              <p className="where-line" role="status">
                <MapPin size={16} aria-hidden="true" />
                Entregar en {spotText(order)}
              </p>
            )}
            {order.fulfillment === "location" && <OrderMapButton order={order} />}
            <ul className="pickup-items">
              {order.items.map((i) => (
                <li key={i.id}>
                  <span className="thumb">
                    <ProductImage
                      name={i.name_snapshot}
                      src={productImageSrc({ image_url: i.image_url ?? null, photo_path: i.photo_path ?? null })}
                    />
                  </span>
                  <span className="q">{i.quantity}×</span>
                  <span className="grow">{i.name_snapshot}</span>
                </li>
              ))}
            </ul>
          </div>
          {order.status === "delivered" ? (
            <div className="result bad" role="alert">
              <AlertCircle size={24} aria-hidden="true" />
              <strong>
                Este código ya se usó: #{order.public_code} se entregó. No cobres ni entregues otra vez.
              </strong>
            </div>
          ) : order.claimed_elsewhere ? (
            <Notice tone="warning">
              Otra persona está atendiendo este retiro. Solo esa sesión puede entregar.
            </Notice>
          ) : (
            <ol className="pickup-steps">
              <li data-done={captured || undefined}>
                <span className="step-n" aria-hidden="true">
                  {captured ? <Check size={16} /> : 1}
                </span>
                <div className="grow stack tight">
                  <strong>Cobro simulado</strong>
                  {order.capture_state === "declined" && (
                    <Notice tone="danger">
                      Captura rechazada. No entregues. Pedile al supervisor la cancelación y la anulación de la reserva.
                    </Notice>
                  )}
                  {order.payment_state === "authorized" && order.capture_state !== "declined" && (
                    <Button size="lg" block loading={busy} onClick={() => void act("capture")}>
                      Confirmar cobro simulado · <Price amount={order.total_minor} />
                    </Button>
                  )}
                  {order.payment_state === "unknown" && (
                    <>
                      <Notice tone="danger">
                        No entregues: el cobro no está confirmado. El retiro sigue asignado a esta sesión.
                      </Notice>
                      <Button variant="secondary" size="lg" block loading={busy} onClick={() => void act("reconcile")}>
                        Consultar resultado del cobro
                      </Button>
                    </>
                  )}
                  {captured && <span className="muted t-label">Cobro confirmado (simulado).</span>}
                </div>
              </li>
              <li data-disabled={!captured || undefined}>
                <span className="step-n" aria-hidden="true">2</span>
                <div className="grow stack tight">
                  <strong>Entrega física</strong>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={physical}
                      disabled={!captured}
                      onChange={(e) => setPhysical(e.target.checked)}
                    />
                    <span>
                      {order.fulfillment === "location"
                        ? `Entregué el pedido completo en ${spotText(order)}.`
                        : "Entregué físicamente el pedido completo."}
                    </span>
                  </label>
                  <Button
                    size="lg"
                    block
                    variant="success"
                    loading={busy && captured}
                    disabled={!captured || !physical}
                    onClick={() => void act("complete")}
                  >
                    <Check size={20} aria-hidden="true" />
                    Confirmar entrega
                  </Button>
                </div>
              </li>
            </ol>
          )}
          {error && (
            <div className="result bad" role="alert">
              <AlertCircle size={24} aria-hidden="true" />
              <strong>{error}</strong>
            </div>
          )}
        </>
      )}
      {inProgress && order?.status !== "delivered" ? (
        <p className="hint center">
          Si se corta la conexión, cerrá y tocá «Retomar entrega»: no se cobra dos veces.
        </p>
      ) : (
        <Button variant="quiet" onClick={() => restart(true)}>
          <ArrowLeft size={18} aria-hidden="true" />
          Validar otro código
        </Button>
      )}
    </section>
  );
}
