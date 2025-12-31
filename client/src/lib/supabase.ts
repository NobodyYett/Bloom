import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables are missing. Please check your .env file.");
  throw new Error("Missing Supabase configuration");
}

// Check if running on native platform (iOS/Android)
const isNative = Capacitor.isNativePlatform();

console.log("Supabase init - isNativePlatform:", isNative);
console.log("Supabase init - flowType:", isNative ? "implicit" : "pkce");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use implicit flow for native apps (iOS/Android) because:
    // - PKCE stores code_verifier in browser localStorage
    // - Native apps open OAuth in system browser (SFSafariViewController/Chrome Custom Tabs)
    // - When app reopens via deep link, it has different localStorage
    // - Code verifier is lost -> "flow_state_not_found" error
    // Implicit flow returns tokens directly in URL hash - no code exchange needed
    flowType: isNative ? "implicit" : "pkce",
    detectSessionInUrl: true,
    autoRefreshToken: true,
    persistSession: true,
  },
});