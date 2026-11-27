"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  MapPin,
  Receipt,
  Store,
  ToggleLeft,
  Users,
  Wine,
  Gift,
} from "lucide-react";
import type { Product, Venue } from "@/features/catalog/server/queries";
import type { RangeSummary } from "@/features/analytics/types";
import type { Period } from "@/features/analytics/period";
import { AdminSummary } from "@/features/analytics/components/admin-summary";
import {
  Button,
  EmptyState,
  Notice,
  Price,
  SegmentedControl,
  StatusBadge,
  TextField,
  Toggle,
  type ChecklistItem,
} from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { ProductEditor } from "./product-editor";
import { VenueProfile } from "./venue-profile";
import { ProductImage } from "@/features/catalog/components/product-image";
import { productImageSrc } from "@/features/catalog/product-image-src";
import {
  sendCommand,
  isSessionError,
  isPasswordChangeError,
} from "@/features/orders/client-api";
import { useLiveOrders } from "@/features/orders/use-live-orders";
import { statusLabels, paymentLabels } from "@/features/orders/types";
import { SessionExpiredSheet } from "@/features/orders/components/session-expired-sheet";
import { TeamPanel } from "@/features/team/components/team-panel";
import { LoyaltyAdmin } from "@/features/loyalty/components/loyalty-admin";
import { DeliveryAdmin } from "@/features/delivery/components/delivery-admin";
import { NowPanel } from "./now-panel";
import { spotText, type Spot, type VenueMap } from "@/features/delivery/types";
import { adminTabGroups, adminTabLabels, type AdminTab } from "../admin-tabs";

const productSchema = z.object({
  id: z.string(),
  available: z.boolean(),
  archived: z.boolean(),
  version: z.number(),
});

const tabIcons = {
  ahora: Activity,
  resumen: BarChart3,
  pedidos: Receipt,
  menu: Wine,
  disponibilidad: ToggleLeft,
  entrega: MapPin,
  negocio: Store,
  equipo: Users,
  fidelizacion: Gift,
} as const;

type Support = {
  title: string;
  description: string;
  min: number;
  confirm: string;
  tone: "primary" | "danger";
  build: (reason: string) => Record<string, unknown>;
};
type Availability = "open" | "paused" | "closed";
const availabilityOptions = [
  { value: "open", label: "Abierto" },
  { value: "paused", label: "Pausado" },
  { value: "closed", label: "Cerrado" },
] as const;
const availabilityCopy: Record<Availability, string> = {
  open: "Los clientes ven el menú y pueden pedir.",
  paused: "Visible, pero nadie puede pedir. Sirve para picos de trabajo.",
  closed: "Fuera de horario. El menú no se muestra a los clientes.",
};

export function AdminPanel({
  venue,
  products,
  categories,
  summary,
  spots,
  map,
  period,
  tab,
  editId,
}: {
  venue: Venue;
  products: Product[];
  categories: { id: string; label: string }[];
  summary: RangeSummary | null;
  spots: Spot[];
  map: VenueMap | null;
  period: Period;
  tab: AdminTab;
  editId?: string;
}) {
  const [filter, setFilter] = useState("");
  // Estado confirmado por el servidor para cada producto tocado en esta pantalla (antes de que llegue el refresh).
  const [confirmed, setConfirmed] = useState<Record<string, Product>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [menuView, setMenuView] = useState<"active" | "archived">("active");
  const catalog = products.map((p) => {
    const known = confirmed[p.id];
    // El refresh del servidor manda cuando trae una versión igual o más nueva que la confirmada localmente.
    return known && known.version >= p.version ? { ...p, ...known } : p;
  });
  const [edit, setEdit] = useState<Product | null | undefined>(() =>
    editId ? products.find((p) => p.id === editId) : undefined,
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [support, setSupport] = useState<{
    spec: Support;
    reason: string;
    problem: string;
  } | null>(null);
  const [archive, setArchive] = useState<Product | null>(null);
  const [orderFilter, setOrderFilter] = useState<"active" | "all">("active");
  const [capacity, setCapacity] = useState(String(venue.capacity));
  const [autoAccept, setAutoAccept] = useState(venue.auto_accept ?? false);
  const [maxPreparing, setMaxPreparing] = useState(
    String(venue.auto_accept_max_preparing ?? 5),
  );
  const { orders, refresh } = useLiveOrders({ venueId: venue.id });
  const router = useRouter();
  const revision = orders
    .map((order) => `${order.id}:${order.version}`)
    .join("|");
  const state: Availability =
    venue.open_state !== "open" ? "closed" : venue.paused ? "paused" : "open";

  // La pestaña activa siempre queda a la vista en la fila deslizable de móvil.
  const tabsRow = useRef<HTMLElement>(null);
  useEffect(() => {
    tabsRow.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [tab]);
  const run = async (input: Record<string, unknown>, message = "") => {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      await sendCommand(input);
      if (message) setSaved(message);
      refresh();
      router.refresh();
      return true;
    } catch (e) {
      if (isSessionError(e)) setExpired(true);
      else if (isPasswordChangeError(e)) router.push("/equipo/clave");
      else setError(e instanceof Error ? e.message : "No se guardó el cambio.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  /** Agotar/reactivar o archivar/restaurar. Optimista con reversión: si el servidor falla, vuelve al valor anterior. */
  const productCommand = async (
    product: Product,
    input:
      | { action: "product_availability"; available: boolean }
      | { action: "product_archive"; archived: boolean },
    message = "",
  ) => {
    setPending((current) => ({
      ...current,
      [product.id]:
        input.action === "product_availability" ? input.available : true,
    }));
    setRowErrors(({ [product.id]: _old, ...rest }) => (void _old, rest));
    setSaved("");
    try {
      const result = productSchema.parse(
        await sendCommand({
          ...input,
          venueId: venue.id,
          productId: product.id,
        }),
      );
      setConfirmed((current) => ({
        ...current,
        [product.id]: { ...product, ...result },
      }));
      if (message) setSaved(message);
      router.refresh();
    } catch (e) {
      if (isSessionError(e)) setExpired(true);
      else if (isPasswordChangeError(e)) router.push("/equipo/clave");
      else
        setRowErrors((current) => ({
          ...current,
          [product.id]:
            e instanceof Error
              ? `${e.message} Se mantiene el estado anterior.`
              : "No se guardó el cambio. Se mantiene el estado anterior.",
        }));
    } finally {
      setPending(({ [product.id]: _done, ...rest }) => (void _done, rest));
    }
  };
  const shownAvailable = (p: Product) =>
    p.id in pending && !p.archived ? pending[p.id] : p.available;
  const ask = (spec: Support) => setSupport({ spec, reason: "", problem: "" });
  const link = (id: AdminTab) => {
    const Icon = tabIcons[id];
    return (
      <Link
        key={id}
        href={`/admin/${venue.id}?tab=${id}`}
        aria-current={tab === id ? "page" : undefined}
      >
        <Icon size={16} aria-hidden="true" className="side-icon" />
        {adminTabLabels[id]}
      </Link>
    );
  };
  const sideNav = adminTabGroups.map((group) => (
    <div className="side-group" key={group.label}>
      <p className="side-heading">{group.label}</p>
      {group.tabs.map(link)}
    </div>
  ));
  const tabsNav = adminTabGroups.flatMap((group) => group.tabs.map(link));
  const activeCount = orders.filter((o) =>
    ["pending_authorization", "queued", "preparing", "ready"].includes(o.status),
  ).length;
  /** Incidencia financiera: cobro sin entrega o resultado sin confirmar. Distinta del estado operativo. */
  const financialIssue = (o: (typeof orders)[number]) =>
    (o.payment_state === "captured" && o.status !== "delivered" && o.status !== "canceled") ||
    o.payment_state === "unknown";
  const shownOrders = orders.filter((o) =>
    orderFilter === "all"
      ? true
      : ["pending_authorization", "queued", "preparing", "ready"].includes(
          o.status,
        ),
  );
  const archivedProducts = catalog.filter((p) => p.archived);
  const grouped = categories
    .map((c) => ({
      category: c,
      list: catalog.filter(
        (p) =>
          p.category_id === c.id &&
          p.archived === (menuView === "archived") &&
          p.name.toLowerCase().includes(filter.toLowerCase()),
      ),
    }))
    .filter((g) => g.list.length);
  const soldOut = catalog.filter((p) => !p.archived && !shownAvailable(p));
  const available = catalog.filter((p) => !p.archived && shownAvailable(p)).length;
  const tabHref = (id: AdminTab) => `/admin/${venue.id}?tab=${id}`;
  // «Antes de abrir»: lo que un gerente revisa antes de recibir pedidos, con el atajo a la sección que lo resuelve.
  const openChecklist: ChecklistItem[] = [
    {
      done: available > 0,
      text: `${available} ${available === 1 ? "producto disponible" : "productos disponibles"} en el menú`,
      href: tabHref("menu"),
      fix: "Revisar el menú",
    },
    {
      done: soldOut.length === 0,
      text: soldOut.length ? `${soldOut.length} agotados (se ven como agotados)` : "Sin productos agotados",
      href: "#agotados",
      fix: "Ver agotados",
    },
    {
      done: !!venue.hours?.trim(),
      text: venue.hours?.trim() ? `Horario: ${venue.hours}` : "Falta el horario",
      href: tabHref("negocio"),
      fix: "Cargar horario",
    },
    ...(venue.delivery_mode !== "bar"
      ? [
          {
            done: !!map || spots.some((spot) => spot.enabled),
            text: "Entrega en el lugar con mapa o lugares habilitados",
            href: tabHref("entrega"),
            fix: "Configurar entrega",
          },
        ]
      : []),
    { done: true, text: `Capacidad: ${venue.capacity} pedidos activos a la vez`, href: tabHref("disponibilidad") },
  ];
  return (
    <>
      <div className="row between wrap" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="t-title">{venue.name}</h1>
          <p className="muted t-label">Administración</p>
        </div>
        <Link className="btn secondary sm" href={`/staff/${venue.id}`}>
          Abrir barra
        </Link>
      </div>
      <div className="admin">
        <nav className="side" aria-label="Administración">
          {sideNav}
        </nav>
        <div>
          <nav className="tabs admin-tabs" aria-label="Administración" ref={tabsRow}>
            {tabsNav}
          </nav>
          {error && (
            <div style={{ marginBottom: 16 }}>
              <Notice tone="danger">{error}</Notice>
            </div>
          )}
          {saved && (
            <p role="status" className="saved" style={{ marginBottom: 16 }}>
              {saved}
            </p>
          )}
          {tab === "ahora" && (
            <div className="stack loose">
              <NowPanel
                venue={venue}
                orders={orders}
                soldOut={soldOut.length}
                capacity={venue.capacity}
                checklist={openChecklist}
                onResume={() =>
                  run(
                    { action: "venue_update", venueId: venue.id, openState: "open", paused: false },
                    "El local vuelve a recibir pedidos.",
                  )
                }
              />
              <div className="admin-now-grid">
              <section className="block-card" aria-labelledby="estado-title">
                <h2 id="estado-title">Estado del local</h2>
                <SegmentedControl<Availability>
                  block
                  label="Estado del local"
                  value={state}
                  options={availabilityOptions}
                  onChange={(next) =>
                    void run(
                      {
                        action: "venue_update",
                        venueId: venue.id,
                        openState: next === "closed" ? "closed" : "open",
                        paused: next === "paused",
                      },
                      "Guardado",
                    )
                  }
                />
                <p className="muted">{availabilityCopy[state]}</p>
              </section>
              <section className="block-card" id="agotados" aria-labelledby="agotados-title">
                <h2 id="agotados-title">Agotados ahora</h2>
                {soldOut.length ? (
                  <div className="rows">
                    {soldOut.map((p) => (
                      <div className="r wrap" key={p.id}>
                        <Link
                          className="grow"
                          href={`/admin/${venue.id}?tab=menu&editar=${p.id}`}
                          style={{ fontWeight: 600 }}
                        >
                          {p.name}
                        </Link>
                        <Toggle
                          label={<span className="t-label">Disponible</span>}
                          checked={false}
                          disabled={p.id in pending}
                          onChange={() =>
                            void productCommand(
                              p,
                              { action: "product_availability", available: true },
                              `${p.name} vuelve a estar disponible.`,
                            )
                          }
                        />
                        {rowErrors[p.id] && (
                          <p className="inline-error" role="alert">
                            {rowErrors[p.id]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Todo disponible.</p>
                )}
              </section>
              </div>
            </div>
          )}
          {tab === "resumen" && (
            <AdminSummary
              venueId={venue.id}
              initial={summary}
              initialPeriod={period}
              revision={revision}
            />
          )}
          {tab === "pedidos" && (
            <section className="stack">
              <div className="row between wrap">
                <h2>Pedidos e incidencias</h2>
                <SegmentedControl<"active" | "all">
                  label="Filtro de pedidos"
                  value={orderFilter}
                  options={[
                    { value: "active", label: `Activos (${activeCount})` },
                    { value: "all", label: "Todos" },
                  ]}
                  onChange={setOrderFilter}
                />
              </div>
              {!shownOrders.length && (
                <EmptyState
                  icon={Receipt}
                  title={orderFilter === "active" ? "Sin pedidos activos" : "Sin pedidos"}
                />
              )}
              {shownOrders.map((o) => (
                <article className="panel stack tight" key={o.id}>
                  <div className="row between wrap">
                    <strong className="num">#{o.public_code}</strong>
                    <StatusBadge
                      tone={
                        o.status === "delivered"
                          ? "success"
                          : ["canceled", "expired", "uncollected"].includes(
                                o.status,
                              )
                            ? "danger"
                            : o.status === "ready"
                              ? "brand"
                              : "neutral"
                      }
                    >
                      {statusLabels[o.status]}
                    </StatusBadge>
                  </div>
                  <p className="muted t-label">
                    {paymentLabels[o.payment_state]} (simulado) ·{" "}
                    <Price amount={o.total_minor} />
                  </p>
                  {o.fulfillment === "location" && (
                    <p className="where-line">
                      <MapPin size={16} aria-hidden="true" />
                      {o.status === "delivered"
                        ? `Entregado en ${spotText(o)}`
                        : `Entrega en ${spotText(o)}`}
                      {o.status === "delivered" && o.delivered_at && (
                        <span className="muted">
                          {" "}
                          · {new Intl.DateTimeFormat("es-CR", { timeZone: "America/Costa_Rica", hour: "2-digit", minute: "2-digit" }).format(new Date(o.delivered_at))}
                          {o.delivered_by_name ? ` · ${o.delivered_by_name}` : ""}
                        </span>
                      )}
                    </p>
                  )}
                  {financialIssue(o) && (
                    <StatusBadge tone="warning">Incidencia de cobro</StatusBadge>
                  )}
                  {o.status === "pending_authorization" &&
                    o.payment_state === "unknown" && (
                      <>
                        <Notice tone="warning">
                          Reserva sin referencia confirmada. No se repetirá la
                          autorización.
                        </Notice>
                        <div className="row wrap">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              ask({
                                title: "Conciliar reserva aprobada",
                                description:
                                  "Solo DEMO: simula evidencia del proveedor de que la reserva está confirmada, sin crear otra autorización.",
                                min: 5,
                                confirm: "Confirmar reserva",
                                tone: "primary",
                                build: (reason) => ({
                                  action: "reconcile_authorization",
                                  orderId: o.id,
                                  outcome: "authorized",
                                  providerResultConfirmed: true,
                                  reason,
                                }),
                              })
                            }
                          >
                            Reserva aprobada
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() =>
                              ask({
                                title: "Conciliar reserva anulada",
                                description:
                                  "Solo DEMO: simula evidencia de que no hay reserva ni cobro vigente.",
                                min: 5,
                                confirm: "Anular reserva",
                                tone: "danger",
                                build: (reason) => ({
                                  action: "reconcile_authorization",
                                  orderId: o.id,
                                  outcome: "voided",
                                  providerResultConfirmed: true,
                                  reason,
                                }),
                              })
                            }
                          >
                            Reserva anulada
                          </Button>
                        </div>
                      </>
                    )}
                  <div className="row wrap">
                    {o.status === "ready" && o.claimed_elsewhere && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          ask({
                            title: "Transferir el retiro a mi sesión",
                            description:
                              "Verificá físicamente que el pedido NO se entregó. Indicá el motivo.",
                            min: 5,
                            confirm: "Ya verifiqué: transferir",
                            tone: "primary",
                            build: (reason) => ({
                              action: "transfer",
                              orderId: o.id,
                              physicalCheck: "not_delivered",
                              reason,
                            }),
                          })
                        }
                      >
                        Transferir retiro
                      </Button>
                    )}
                    {o.payment_state === "captured" && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() =>
                          ask({
                            title: "Devolver el monto simulado",
                            description:
                              "Devolución ficticia completa. Indicá el motivo.",
                            min: 5,
                            confirm: "Devolver",
                            tone: "danger",
                            build: (reason) => ({
                              action: "refund",
                              orderId: o.id,
                              reason,
                            }),
                          })
                        }
                      >
                        Devolver monto
                      </Button>
                    )}
                    {["queued", "preparing", "ready"].includes(o.status) &&
                      o.payment_state === "authorized" &&
                      ((!o.claim_id && !o.claimed_elsewhere) ||
                        o.capture_state === "declined") && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() =>
                            ask({
                              title: `Cancelar #${o.public_code}`,
                              description:
                                "Cancelación por soporte. El cliente ve el motivo.",
                              min: 3,
                              confirm: "Cancelar pedido",
                              tone: "danger",
                              build: (reason) => ({
                                action: "cancel",
                                orderId: o.id,
                                expectedVersion: o.version,
                                idempotencyKey: crypto.randomUUID(),
                                reason,
                              }),
                            })
                          }
                        >
                          Cancelar por soporte
                        </Button>
                      )}
                  </div>
                </article>
              ))}
            </section>
          )}
          {tab === "menu" && (
            <section className="stack">
              <div className="row between wrap">
                <h2>Menú</h2>
                <Button size="sm" onClick={() => setEdit(null)}>
                  Nuevo producto
                </Button>
              </div>
              {edit !== undefined ? (
                <div className="stack">
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => setEdit(undefined)}
                    style={{ alignSelf: "flex-start" }}
                  >
                    ← Cerrar edición
                  </Button>
                  <ProductEditor
                    key={edit?.id ?? "new"}
                    venueId={venue.id}
                    product={edit}
                    categories={categories}
                    onSaved={(warning) => {
                      setEdit(undefined);
                      setError(warning ?? "");
                      router.refresh();
                    }}
                  />
                </div>
              ) : (
                <>
                  <div className="search">
                    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                    <input
                      type="search"
                      aria-label="Buscar producto"
                      placeholder="Buscar producto"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  </div>
                  <SegmentedControl<"active" | "archived">
                    label="Productos"
                    value={menuView}
                    options={[
                      { value: "active", label: "En el menú" },
                      {
                        value: "archived",
                        label: `Archivados (${archivedProducts.length})`,
                      },
                    ]}
                    onChange={setMenuView}
                  />
                  {grouped.map(({ category, list }) => (
                    <div key={category.id}>
                      <h3
                        className="eyebrow section-label"
                        style={{ marginTop: 16 }}
                      >
                        {category.label}
                      </h3>
                      <div className="rows product-rows">
                        {list.map((p) => {
                          const available = shownAvailable(p);
                          return (
                            <div className="product-row" key={p.id}>
                              <span className="thumb">
                                <ProductImage
                                  name={p.name}
                                  src={productImageSrc(p)}
                                />
                              </span>
                              <div className="product-row-main">
                                <div className="product-row-name">{p.name}</div>
                                <div className="sub">
                                  <Price amount={p.price_minor} />
                                  {p.archived ? (
                                    <StatusBadge>Archivado</StatusBadge>
                                  ) : (
                                    !available && (
                                      <StatusBadge tone="warning">
                                        Agotado
                                      </StatusBadge>
                                    )
                                  )}
                                </div>
                                {rowErrors[p.id] && (
                                  <p className="inline-error" role="alert">
                                    {rowErrors[p.id]}
                                  </p>
                                )}
                              </div>
                              <div className="product-row-actions">
                                {p.archived ? (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    loading={p.id in pending}
                                    onClick={() =>
                                      void productCommand(
                                        p,
                                        {
                                          action: "product_archive",
                                          archived: false,
                                        },
                                        `${p.name} volvió al menú como agotado. Habilitalo cuando quieras venderlo.`,
                                      )
                                    }
                                  >
                                    Restaurar
                                  </Button>
                                ) : (
                                  <>
                                    <Toggle
                                      label={
                                        <span className="t-label">
                                          Disponible
                                          <span className="sr-only">
                                            {" "}
                                            para pedir: {p.name}
                                          </span>
                                        </span>
                                      }
                                      checked={available}
                                      disabled={p.id in pending}
                                      onChange={(next) =>
                                        void productCommand(p, {
                                          action: "product_availability",
                                          available: next,
                                        })
                                      }
                                    />
                                    <Button
                                      variant="quiet"
                                      size="sm"
                                      onClick={() => setEdit(p)}
                                    >
                                      Editar
                                    </Button>
                                    <Button
                                      variant="quiet"
                                      size="sm"
                                      onClick={() => setArchive(p)}
                                    >
                                      Archivar
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {!grouped.length && (
                    <EmptyState
                      icon={Wine}
                      title={
                        filter
                          ? "Sin resultados"
                          : menuView === "archived"
                            ? "No hay productos archivados"
                            : "El menú está vacío"
                      }
                    />
                  )}
                </>
              )}
            </section>
          )}
          {tab === "disponibilidad" && (
            <div className="stack loose">
              <section className="block-card">
                <h2>Capacidad</h2>
                <form
                  className="stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(
                      {
                        action: "venue_update",
                        venueId: venue.id,
                        capacity: Number(capacity),
                      },
                      "Guardado",
                    );
                  }}
                >
                  <TextField
                    label="Pedidos activos al mismo tiempo"
                    type="number"
                    min={1}
                    max={100}
                    value={capacity}
                    hint="Al llegar al máximo, el checkout ofrece la lista de espera y no crea pedidos."
                    onChange={(e) => setCapacity(e.target.value)}
                    style={{ maxWidth: 160 }}
                  />
                  <div>
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      loading={busy}
                    >
                      Guardar
                    </Button>
                  </div>
                </form>
              </section>
              <section className="block-card">
                <h2>Aceptación automática</h2>
                <Toggle
                  label="Aceptar automáticamente los pedidos elegibles"
                  checked={autoAccept}
                  disabled={busy}
                  onChange={(enabled) =>
                    void run(
                      {
                        action: "venue_auto_accept",
                        venueId: venue.id,
                        enabled,
                        maxPreparing: Number(maxPreparing),
                      },
                      enabled ? "Aceptación automática activada" : "Volvió a aceptación manual",
                    ).then((ok) => ok && setAutoAccept(enabled))
                  }
                />
                <TextField
                  label="Máximo de pedidos en preparación"
                  type="number"
                  min={1}
                  max={50}
                  value={maxPreparing}
                  hint="Límite de trabajo de la barra, distinto de la capacidad de admisión. Si está lleno, los pedidos quedan para aceptar a mano."
                  onChange={(e) => setMaxPreparing(e.target.value)}
                  onBlur={() =>
                    autoAccept &&
                    void run(
                      {
                        action: "venue_auto_accept",
                        venueId: venue.id,
                        enabled: true,
                        maxPreparing: Number(maxPreparing),
                      },
                      "Guardado",
                    )
                  }
                  style={{ maxWidth: 160 }}
                />
                <p className="muted t-label">
                  Solo acepta si el local recibe pedidos, el pedido está vigente, la reserva está autorizada, hay stock y
                  lugar en preparación. Una pausa la detiene. El equipo puede volver a manual desde los Ajustes de la barra.
                </p>
              </section>
            </div>
          )}
          {tab === "entrega" && (
            <DeliveryAdmin
              venue={venue}
              spots={spots}
              map={map}
              availableProducts={catalog.filter((p) => !p.archived && p.available).length}
            />
          )}
          {tab === "negocio" && (
            <div className="stack loose">
              <div className="block-card">
                <VenueProfile venue={venue} />
              </div>
              <form
                className="block-card"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(
                    {
                      action: "venue_update",
                      venueId: venue.id,
                      pickupLabel: String(f.get("pickup")),
                      supportContact: String(f.get("contact")),
                      hours: String(f.get("hours")),
                      etaMinutes: Number(f.get("eta")),
                    },
                    "Guardado",
                  );
                }}
              >
                <h2>Retiro y atención</h2>
                <TextField
                  name="pickup"
                  label="Punto de retiro"
                  required
                  defaultValue={venue.pickup_label}
                />
                <TextField
                  name="eta"
                  label="Preparación estimada (minutos)"
                  type="number"
                  min={1}
                  max={120}
                  defaultValue={venue.eta_minutes}
                  style={{ maxWidth: 160 }}
                />
                <TextField
                  name="hours"
                  label="Horario informado"
                  defaultValue={venue.hours}
                  hint="Texto que ven los clientes."
                />
                <TextField
                  name="contact"
                  label="Contacto de soporte"
                  defaultValue={venue.support_contact}
                />
                <div>
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    loading={busy}
                  >
                    Guardar
                  </Button>
                </div>
              </form>
            </div>
          )}
          {tab === "equipo" && (
            <TeamPanel venueId={venue.id} venueName={venue.name} />
          )}
          {tab === "fidelizacion" && (
            <LoyaltyAdmin venueId={venue.id} categories={categories} />
          )}
        </div>
      </div>
      <Sheet
        open={!!support}
        onOpenChange={(open) => !open && setSupport(null)}
        title={support?.spec.title ?? ""}
        description={support?.spec.description}
        actions={
          <>
            <Button variant="secondary" onClick={() => setSupport(null)}>
              Volver
            </Button>
            <Button
              variant={support?.spec.tone === "danger" ? "danger" : "primary"}
              loading={busy}
              onClick={async () => {
                if (!support) return;
                const reason = support.reason.trim();
                if (reason.length < support.spec.min) {
                  setSupport({
                    ...support,
                    problem: `Escribí un motivo de al menos ${support.spec.min} caracteres.`,
                  });
                  return;
                }
                if (await run(support.spec.build(reason))) setSupport(null);
                else setSupport(null);
              }}
            >
              {support?.spec.confirm}
            </Button>
          </>
        }
      >
        <label className="field">
          <span>Motivo</span>
          <textarea
            value={support?.reason ?? ""}
            aria-invalid={!!support?.problem}
            onChange={(e) =>
              support &&
              setSupport({ ...support, reason: e.target.value, problem: "" })
            }
          />
          {support?.problem && (
            <span role="alert" className="field-error">
              {support.problem}
            </span>
          )}
        </label>
      </Sheet>
      <Sheet
        open={!!archive}
        onOpenChange={(open) => !open && setArchive(null)}
        title={archive ? `¿Archivar ${archive.name}?` : "Archivar"}
        description="Deja de verse en el menú del cliente. Los pedidos históricos conservan nombre y precio. Podés restaurarlo desde Archivados."
        actions={
          <>
            <Button variant="secondary" onClick={() => setArchive(null)}>
              Volver
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                if (!archive) return;
                const product = archive;
                setArchive(null);
                await productCommand(
                  product,
                  { action: "product_archive", archived: true },
                  `${product.name} quedó en Archivados.`,
                );
              }}
            >
              Archivar
            </Button>
          </>
        }
      />
      <SessionExpiredSheet
        open={expired}
        area="equipo"
        next={`/admin/${venue.id}?tab=${tab}`}
      />
    </>
  );
}
