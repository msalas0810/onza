"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { browserDb } from "@/lib/supabase/browser";
import { errorMessage } from "@/lib/errors";
import { Button, TextField } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";

/** Nombre y @usuario de la cuenta. Las reglas viven en `update_profile_details`; acá solo se muestran sus rechazos. */
export function ProfileEditor({
  fullName,
  username,
  favoriteDrink,
  email,
}: {
  fullName: string;
  username: string;
  favoriteDrink: string | null;
  email: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(fullName);
  const [user, setUser] = useState(username);
  const [drink, setDrink] = useState(favoriteDrink ?? "");
  const [errors, setErrors] = useState<{
    name?: string;
    username?: string;
    form?: string;
  }>({});
  const [busy, setBusy] = useState(false);

  const reset = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setName(fullName);
      setUser(username);
      setDrink(favoriteDrink ?? "");
      setErrors({});
    }
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    const { error } = await browserDb().rpc("update_profile_details", {
      full_name: name,
      username: user.replace(/^@/, ""),
      favorite_drink: drink,
    });
    setBusy(false);
    if (error) {
      const message = errorMessage(new Error(error.message));
      if (/USERNAME/.test(error.message)) setErrors({ username: message });
      else if (/NAME/.test(error.message)) setErrors({ name: message });
      else setErrors({ form: message });
      return;
    }
    setOpen(false);
    router.refresh();
  }
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil size={16} aria-hidden="true" />
        Editar perfil
      </Button>
      <Sheet
        open={open}
        onOpenChange={reset}
        title="Editar perfil"
        description="Así figurás en tu cuenta. El local no ve tu perfil."
      >
        <form className="stack" onSubmit={submit} noValidate>
          <TextField
            label="Nombre"
            autoComplete="name"
            value={name}
            error={errors.name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="Usuario"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={user}
            error={errors.username}
            hint="De 3 a 20 letras, números, punto o guion bajo."
            onChange={(e) => setUser(e.target.value)}
          />
          <TextField
            label="Tu trago favorito (opcional)"
            maxLength={60}
            value={drink}
            hint="Podés dejarlo vacío. Solo vos lo ves."
            onChange={(e) => setDrink(e.target.value)}
          />
          <TextField
            label="Correo"
            value={email ?? "—"}
            readOnly
            hint="Es tu acceso. Para cambiarlo, escribinos."
          />
          {errors.form && (
            <p className="field-error" role="alert">
              {errors.form}
            </p>
          )}
          <Button type="submit" loading={busy}>
            Guardar
          </Button>
        </form>
      </Sheet>
    </>
  );
}
