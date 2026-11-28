/** Llamadas del navegador a las rutas de juego. Devuelven el mensaje en español del servidor cuando algo falla. */
export type ApiResult<T> = { ok: true; result: T } | { ok: false; code: string; message: string };

async function post<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; result?: T; error?: string; message?: string }
      | null;
    if (response.ok && data?.ok) return { ok: true, result: data.result as T };
    return {
      ok: false,
      code: data?.error ?? "UNKNOWN_ERROR",
      message: data?.message ?? "No pudimos completar la operación. Revisá tu conexión y volvé a intentar.",
    };
  } catch {
    return { ok: false, code: "CONNECTION_ERROR", message: "No pudimos conectar con el servicio. Revisá tu conexión." };
  }
}

export const gameApi = <T = unknown>(action: Record<string, unknown>) => post<T>("/api/game", action);
export const onzaApi = <T = unknown>(command: Record<string, unknown>) => post<T>("/api/onza", command);
export const loyaltyApi = <T = unknown>(action: Record<string, unknown>) => post<T>("/api/loyalty", action);
export const coinsApi = <T = unknown>(body: Record<string, unknown>) => post<T>("/api/game/coins", body);
