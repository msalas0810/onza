import { redirect } from "next/navigation";
// Histórico: los ajustes del cliente viven en /cuenta. El equipo no se gestiona desde aquí.
export default function SettingsPage() {
  redirect("/cuenta");
}
