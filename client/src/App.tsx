import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Timeline from "@/pages/timeline";
import Journal from "@/pages/journal";
import Login from "@/pages/login";
import Onboarding from "@/pages/onboarding";
import Appointments from "@/pages/appointments";
import Settings from "@/pages/settings";

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { usePregnancyState } from "@/hooks/usePregnancyState";
import { supabase } from "./lib/supabase";

// Auth callback handler - processes OAuth tokens from URL
function AuthCallback() {
  const [, navigate] = useLocation();
  
  useEffect(() => {
    async function handleAuthCallback() {
      // Get the full URL including hash fragment (where tokens live)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);
      
      // Check for tokens in hash (implicit flow) or query (PKCE flow)
      const accessToken = hashParams.get("access_token") || queryParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token");
      
      if (accessToken) {
        // Manually set the session if tokens are present
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        });
        
        if (error) {
          console.error("Error setting session:", error);
        }
      }
      
      // Redirect to home regardless - auth state listener will handle the rest
      navigate("/", { replace: true });
    }
    
    handleAuthCallback();
  }, [navigate]);
  
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Completing sign in...
    </div>
  );
}

// Simple auth gate that works with wouter
function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading: authLoading } = useAuth();
  const { isProfileLoading, isOnboardingComplete } = usePregnancyState();
  const [, navigate] = useLocation();

  // Ensure a pregnancy profile exists for every authenticated user.
  // IMPORTANT:
  // - Your pregnancy_profiles table does NOT have an `id` column (per console error).
  // - So we check/select `user_id` instead of `id`.
  // - We use an UPSERT to avoid race conditions and to "create if missing" without a separate check.
  useEffect(() => {
    if (!user || authLoading) return;

    let cancelled = false;

    async function ensureProfileExists() {
      // Quick existence check (select a column that actually exists)
      const { data: existing, error: selectError } = await supabase
        .from("pregnancy_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      // If lookup fails for real reasons (RLS/network/etc.), do NOT attempt insert/upsert.
      if (selectError) {
        console.error("Profile lookup failed:", selectError);
        return;
      }

      // Create if missing (upsert is safest; requires user_id unique or PK)
      if (!existing) {
        const { error: upsertError } = await supabase
          .from("pregnancy_profiles")
          .upsert({ user_id: user.id }, { onConflict: "user_id" });

        if (cancelled) return;

        if (upsertError) {
          console.error("Profile upsert failed:", upsertError);
        }
      }
    }

    ensureProfileExists();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // Authentication and Onboarding Redirect Logic
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/login");
      return;
    }

    if (isProfileLoading) {
      return;
    }

    if (user && !isOnboardingComplete) {
      localStorage.removeItem("bump_skip_due");
      navigate("/onboarding");
      return;
    }

    if (isOnboardingComplete && window.location.pathname === "/onboarding") {
      navigate("/");
    }
  }, [authLoading, user, isProfileLoading, isOnboardingComplete, navigate]);

  if (authLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading your profile...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return children;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* OAuth callback - handles redirect from auth providers */}
      <Route path="/auth/callback" component={AuthCallback} />

      <Route path="/onboarding">
        {() => (
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        )}
      </Route>

      <Route path="/appointments">
        {() => (
          <RequireAuth>
            <Appointments />
          </RequireAuth>
        )}
      </Route>

      <Route path="/timeline">
        {() => (
          <RequireAuth>
            <Timeline />
          </RequireAuth>
        )}
      </Route>

      <Route path="/journal">
        {() => (
          <RequireAuth>
            <Journal />
          </RequireAuth>
        )}
      </Route>

      <Route path="/settings">
        {() => (
          <RequireAuth>
            <Settings />
          </RequireAuth>
        )}
      </Route>

      <Route path="/">
        {() => (
          <RequireAuth>
            <Home />
          </RequireAuth>
        )}
      </Route>

      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}