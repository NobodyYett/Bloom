// client/src/App.tsx

import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App as CapApp, URLOpenListenerEvent } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

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

/**
 * Deep Link Listener for Capacitor
 * Captures OAuth redirects when the app reopens via custom URL scheme
 */
function DeepLinkListener() {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleDeepLink = async (event: URLOpenListenerEvent) => {
      console.log("Deep link received:", event.url);

      try {
        const url = new URL(event.url);

        // Check if this is an auth callback
        if (url.pathname.includes("auth/callback") || url.host === "auth") {
          const code = url.searchParams.get("code");

          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(event.url);
            if (error) {
              console.error("Exchange code error:", error);
              navigate("/login", { replace: true });
            } else {
              navigate("/", { replace: true });
            }
          } else {
            // Try implicit flow
            const hashParams = new URLSearchParams(url.hash.replace("#", ""));
            const accessToken = hashParams.get("access_token");
            const refreshToken = hashParams.get("refresh_token");

            if (accessToken) {
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || "",
              });
              if (error) {
                console.error("Set session error:", error);
                navigate("/login", { replace: true });
              } else {
                navigate("/", { replace: true });
              }
            } else {
              navigate("/login", { replace: true });
            }
          }
        }
      } catch (err) {
        console.error("Deep link error:", err);
        navigate("/login", { replace: true });
      }
    };

    CapApp.addListener("appUrlOpen", handleDeepLink);

    return () => {
      CapApp.removeAllListeners();
    };
  }, [navigate]);

  return null;
}

/**
 * OAuth callback handler
 * Supports BOTH:
 * - PKCE flow (recommended): ?code=...
 * - Implicit flow (legacy): #access_token=...&refresh_token=...
 */
function AuthCallback() {
  const [, navigate] = useLocation();

  useEffect(() => {
    let cancelled = false;

    async function handleAuthCallback() {
      try {
        const url = window.location.href;
        const u = new URL(url);

        // ✅ PKCE: Supabase sends ?code=...
        const code = u.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) console.error("exchangeCodeForSession error:", error);
        } else {
          // ✅ Fallback: Implicit flow tokens
          const hashParams = new URLSearchParams(u.hash.replace(/^#/, ""));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (accessToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || "",
            });
            if (error) console.error("setSession error:", error);
          }
        }
      } catch (err) {
        console.error("AuthCallback failed:", err);
      } finally {
        if (!cancelled) {
          // Let AuthProvider onAuthStateChange drive the rest
          navigate("/", { replace: true });
        }
      }
    }

    handleAuthCallback();

    return () => {
      cancelled = true;
    };
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
  useEffect(() => {
    if (!user || authLoading) return;

    let cancelled = false;

    async function ensureProfileExists() {
      const { data: existing, error: selectError } = await supabase
        .from("pregnancy_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (selectError) {
        console.error("Profile lookup failed:", selectError);
        return;
      }

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

    if (isProfileLoading) return;

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

  if (!user) return null;

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
          <DeepLinkListener />
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}