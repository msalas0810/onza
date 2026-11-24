"use client";
import { useCallback, useEffect, useState } from "react";
import { mapsGet } from "./client-api";
import {
  mapVersionSchema,
  publishedMapsSchema,
  type MapVersion,
  type PublishedMap,
} from "./types";

type Loaded<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "unavailable" }
  | { status: "error"; message: string };

/**
 * Mapas que el local ofrece ahora. Sin mapas, o si la base todavía no tiene la función (migración 025), el estado es
 * «unavailable» y la pantalla no muestra el selector: el retiro en barra sigue funcionando igual.
 */
export function useVenueMaps(venueId: string | undefined) {
  const [state, setState] = useState<Loaded<PublishedMap[]>>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!venueId) return;
    let closed = false;
    void (async () => {
      setState({ status: "loading" });
      try {
        const maps = publishedMapsSchema.parse(
          await mapsGet({ venue: venueId }),
        );
        if (!closed)
          setState(
            maps.length
              ? { status: "ready", data: maps }
              : { status: "unavailable" },
          );
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (closed) return;
        // Sin sesión, sin permiso o sin la función en la base: el selector simplemente no aparece.
        setState(
          code === "SESSION_REQUIRED" ||
            code === "NOT_AUTHORIZED" ||
            code === "UNKNOWN_ERROR"
            ? { status: "unavailable" }
            : {
                status: "error",
                message:
                  e instanceof Error
                    ? e.message
                    : "No pudimos cargar el plano.",
              },
        );
      }
    })();
    return () => {
      closed = true;
    };
  }, [venueId, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}

/** Una versión concreta de un mapa (la que usó un pedido). */
export function useMapVersion(
  mapId: string | undefined,
  version: number | undefined,
) {
  const [state, setState] = useState<Loaded<MapVersion>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!mapId || !version) return;
    let closed = false;
    void (async () => {
      setState({ status: "loading" });
      try {
        const data = mapVersionSchema.parse(
          await mapsGet({ map: mapId, version: String(version) }),
        );
        if (!closed) setState({ status: "ready", data });
      } catch (e) {
        if (!closed)
          setState({
            status: "error",
            message:
              e instanceof Error ? e.message : "No pudimos cargar el plano.",
          });
      }
    })();
    return () => {
      closed = true;
    };
  }, [mapId, version, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}

/**
 * Contexto de mesa por QR: el cliente escaneó el QR de una mesa del local y no necesita abrir el plano. Solo se guarda el id de
 * la mesa (al azar, sin datos personales); el plano lo resuelve el checkout y el servidor valida la mesa al guardar.
 */
const TABLE_TTL_MS = 6 * 60 * 60 * 1000;
const tableKey = (venueId: string) => `onza-table:${venueId}`;
const TABLE_ID = /^[A-Za-z0-9_-]{1,40}$/;
export function readTableContext(venueId: string): string | null {
  try {
    const raw = JSON.parse(
      localStorage.getItem(tableKey(venueId)) ?? "null",
    ) as { tableId?: unknown; at?: unknown } | null;
    if (
      !raw ||
      typeof raw.tableId !== "string" ||
      !TABLE_ID.test(raw.tableId) ||
      typeof raw.at !== "number"
    )
      return null;
    return Date.now() - raw.at > TABLE_TTL_MS ? null : raw.tableId;
  } catch {
    return null;
  }
}
export function writeTableContext(venueId: string, tableId: string | null) {
  try {
    if (tableId && TABLE_ID.test(tableId))
      localStorage.setItem(
        tableKey(venueId),
        JSON.stringify({ tableId, at: Date.now() }),
      );
    else localStorage.removeItem(tableKey(venueId));
  } catch {
    // Sin almacenamiento local el cliente elige su mesa en el plano: nada se rompe.
  }
}
