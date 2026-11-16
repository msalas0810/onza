import Link from "next/link";
import { ThemeControl } from "@/components/ui/theme-control";
export default function SettingsPage() {
  return (
    <div className="page">
      <h1>Ajustes</h1>
      <section className="stack">
        <h2>Apariencia</h2>
        <p className="muted">
          Elegí un tema o seguí la preferencia del dispositivo.
        </p>
        <ThemeControl />
      </section>
      <section className="stack">
        <h2>Personal del local</h2>
        <Link className="link-button" href="/login">
          Ingresar al espacio de trabajo →
        </Link>
      </section>
      <Link className="link-button" href="/policies">
        Términos y privacidad
      </Link>
    </div>
  );
}
