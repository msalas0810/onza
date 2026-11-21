"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { browserDb } from "@/lib/supabase/browser";
import { isConfigured } from "@/lib/supabase/config";

/**
 * Mantiene coherente la pantalla con la cuenta real del navegador. Las cookies de sesión son compartidas entre pestañas:
 * si otra pestaña cierra sesión o entra con otra cuenta, esta pestaña seguiría mostrando la cuenta anterior hasta su
 * próxima petición. `userId` es la cuenta con la que el servidor renderizó esta pantalla; si el cliente de Auth informa
 * otra (o ninguna), se pide al servidor que vuelva a decidir (el proxy redirige al acceso o a la elección de cuenta).
 * SIGNED_IN también se emite al volver a enfocar la pestaña, por eso solo se compara la identidad.
 */
export function AuthSync({ userId }: { userId: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!isConfigured()) return;
    const { data } = browserDb().auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      if (event === "USER_UPDATED") return;
      if ((session?.user.id ?? null) !== userId) router.refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [userId, router]);
  return null;
}
