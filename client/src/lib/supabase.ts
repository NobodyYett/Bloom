// client/src/lib/supabase.ts (FINAL NODE-TOLERANT VERSION)

import { createClient } from "@supabase/supabase-js";

/**
 * Safely retrieves environment variables, checking both Node.js (process.env) 
 * and Vite (import.meta.env) environments.
 */
function getEnv(key: string): string {
    // Check for Node.js environment (used by the server/tsx)
    if (typeof process !== 'undefined' && process.env) {
        // Look for the key defined in .env.local
        return process.env[key] || '';
    }
    
    // Check for Vite/Browser environment
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        // Access the key provided by Vite
        return (import.meta.env as Record<string, string>)[key] || '';
    }

    return ''; 
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase client environment variables are missing! Check your .env.local file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);