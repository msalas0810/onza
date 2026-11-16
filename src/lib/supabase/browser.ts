"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.generated";
import { supabaseConfig } from "./config";
let client: ReturnType<typeof createBrowserClient<Database>> | undefined;
export function browserDb() {
  if (!client) {
    const { url, key } = supabaseConfig();
    client = createBrowserClient<Database>(url, key);
  }
  return client;
}
