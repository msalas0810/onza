"use client";
export class CommandError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
export async function sendCommand(input: Record<string, unknown>) {
  if (!navigator.onLine)
    throw new Error(
      "Sin conexión. No se ejecutó la acción. Volvé a consultar al reconectar.",
    );
  const response = await fetch("/api/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof result === "object" && result && "message" in result
        ? String(result.message)
        : "No pudimos completar la operación.";
    const code =
      typeof result === "object" && result && "error" in result
        ? String(result.error)
        : "UNKNOWN_ERROR";
    throw new CommandError(message, code);
  }
  return result;
}
