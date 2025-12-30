// client/src/hooks/useAuth.tsx (FIXED - handles no session gracefully)

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ✅ API base for Capacitor/mobile builds.
// - Web: leave VITE_API_BASE_URL empty -> relative requests still work.
// - Mobile: set VITE_API_BASE_URL=https://your-domain.com (no trailing slash).
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Check current session on first load
    // Use getSession() instead of getUser() to avoid errors when no session exists
    async function initAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          // Only log actual errors, not "no session" which is expected on login page
          if (error.message !== "Auth session missing!") {
            console.error("Error loading session", error);
          }
        }
        
        setUser(session?.user ?? null);
      } catch (err) {
        // Silently handle - user just isn't logged in
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    // Listen for login/logout events
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        setLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/login";
  };

  const deleteAccount = async () => {
    try {
      if (!user) throw new Error("No user");

      // Get the current session token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      // Call the backend API to delete the account
      const response = await fetch(`${API_BASE}/api/account`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete account");
      }

      // Clear local state
      await supabase.auth.signOut();
      setUser(null);
      localStorage.clear();
      window.location.href = "/login";
    } catch (error) {
      console.error("Error deleting account:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}