"use client";
import { useEffect } from "react";
import { setCartScope } from "../cart-store";
/** Fija la cuenta dueña del carrito local. El valor se asigna durante el render para que los hijos ya lean la clave correcta. */
export function CartScope({ userId }: { userId: string | null }) {
  setCartScope(userId);
  useEffect(() => {
    // Los borradores anteriores (sin cuenta) no se heredan: eran de un invitado.
    try {
      localStorage.removeItem("onza-cart-draft");
    } catch {
      /* Sin almacenamiento. */
    }
    window.dispatchEvent(new Event("onza-cart-change"));
  }, [userId]);
  return null;
}
