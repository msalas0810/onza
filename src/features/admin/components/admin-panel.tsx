"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Product, Venue } from "@/features/catalog/server/queries";
import { summarySchema, type VenueSummary } from "@/features/analytics/types";
import { Button, TextField, Price } from "@/components/ui/primitives";
import { ProductEditor } from "./product-editor";
import { sendCommand } from "@/features/orders/client-api";
import { useLiveOrders } from "@/features/orders/use-live-orders";
import { statusLabels, paymentLabels } from "@/features/orders/types";
export function AdminPanel({
  venue,
  products,
  categories,
  summary,
}: {
  venue: Venue;
  products: Product[];
  categories: { id: string; label: string }[];
  summary: VenueSummary;
}) {
  const [tab, setTab] = useState("Resumen");
  const [date, setDate] = useState(summary.business_date);
  const [metrics, setMetrics] = useState(summary);
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState<Product | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { orders, refresh } = useLiveOrders({ venueId: venue.id });
  const router = useRouter();
  const revision = orders
    .map((order) => `${order.id}:${order.version}`)
    .join("|");
  useEffect(() => {
    const controller = new AbortController();
    async function update() {
      try {
        const response = await fetch(
          `/api/summary?venue=${venue.id}&day=${date}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error();
        const data = summarySchema.parse(await response.json());
        setMetrics(data);
      } catch {
        if (!controller.signal.aborted)
          setError(
            "No pudimos actualizar las ventas. Los valores anteriores se conservan hasta volver a consultar.",
          );
      }
    }
    void update();
    return () => controller.abort();
  }, [venue.id, date, revision]);
  const run = async (input: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      await sendCommand(input);
      refresh();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se guardó el cambio.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <p className="eyebrow">Administración</p>
      <div className="row between wrap">
        <h1>{venue.name}</h1>
        <Link className="button secondary" href={`/staff/${venue.id}`}>
          Abrir barra
        </Link>
      </div>
      <nav className="tabs" aria-label="Administración">
        {["Resumen", "Pedidos", "Menú", "Ajustes"].map((name) => (
          <button
            aria-current={tab === name ? "page" : undefined}
            key={name}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {tab === "Resumen" && (
        <section className="stack">
          <h2>Ventas de Onza</h2>
          <p className="muted">
            Solo operaciones de esta demo. Fecha operativa: 06:00 a 06:00,
            America/Costa_Rica. No representa todas las ventas del
            establecimiento.
          </p>
          <form
            className="row wrap"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const response = await fetch(
                  `/api/summary?venue=${venue.id}&day=${date}`,
                );
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                setMetrics(summarySchema.parse(data));
                setError("");
              } catch {
                setError("No pudimos cargar el resumen.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <TextField
              label="Fecha operativa"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Button variant="secondary" type="submit" loading={busy}>
              Consultar
            </Button>
          </form>
          <div className="summary-grid">
            <div>
              <span className="muted">Cobro neto simulado</span>
              <strong>
                <Price
                  amount={metrics.captured_minor - metrics.refunded_minor}
                />
              </strong>
            </div>
            <div>
              <span className="muted">Reservado</span>
              <strong>
                <Price amount={metrics.reserved_minor} />
              </strong>
            </div>
            <div>
              <span className="muted">Entregados</span>
              <strong>{metrics.delivered_orders}</strong>
            </div>
            <div>
              <span className="muted">Mediana de preparación</span>
              <strong>
                {metrics.median_preparation_seconds === null
                  ? "—"
                  : `${Math.round(metrics.median_preparation_seconds / 60)} min`}
              </strong>
              <small>N = {metrics.preparation_n}</small>
            </div>
          </div>
          <p>
            Capturado: <Price amount={metrics.captured_minor} /> · Devuelto:{" "}
            <Price amount={metrics.refunded_minor} />
          </p>
          <p className="muted">
            Las reservas no son ventas ni depósitos. Las ventas por producto
            corresponden a pedidos entregados; pueden diferir del cobro neto por
            devoluciones o entregas pendientes.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Unidades entregadas</th>
                  <th>Venta entregada</th>
                </tr>
              </thead>
              <tbody>
                {metrics.products.map((p) => (
                  <tr key={p.product_id + p.name_snapshot}>
                    <td>{p.name_snapshot}</td>
                    <td>{p.units}</td>
                    <td>
                      <Price amount={p.total_minor} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!metrics.products.length && (
              <p className="muted">Sin entregas en esta fecha operativa.</p>
            )}
          </div>
        </section>
      )}
      {tab === "Pedidos" && (
        <section className="stack">
          <h2>Pedidos e incidencias</h2>
          {orders.map((o) => (
            <article className="order-card" key={o.id}>
              <h3>
                #{o.public_code} · {statusLabels[o.status]}
              </h3>
              <p>
                {paymentLabels[o.payment_state]} ·{" "}
                <Price amount={o.total_minor} />
              </p>
              {o.status === "pending_authorization" &&
                o.payment_state === "unknown" && (
                  <div className="stack">
                    <p className="warning">
                      Reserva sin referencia confirmada. No se repetirá la
                      autorización.
                    </p>
                    <Button
                      variant="secondary"
                      loading={busy}
                      onClick={() => {
                        const reason = prompt(
                          "Motivo / evidencia simulada de autorización confirmada (mínimo 5 caracteres):",
                        );
                        if (
                          reason &&
                          confirm(
                            "Solo DEMO: ¿simular evidencia de proveedor que confirma la reserva, sin crear otra autorización?",
                          )
                        )
                          void run({
                            action: "reconcile_authorization",
                            orderId: o.id,
                            outcome: "authorized",
                            providerResultConfirmed: true,
                            reason,
                          });
                      }}
                    >
                      Simular conciliación de reserva aprobada
                    </Button>
                    <Button
                      variant="danger"
                      loading={busy}
                      onClick={() => {
                        const reason = prompt(
                          "Motivo / evidencia simulada de reserva anulada (mínimo 5 caracteres):",
                        );
                        if (
                          reason &&
                          confirm(
                            "Solo DEMO: ¿simular evidencia de proveedor de que no hay reserva/cobro vigente?",
                          )
                        )
                          void run({
                            action: "reconcile_authorization",
                            orderId: o.id,
                            outcome: "voided",
                            providerResultConfirmed: true,
                            reason,
                          });
                      }}
                    >
                      Simular conciliación de reserva anulada
                    </Button>
                  </div>
                )}
              {o.status === "ready" && o.claimed_elsewhere && (
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() => {
                    const reason = prompt(
                      "Verificá físicamente que NO se entregó. Motivo de transferencia (mínimo 5 caracteres):",
                    );
                    if (
                      reason &&
                      confirm(
                        "¿Verificaste físicamente que el pedido aún no fue entregado?",
                      )
                    )
                      void run({
                        action: "transfer",
                        orderId: o.id,
                        physicalCheck: "not_delivered",
                        reason,
                      });
                  }}
                >
                  Transferir retiro a mi sesión
                </Button>
              )}
              {o.payment_state === "captured" && (
                <Button
                  variant="danger"
                  loading={busy}
                  onClick={() => {
                    const reason = prompt(
                      "Motivo de devolución completa (mínimo 5 caracteres):",
                    );
                    if (
                      reason &&
                      confirm("¿Confirmar devolución ficticia completa?")
                    )
                      void run({ action: "refund", orderId: o.id, reason });
                  }}
                >
                  Devolver monto simulado
                </Button>
              )}
              {["queued", "preparing", "ready"].includes(o.status) &&
                o.payment_state === "authorized" &&
                ((!o.claim_id && !o.claimed_elsewhere) ||
                  o.capture_state === "declined") && (
                  <Button
                    variant="danger"
                    loading={busy}
                    onClick={() => {
                      const reason = prompt(
                        "Motivo de cancelación (mínimo 3 caracteres):",
                      );
                      if (reason)
                        void run({
                          action: "cancel",
                          orderId: o.id,
                          expectedVersion: o.version,
                          idempotencyKey: crypto.randomUUID(),
                          reason,
                        });
                    }}
                  >
                    Cancelar mediante soporte
                  </Button>
                )}
            </article>
          ))}
        </section>
      )}
      {tab === "Menú" && (
        <section className="stack">
          <div className="row between">
            <h2>Menú publicado</h2>
            <Button onClick={() => setEdit(null)}>Crear producto</Button>
          </div>
          <TextField
            label="Filtrar productos"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {edit !== undefined ? (
            <div>
              <Button variant="quiet" onClick={() => setEdit(undefined)}>
                ← Cerrar edición
              </Button>
              <ProductEditor
                key={edit?.id ?? "new"}
                venueId={venue.id}
                product={edit}
                categories={categories}
                onSaved={() => {
                  setEdit(undefined);
                  router.refresh();
                }}
              />
            </div>
          ) : (
            products
              .filter((p) =>
                p.name.toLowerCase().includes(filter.toLowerCase()),
              )
              .map((p) => (
                <article className="product-row" key={p.id}>
                  <div>
                    <h3>{p.name}</h3>
                    <Price amount={p.price_minor} />
                    <p className="muted">
                      {p.available ? "Disponible" : "Agotado"}
                    </p>
                  </div>
                  <div className="stack">
                    <Button variant="secondary" onClick={() => setEdit(p)}>
                      Editar
                    </Button>
                    <Button
                      variant="quiet"
                      loading={busy}
                      onClick={() =>
                        void run({
                          action: "product_save",
                          venueId: venue.id,
                          productId: p.id,
                          expectedVersion: p.version,
                          available: !p.available,
                        })
                      }
                    >
                      {p.available ? "Agotar" : "Habilitar"}
                    </Button>
                    <Button
                      variant="quiet"
                      loading={busy}
                      onClick={() => {
                        if (
                          confirm(
                            "¿Archivar este producto? Los pedidos históricos conservarán sus datos.",
                          )
                        )
                          void run({
                            action: "product_save",
                            venueId: venue.id,
                            productId: p.id,
                            expectedVersion: p.version,
                            archived: true,
                          });
                      }}
                    >
                      Archivar
                    </Button>
                  </div>
                </article>
              ))
          )}
        </section>
      )}
      {tab === "Ajustes" && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run({
              action: "venue_update",
              venueId: venue.id,
              name: String(f.get("name")),
              zone: String(f.get("zone")),
              pickupLabel: String(f.get("pickup")),
              supportContact: String(f.get("contact")),
              hours: String(f.get("hours")),
              etaMinutes: Number(f.get("eta")),
              capacity: Number(f.get("capacity")),
              paused: f.get("paused") === "on",
              openState: String(f.get("state")),
            });
          }}
        >
          <h2>Operación del local</h2>
          <TextField
            name="name"
            label="Nombre del local"
            required
            defaultValue={venue.name}
          />
          <TextField name="zone" label="Zona" defaultValue={venue.zone} />
          <TextField
            name="pickup"
            label="Barra de retiro"
            required
            defaultValue={venue.pickup_label}
          />
          <TextField
            name="contact"
            label="Contacto de soporte"
            defaultValue={venue.support_contact}
          />
          <TextField
            name="hours"
            label="Horario informado"
            defaultValue={venue.hours}
          />
          <TextField
            name="eta"
            label="Tiempo de preparación informado (minutos)"
            type="number"
            min={1}
            max={120}
            defaultValue={venue.eta_minutes}
          />
          <TextField
            name="capacity"
            label="Capacidad de pedidos activos"
            type="number"
            min={1}
            max={100}
            defaultValue={venue.capacity}
          />
          <label className="field">
            Estado
            <select name="state" defaultValue={venue.open_state}>
              <option value="open">Abierto</option>
              <option value="closed">Cerrado</option>
            </select>
          </label>
          <label className="checkbox">
            <input
              name="paused"
              type="checkbox"
              defaultChecked={venue.paused}
            />
            <span>Pausar nuevos pedidos</span>
          </label>
          <p className="muted">
            Políticas demo-v1: aceptación 2 minutos, retiro 20 minutos, sin
            penalidad por no recogida. Para cambiarlas se requiere versionar el
            contrato y las reglas del backend juntos.
          </p>
          <Button type="submit" loading={busy}>
            Guardar ajustes
          </Button>
        </form>
      )}
    </>
  );
}
