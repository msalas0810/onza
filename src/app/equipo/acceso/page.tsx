import Link from "next/link";
import { StaffLogin } from "@/features/staff/components/login";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <div className="page narrow">
      <p className="eyebrow">Equipo del local</p>
      <h1>Acceso del equipo</h1>
      <StaffLogin />
      <p className="muted center" style={{ marginTop: 32 }}>
        ¿Querés pedir tragos? <Link href="/acceso">Acceso para clientes</Link>
      </p>
    </div>
  );
}
