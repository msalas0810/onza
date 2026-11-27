import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/features/account/auth-errors";

describe("errores de acceso con correo", () => {
  it("dice qué pasó en vez de un fallo genérico", () => {
    expect(authErrorMessage({ code: "over_email_send_rate_limit", status: 429 })).toContain("límite de envío de correos");
    expect(authErrorMessage({ code: "user_already_exists", status: 422 })).toBe("Ese correo ya tiene cuenta. Ingresá con tu contraseña.");
    expect(authErrorMessage({ code: "email_address_invalid", status: 400 })).toContain("no es válido");
    expect(authErrorMessage({ code: "weak_password", status: 422 })).toContain("contraseña");
    expect(authErrorMessage({ code: "over_request_rate_limit", status: 429 })).toContain("Demasiados intentos");
  });
  it("no filtra el mensaje crudo del proveedor cuando no conoce el código", () => {
    expect(authErrorMessage({ code: "unexpected_failure", status: 500 })).toBe("No pudimos completar el registro. Intentá de nuevo.");
    expect(authErrorMessage(new Error("boom"))).toBe("No pudimos completar el registro. Intentá de nuevo.");
  });
});
