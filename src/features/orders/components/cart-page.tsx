"use client";
import { useState } from "react";
import Link from "next/link";
import { RefreshCw, ShoppingBag } from "lucide-react";
import {
  useCart,
  writeCart,
  cartTotal,
  setProductQuantity,
} from "../cart-store";
import { useCartReview } from "../use-cart-review";
import {
  Button,
  Price,
  QuantityStepper,
  EmptyState,
  Notice,
  buttonClass,
} from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";

export function CartPage() {
  const cart = useCart();
  const { issues, venue, reviewing, failed, review } = useCartReview(cart);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  if (!cart?.items.length)
    return (
      <>
        <div className="page-head">
          <h1>Carrito</h1>
        </div>
        <EmptyState
          icon={ShoppingBag}
          title="Tu carrito está vacío"
          action={
            <Link className={buttonClass()} href="/">
              Explorar locales
            </Link>
          }
        >
          Elegí un local y armá tu ronda.
        </EmptyState>
      </>
    );
  const blocked = Object.keys(issues).length > 0 || venue !== "open";
  return (
    <>
      <div className="page-head">
        <h1 className="t-title">Carrito</h1>
        <Link
          className="t-label"
          href={`/v/${cart.venueSlug}`}
          style={{ fontWeight: 600 }}
        >
          {cart.venueName} · Retiro: {cart.pickupLabel}
        </Link>
      </div>
      <div className="stack">
        {venue !== "open" && (
          <Notice
            tone="warning"
            title={venue === "paused" ? "Pedidos pausados" : "Local cerrado"}
          >
            {venue === "paused"
              ? "Tu carrito se guarda. Vas a poder pedir cuando el local reanude."
              : "Tu carrito se guarda, pero no se puede pedir ahora."}
          </Notice>
        )}
        {failed && (
          <Notice tone="warning">
            No pudimos revisar precios y disponibilidad. Vamos a verificarlos al
            pedir.
          </Notice>
        )}
        <div className="lines">
          {cart.items.map((item) => {
            const issue = issues[item.productId];
            return (
              <article
                className={`prow cart ${issue ? "issue" : ""}`}
                key={item.productId}
              >
                <div className="grow">
                  <h2
                    className="name t-label"
                    style={{ fontSize: 16, fontWeight: 600 }}
                  >
                    {item.name}
                  </h2>
                  <div className="price">
                    <Price amount={item.priceMinor} /> c/u
                  </div>
                  {issue?.code === "OUT_OF_STOCK" && (
                    <span className="flag">Se agotó · quitalo para seguir</span>
                  )}
                  {issue?.code === "PRICE_CHANGED" && (
                    <>
                      <span className="flag">
                        Ahora cuesta <Price amount={issue.priceMinor} />
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        style={{ marginTop: 8 }}
                        onClick={() =>
                          writeCart({
                            ...cart,
                            items: cart.items.map((i) =>
                              i.productId === item.productId
                                ? {
                                    ...i,
                                    priceMinor: issue.priceMinor,
                                    version: issue.version,
                                  }
                                : i,
                            ),
                          })
                        }
                      >
                        Aceptar precio nuevo
                      </Button>
                    </>
                  )}
                </div>
                <QuantityStepper
                  value={item.quantity}
                  max={issue?.code === "OUT_OF_STOCK" ? item.quantity : 10}
                  label={`Cantidad de ${item.name}`}
                  onChange={(value) =>
                    setProductQuantity(item.productId, value)
                  }
                />
              </article>
            );
          })}
        </div>
        <div className="total-row">
          <span>Total</span>
          <Price amount={cartTotal(cart)} />
        </div>
        <div className="sticky-cta">
          <Link
            className={buttonClass({ size: "lg", block: true })}
            href="/checkout"
            aria-disabled={blocked || undefined}
            onClick={(e) => blocked && e.preventDefault()}
          >
            Continuar
          </Link>
          {blocked && (
            <p className="btn-note">
              {Object.keys(issues).length
                ? "Revisá los productos marcados."
                : "El local no recibe pedidos ahora."}
            </p>
          )}
          <div className="row between wrap">
            <Link
              className={buttonClass({ variant: "quiet", size: "sm" })}
              href={`/v/${cart.venueSlug}`}
            >
              Seguir eligiendo
            </Link>
            <Button
              variant="quiet"
              size="sm"
              loading={reviewing}
              onClick={() => void review()}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Revisar precios
            </Button>
            <Button
              variant="quiet"
              size="sm"
              onClick={() => setConfirmEmpty(true)}
            >
              Vaciar carrito
            </Button>
          </div>
        </div>
      </div>
      <Sheet
        open={confirmEmpty}
        onOpenChange={setConfirmEmpty}
        title="¿Vaciar el carrito?"
        description={`Se quitan todos los productos de ${cart.venueName}.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmEmpty(false)}>
              Volver
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                writeCart(null);
                setConfirmEmpty(false);
              }}
            >
              Vaciar
            </Button>
          </>
        }
      />
    </>
  );
}
