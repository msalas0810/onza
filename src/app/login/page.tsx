import { redirect } from "next/navigation";
// Histórico: el acceso del personal es /equipo/acceso.
export default function Page() {
  redirect("/equipo/acceso");
}
