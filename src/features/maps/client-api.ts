"use client";
import { CommandError } from "@/features/orders/client-api";
import type { FailureDetail } from "@/lib/errors";

/** Envía un comando de mapas o de ubicación de pedido. Lanza CommandError con el código que devuelve el servidor. */
export async function mapsCommand(
  input: Record<string, unknown>,
): Promise<unknown> {
  if (!navigator.onLine)
    throw new CommandError(
      "Sin conexión. No se hizo ningún cambio. Volvé a intentar al reconectar.",
      "OFFLINE",
    );
  return request("/api/maps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/** Lectura de mapas (`venue`, `scope=admin`, `map`+`detail`, `map`+`version`). */
export async function mapsGet(
  params: Record<string, string>,
): Promise<unknown> {
  return request(`/api/maps?${new URLSearchParams(params)}`, {
    cache: "no-store",
  });
}

async function request(url: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new CommandError(
      "No pudimos conectar con el servicio. Revisá tu conexión e intentá otra vez.",
      "CONNECTION_ERROR",
    );
  }
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const obj =
      typeof result === "object" && result
        ? (result as Record<string, unknown>)
        : {};
    throw new CommandError(
      typeof obj.message === "string"
        ? obj.message
        : "No pudimos completar la operación.",
      typeof obj.error === "string" ? obj.error : "UNKNOWN_ERROR",
      obj.detail as FailureDetail | undefined,
    );
  }
  return result;
}
