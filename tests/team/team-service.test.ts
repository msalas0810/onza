import { describe, it, expect } from "vitest";
import {
  temporaryPassword,
  teamCommandSchema,
} from "@/features/team/server/team-service";

describe("servicio de equipo", () => {
  it("la contraseña temporal tiene 12 caracteres legibles en tres grupos y no se repite", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const password = temporaryPassword();
      expect(password).toMatch(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/);
      seen.add(password);
    }
    expect(seen.size).toBe(200);
  });
  it("el alta normaliza el correo y solo acepta los dos permisos del local", () => {
    const ok = teamCommandSchema.parse({
      action: "create",
      venueId: "20000000-0000-4000-8000-000000000001",
      email: "  Pablo@Equipo.DEMO ",
      name: "Pablo Mora",
      role: "bartender",
    });
    expect(ok).toMatchObject({ email: "pablo@equipo.demo" });
    for (const role of ["onza", "owner", "dueño"])
      expect(() =>
        teamCommandSchema.parse({
          action: "role",
          venueId: "20000000-0000-4000-8000-000000000001",
          userId: "10000000-0000-4000-8000-000000000003",
          role,
        }),
      ).toThrow();
    expect(() =>
      teamCommandSchema.parse({ action: "create", venueId: "x", email: "a@b.c", name: "A", role: "admin" }),
    ).toThrow();
  });
});
