import { expect, it } from "vitest";
import { errorCode, errorMessage } from "@/lib/errors";
it("distinguishes missing session, connection, invalid pickup and forbidden transition", () => {
  const missing = new Error();
  missing.name = "AuthSessionMissingError";
  expect(errorCode(missing)).toBe("SESSION_REQUIRED");
  expect(errorCode(new TypeError("Failed to fetch"))).toBe("CONNECTION_ERROR");
  expect(errorMessage(new Error("INVALID_PICKUP"))).toContain(
    "número de pedido no sirve",
  );
  expect(errorMessage(new Error("INVALID_TRANSITION"))).toContain(
    "estado actual",
  );
});
it("customer messages never expose configuration instructions", () => {
  for (const code of ["PICKUP_KEY_NOT_CONFIGURED", "SUPABASE_NOT_CONFIGURED"])
    expect(
      /Supabase|README|base64|env|PICKUP_TOKEN/.test(
        errorMessage(new Error(code)),
      ),
    ).toBe(false);
});
