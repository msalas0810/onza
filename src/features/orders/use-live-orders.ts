"use client";
import { useEffect, useState, useCallback } from "react";
import { z } from "zod";
import { browserDb } from "@/lib/supabase/browser";
import { orderSchema, type Order } from "./types";
import { errorMessage } from "@/lib/errors";
export function useLiveOrders({
  venueId,
  orderId,
}: { venueId?: string; orderId?: string } = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("Conectando");
  const [revision, setRevision] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [access, setAccess] = useState<"ok" | "lost" | "password">("ok");
  // Diferencia entre el reloj del servidor y el del dispositivo: los plazos se cuentan con la hora del servidor.
  const [clockOffset, setClockOffset] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let closed = false;
    let channel:
      ReturnType<ReturnType<typeof browserDb>["channel"]> | undefined;
    let db: ReturnType<typeof browserDb> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let realtimeConnected = false;
    let fallbackAttempts = 0;
    let inFlight = false;
    let pendingRefetch = false;
    const refetch = async (): Promise<void> => {
      if (closed || document.visibilityState !== "visible") return;
      if (inFlight) {
        pendingRefetch = true;
        return;
      }
      if (!navigator.onLine) {
        setConnection("Sin conexión");
        return;
      }
      inFlight = true;
      try {
        const response = await fetch(
          `/api/orders${venueId ? `?venue=${venueId}` : orderId ? `?order=${orderId}` : ""}`,
          { cache: "no-store", signal: controller.signal },
        );
        const json: unknown = await response.json();
        if (response.status === 401) setSessionExpired(true);
        if (response.status === 403)
          setAccess(
            typeof json === "object" &&
              json &&
              "error" in json &&
              json.error === "PASSWORD_CHANGE_REQUIRED"
              ? "password"
              : "lost",
          );
        else if (response.ok) setAccess("ok");
        if (!response.ok)
          throw new Error(
            typeof json === "object" && json && "message" in json
              ? String(json.message)
              : "No pudimos consultar los pedidos.",
          );
        const parsed = z.array(orderSchema).parse(json);
        const serverNow = parsed.find((o) => o.server_now)?.server_now;
        if (serverNow) setClockOffset(Date.parse(serverNow) - Date.now());
        setOrders(parsed);
        setError("");
        if (realtimeConnected) setConnection("Conectado");
      } catch (e) {
        if (!closed)
          setError(
            e instanceof Error && e.name !== "TypeError"
              ? e.message
              : errorMessage(e),
          );
      } finally {
        inFlight = false;
        if (!closed) setLoading(false);
        if (pendingRefetch && !closed) {
          pendingRefetch = false;
          void refetch();
        }
      }
    };
    // Realtime is primary. At most four visible-page retries per disconnection;
    // foreground/online/manual refresh opens a fresh recovery opportunity.
    const fallback = () => {
      if (timer || realtimeConnected || closed || fallbackAttempts >= 4) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (document.visibilityState === "visible" && navigator.onLine) {
          fallbackAttempts++;
          void refetch().finally(fallback);
        }
      }, 15000);
    };
    const resume = () => {
      if (!navigator.onLine) setConnection("Sin conexión");
      else {
        setConnection("Sincronizando");
        void refetch();
        fallbackAttempts = 0;
        fallback();
      }
    };
    const setup = async () => {
      try {
        db = browserDb();
        const {
          data: { user },
          error,
        } = await db.auth.getUser();
        if (closed) return;
        if (error) throw error;
        if (!user) {
          setLoading(false);
          setConnection("Sin sesión");
          setSessionExpired(true);
          setError(errorMessage(new Error("SESSION_REQUIRED")));
          return;
        }
        await refetch();
        if (closed) return;
        const filter = venueId
          ? `venue_id=eq.${venueId}`
          : orderId
            ? `id=eq.${orderId}`
            : `customer_id=eq.${user.id}`;
        channel = db
          .channel(`orders:${venueId ?? orderId ?? user.id}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "orders", filter },
            () => void refetch(),
          )
          .subscribe((status) => {
            if (closed) return;
            setConnection(
              status === "SUBSCRIBED" ? "Conectado" : "Reconectando",
            );
            realtimeConnected = status === "SUBSCRIBED";
            if (realtimeConnected) {
              if (timer) clearTimeout(timer);
              timer = undefined;
              fallbackAttempts = 0;
              void refetch();
            } else fallback();
          });
      } catch (e) {
        if (!closed) {
          setError(errorMessage(e));
          setLoading(false);
          setConnection("No conectado");
        }
      }
    };
    void setup();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", resume);
    return () => {
      closed = true;
      controller.abort();
      if (timer) clearTimeout(timer);
      if (channel && db) void db.removeChannel(channel);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", resume);
    };
  }, [venueId, orderId, revision]);
  useEffect(() => {
    // Demo expiry is traffic-driven: wake once at the nearest unclaimed deadline,
    // even when Realtime is healthy and therefore has no polling fallback.
    const deadline = orders
      .filter(
        (o) =>
          ["queued", "ready", "pending_authorization"].includes(o.status) &&
          ["authorized", "authorizing"].includes(o.payment_state) &&
          !o.claim_id &&
          !o.claimed_elsewhere,
      )
      .map((o) => Date.parse(o.deadline) - clockOffset)
      .filter((time) => time > Date.now())
      .sort((a, b) => a - b)[0];
    if (!deadline) return;
    const timer = setTimeout(refresh, deadline - Date.now() + 1000);
    return () => clearTimeout(timer);
  }, [orders, refresh, clockOffset]);
  return {
    orders,
    order: orders.find((order) => order.id === orderId),
    loading,
    error,
    connection,
    refresh,
    sessionExpired,
    access,
    clockOffset,
  };
}
