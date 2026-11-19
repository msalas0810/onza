"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserDb } from "@/lib/supabase/browser";
import { Button, TextField } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
const COUNTRIES = [
  ["+506", "Costa Rica +506"],
  ["+507", "Panamá +507"],
  ["+505", "Nicaragua +505"],
  ["+504", "Honduras +504"],
  ["+503", "El Salvador +503"],
  ["+502", "Guatemala +502"],
  ["+52", "México +52"],
  ["+57", "Colombia +57"],
  ["+34", "España +34"],
  ["+1", "EE. UU. / Canadá +1"],
] as const;
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
export function OnboardingForm({
  next,
  defaultName,
}: {
  next: string;
  defaultName: string;
}) {
  const router = useRouter();
  const year = new Date().getFullYear();
  const [f, setF] = useState({
    fullName: defaultName,
    username: "",
    phoneCountry: "+506",
    phone: "",
    day: "",
    month: "",
    year: "",
    accepted: false,
    news: false,
    offers: false,
    drink: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) =>
    setF((s) => ({ ...s, [k]: v }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const e: Record<string, string> = {};
    if (f.fullName.trim().length < 2) e.fullName = "Ingresá tu nombre.";
    if (!/^[a-z0-9_.]{3,20}$/i.test(f.username))
      e.username = "Usá de 3 a 20 letras, números, punto o guion bajo.";
    if (f.phone.replace(/\D/g, "").length < 6)
      e.phone = "Ingresá un teléfono válido.";
    if (!f.day || !f.month || !f.year)
      e.birth = "Ingresá tu fecha de nacimiento.";
    if (!f.accepted) e.accepted = "Necesitás aceptar para continuar.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const birthDate = `${f.year}-${f.month.padStart(2, "0")}-${f.day.padStart(2, "0")}`;
    try {
      const { error } = await browserDb().rpc("complete_onboarding", {
        input: {
          fullName: f.fullName,
          username: f.username,
          phoneCountry: f.phoneCountry,
          phone: f.phone,
          birthDate,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
          accepted: "true",
          news: String(f.news),
          offers: String(f.offers),
        },
      });
      if (error) throw new Error(error.message);
      // Opcional y salteable: si falla no frena el alta; se puede completar después desde Cuenta.
      if (f.drink.trim())
        await browserDb()
          .rpc("update_profile_details", {
            full_name: f.fullName,
            username: f.username,
            favorite_drink: f.drink,
          })
          .then(
            () => undefined,
            () => undefined,
          );
      router.replace(next);
      router.refresh();
    } catch (failure) {
      const message = errorMessage(failure);
      const text = failure instanceof Error ? failure.message : "";
      if (/USERNAME/.test(text)) setErrors({ username: message });
      else if (/BIRTH|UNDERAGE/.test(text)) setErrors({ birth: message });
      else if (/PHONE/.test(text)) setErrors({ phone: message });
      else setErrors({ form: message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <TextField
        label="Nombre"
        autoComplete="name"
        value={f.fullName}
        error={errors.fullName}
        onChange={(e) => set("fullName", e.target.value)}
      />
      <TextField
        label="@usuario"
        autoCapitalize="none"
        autoComplete="username"
        value={f.username}
        error={errors.username}
        onChange={(e) => set("username", e.target.value)}
      />
      <div className="field">
        <span>Teléfono</span>
        <div className="phone-row">
          <select
            aria-label="Código de país"
            value={f.phoneCountry}
            onChange={(e) => set("phoneCountry", e.target.value)}
          >
            {COUNTRIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            aria-label="Número de teléfono"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={f.phone}
            aria-invalid={!!errors.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
        <span className="hint">No se verifica por SMS.</span>
        {errors.phone && (
          <span role="alert" className="error">
            {errors.phone}
          </span>
        )}
      </div>
      <div className="field" role="group" aria-label="Fecha de nacimiento">
        <span>Fecha de nacimiento</span>
        <div className="dob-row">
          <select
            aria-label="Día"
            value={f.day}
            onChange={(e) => set("day", e.target.value)}
          >
            <option value="">Día</option>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
          <select
            aria-label="Mes"
            value={f.month}
            onChange={(e) => set("month", e.target.value)}
          >
            <option value="">Mes</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            aria-label="Año"
            value={f.year}
            onChange={(e) => set("year", e.target.value)}
          >
            <option value="">Año</option>
            {Array.from({ length: 90 }, (_, i) => (
              <option key={year - i} value={year - i}>
                {year - i}
              </option>
            ))}
          </select>
        </div>
        <span className="hint">Onza es para mayores de 18 años.</span>
        {errors.birth && (
          <span role="alert" className="error">
            {errors.birth}
          </span>
        )}
      </div>
      <TextField
        label="Tu trago favorito (opcional)"
        maxLength={60}
        value={f.drink}
        hint="Podés saltearlo y completarlo después en Cuenta."
        onChange={(e) => set("drink", e.target.value)}
      />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={f.accepted}
          onChange={(e) => set("accepted", e.target.checked)}
        />
        <span>
          Acepto las{" "}
          <Link href="/policies">condiciones y la política de privacidad</Link>{" "}
          (borrador).
        </span>
      </label>
      {errors.accepted && (
        <span role="alert" className="error">
          {errors.accepted}
        </span>
      )}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={f.news}
          onChange={(e) => set("news", e.target.checked)}
        />
        <span>Quiero recibir novedades de Onza</span>
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={f.offers}
          onChange={(e) => set("offers", e.target.checked)}
        />
        <span>Quiero recibir ofertas de mis discotecas favoritas</span>
      </label>
      {errors.form && (
        <p className="notice error" role="alert">
          {errors.form}
        </p>
      )}
      <Button type="submit" loading={busy}>
        Continuar
      </Button>
    </form>
  );
}
