"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";

/** La sesión venció: no se cierra sola ni se pierde el carrito (vive en este dispositivo, por cuenta). */
export function SessionExpiredSheet({
  open,
  area = "cliente",
  next,
}: {
  open: boolean;
  area?: "cliente" | "equipo";
  next: string;
}) {
  const router = useRouter();
  const entry = area === "equipo" ? "/equipo/acceso" : "/acceso";
  return (
    <Sheet
      open={open}
      onOpenChange={() => undefined}
      dismissible={false}
      title="Tu sesión venció"
      description={
        area === "equipo"
          ? "Volvé a entrar para seguir operando."
          : "Volvé a entrar para continuar. Tu carrito se guarda para esta cuenta."
      }
      actions={
        <Button
          onClick={() =>
            router.push(`${entry}?next=${encodeURIComponent(next)}`)
          }
        >
          Volver a entrar
        </Button>
      }
    />
  );
}
