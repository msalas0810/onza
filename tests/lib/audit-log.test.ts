import { afterEach, describe, expect, it, vi } from "vitest";
import { auditFields, logEvent, readJson, requestId } from "@/lib/audit-log";

afterEach(() => vi.restoreAllMocks());

describe("registro de auditoría", () => {
  it("de un comando solo toma la acción y el local: nunca códigos, tokens ni contraseñas", () => {
    const body = {
      action: "resolve",
      venueId: "20000000-0000-4000-8000-000000000001",
      code: "abcdef012345",
      token: "x".repeat(43),
      password: "secreto-largo-1",
    };
    expect(auditFields(body)).toEqual({ action: "resolve", venueId: "20000000-0000-4000-8000-000000000001" });
    expect(auditFields({ action: "no valida!", venueId: "no-uuid" })).toEqual({ action: undefined, venueId: undefined });
    expect(auditFields(null)).toEqual({});
  });
  it("logEvent escribe una línea JSON con lista cerrada de campos", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logEvent({
      event: "command", requestId: "iad1::abc", status: 403, code: "NOT_AUTHORIZED", action: "accept", ms: 12.7,
      ...({ token: "secreto", cookie: "sb-123" } as object),
    });
    const line = String(log.mock.calls[0][0]);
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({ event: "command", requestId: "iad1::abc", status: 403, code: "NOT_AUTHORIZED", action: "accept", ms: 13 });
    expect(line).not.toMatch(/secreto|sb-123|token|cookie/);
  });
  it("descarta valores con formato inválido en vez de registrarlos", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logEvent({ event: "command", requestId: "id", status: 409, code: "contiene espacios y minúsculas", action: "DROP TABLE", venueId: "x" });
    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.code).toBeUndefined();
    expect(parsed.action).toBeUndefined();
    expect(parsed.venueId).toBeUndefined();
  });
  it("requestId acepta el de Vercel o genera uno y rechaza basura", () => {
    expect(requestId(new Request("http://x", { headers: { "x-vercel-id": "iad1::k6d82-1" } }))).toBe("iad1::k6d82-1");
    expect(requestId(new Request("http://x", { headers: { "x-request-id": "con espacios y símbolos <b>" } }))).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestId(new Request("http://x"))).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("readJson aplica el límite al cuerpo real, aunque falte content-length", async () => {
    const big = new Request("http://x", { method: "POST", body: JSON.stringify({ a: "x".repeat(30000) }) });
    await expect(readJson(big, 20000)).rejects.toThrow("INVALID_INPUT");
    const ok = new Request("http://x", { method: "POST", body: JSON.stringify({ action: "get" }) });
    await expect(readJson(ok, 20000)).resolves.toEqual({ action: "get" });
  });
});
