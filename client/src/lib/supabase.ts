import { createClient } from "@supabase/supabase-js";

function getEnv(key: string): string {
  // Try Vite first (this is the correct source for client-side)
  const viteVal =
    (typeof import.meta !== "undefined" &&
      (import.meta as any).env &&
      (import.meta as any).env[key]) ||
    "";

  // Try Node second (only relevant for true Node runtime)
  const nodeVal =
    (typeof process !== "undefined" &&
      (process as any).env &&
      (process as any).env[key]) ||
    "";

  return viteVal || nodeVal || "";
}

const supabaseUrl = getEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY");

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase env vars missing. Need VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY available to the client at build time."
  );
  // Hard fail so you don't get a vague runtime crash later
  throw new Error("Supabase env vars missing");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
