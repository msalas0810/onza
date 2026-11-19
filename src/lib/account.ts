import "server-only";
import { serverDb } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
import type { Account } from "@/lib/access-policy";
export type CurrentAccount = {
  account: Account;
  email: string | null;
  profile: {
    full_name: string;
    username: string;
    phone_e164: string;
    news_opt_in: boolean;
    offers_opt_in: boolean;
    terms_version: string;
    terms_accepted_at: string;
    avatar_path?: string | null;
  } | null;
};
/** Account kind comes from the database (membership), never from the browser. */
export async function currentAccount(): Promise<CurrentAccount> {
  // Sin servicio configurado no hay cuenta: las pantallas de preferencias del dispositivo (apariencia) siguen disponibles.
  if (!isConfigured())
    return {
      account: { kind: "none", onboarded: false },
      email: null,
      profile: null,
    };
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return {
      account: { kind: "none", onboarded: false },
      email: null,
      profile: null,
    };
  const { data } = await db.rpc("current_account");
  const value = data as Partial<Account> | null;
  const account: Account = {
    kind: value?.kind ?? (user.is_anonymous ? "guest" : "customer"),
    onboarded: value?.onboarded === true,
  };
  const { data: profile } =
    account.kind === "customer"
      ? await db
          .from("profiles")
          .select(
            "full_name,username,phone_e164,news_opt_in,offers_opt_in,terms_version,terms_accepted_at,avatar_path",
          )
          .maybeSingle()
      : { data: null };
  // Una base sin la migración 014 no tiene avatar_path: se reintenta sin esa columna para no perder el perfil.
  if (account.kind === "customer" && !profile) {
    const fallback = await db
      .from("profiles")
      .select(
        "full_name,username,phone_e164,news_opt_in,offers_opt_in,terms_version,terms_accepted_at",
      )
      .maybeSingle();
    return { account, email: user.email ?? null, profile: fallback.data };
  }
  return { account, email: user.email ?? null, profile };
}
