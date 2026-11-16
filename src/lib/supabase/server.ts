import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.generated";
import { supabaseConfig } from "./config";
export async function serverDb() {
  const { url, key } = supabaseConfig();
  const store = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Server component: refresh is handled by proxy. */
        }
      },
    },
  });
}
