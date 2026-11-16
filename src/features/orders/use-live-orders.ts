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
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let closed = false;
    let channel:
      ReturnType<ReturnType<typeof browserDb>["channel"]> | undefined;
    let db: ReturnType<typeof browserDb> | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let inFlight = false;
    const refetch = async () => {
      if (closed || inFlight || document.visibilityState !== "visible") return;
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
        if (!response.ok)
          throw new Error(
            typeof json === "object" && json && "message" in json
              ? String(json.message)
              : "No pudimos consultar los pedidos.",
          );
        setOrders(z.array(orderSchema).parse(json));
        setError("");
        setConnection("Sincronizado");
      } catch (e) {
        if (!closed) setError(e instanceof Error ? e.message : errorMessage(e));
      } finally {
        inFlight = false;
        if (!closed) setLoading(false);
      }
    };
    const resume = () => {
      if (!navigator.onLine) setConnection("Sin conexión");
      else {
        setConnection("Sincronizando");
        void refetch();
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
          setConnection("Sin sesión invitada");
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
            if (status === "SUBSCRIBED") void refetch();
          });
        timer = setInterval(() => void refetch(), 15000);
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
      if (timer) clearInterval(timer);
      if (channel && db) void db.removeChannel(channel);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", resume);
    };
  }, [venueId, orderId, revision]);
  return {
    orders,
    order: orders.find((order) => order.id === orderId),
    loading,
    error,
    connection,
    refresh,
  };
}
