import { useEffect, useRef } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App as CapApp, URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Timeline from "@/pages/timeline";
import Journal from "@/pages/journal";
import Login from "@/pages/login";
import Onboarding from "@/pages/onboarding";
import Appointments from "@/pages/appointments";
import Settings from "@/pages/settings";
import AiPage from "@/pages/ai";
import JoinPage from "@/pages/join";

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PartnerProvider, usePartnerAccess } from "@/contexts/PartnerContext";
import { usePregnancyState } from "@/hooks/usePregnancyState";
import { supabase } from "./lib/supabase";

async function closeSafariBestEffort() {
  try {
    await Browser.close();
  } catch {}
  setTimeout(() => {
    Browser.close().catch(() => {});
  }, 250);
  setTimeout(() => {
    Browser.close().catch(() => {});
  }, 900);
}

function DeepLinkListener() {
  const [, navigate] = useLocation();
  const processedUrls = useRef<Set<string>>(new Set());
  const isHandling = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleDeepLink = async (event: URLOpenListenerEvent) => {
      const fullUrl = event.url || "";
      if (!fullUrl) return;

      if (!fullUrl.startsWith("com.bumpplanner.app://")) return;
      if (!fullUrl.includes("auth/callback")) return;

      if (isHandling.current) return;
      if (processedUrls.current.has(fullUrl)) return;

      isHandling.current = true;
      processedUrls.current.add(fullUrl);
      setTimeout(() => processedUrls.current.delete(fullUrl), 8000);

      try {
        console.log("[appUrlOpen] received:", fullUrl);
        await closeSafariBestEffort();

        const url = new URL(fullUrl);
        const hash = url.hash.replace(/^#/, "");
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken) {
          console.log("[appUrlOpen] setting session with access_token");
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || "",
          });

          if (error) {
            console.error("[appUrlOpen] setSession error:", error);
            navigate("/login", { replace: true });
          } else {
            console.log("[appUrlOpen] session set OK");
            navigate("/", { replace: true });
          }
          return;
        }

        const code = url.searchParams.get("code");
        if (code) {
          console.log("[appUrlOpen] exchanging code");
          const { error } = await supabase.auth.exchangeCodeForSession(fullUrl);
          if (error) {
            console.error("[appUrlOpen] exchangeCode error:", error);
            navigate("/login", { replace: true });
          } else {
            navigate("/", { replace: true });
          }
          return;
        }

        console.log("[appUrlOpen] no token or code found");
        navigate("/login", { replace: true });
      } catch (err) {
        console.error("[appUrlOpen] error:", err);
        navigate("/login", { replace: true });
      } finally {
        isHandling.current = false;
      }
    };

    CapApp.addListener("appUrlOpen", handleDeepLink);
    return () => {
      CapApp.removeAllListeners();
    };
  }, [navigate]);

  return null;
}

function AuthCallback() {
  const [, navigate] = useLocation();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    async function handleAuthCallback() {
      try {
        const url = window.location.href;
        const u = new URL(url);

        const code = u.searchParams.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(url);
        } else {
          const hashParams = new URLSearchParams(u.hash.replace(/^#/, ""));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (accessToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || "",
            });
          }
        }
      } catch (err) {
        console.error("AuthCallback failed:", err);
      }

      // Check if there's a return URL (e.g., from partner invite)
      const returnTo = sessionStorage.getItem("returnTo");
      if (returnTo) {
        sessionStorage.removeItem("returnTo");
        navigate(returnTo, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Completing sign in...
    </div>
  );
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading: authLoading } = useAuth();
  const { isPartnerView, isLoading: partnerLoading } = usePartnerAccess();
  const { isProfileLoading, isOnboardingComplete } = usePregnancyState();
  const [location, navigate] = useLocation();

  // Check if we're on the /join page - special handling needed
  const isJoinPage = location.startsWith("/join") || window.location.pathname.startsWith("/join");

  // Ensure profile exists - BUT NOT for partners OR users on /join page
  useEffect(() => {
    if (!user || authLoading || partnerLoading) return;
    
    // Partners don't need their own pregnancy profile
    // Users on /join page are about to become partners - don't create profile
    if (isPartnerView || isJoinPage) return;

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
  }, [user, authLoading, partnerLoading, isPartnerView, isJoinPage]);

  // Redirect logic
  useEffect(() => {
    if (authLoading || partnerLoading) return;

    if (!user) {
      // Save current location for return after login (for /join page)
      if (isJoinPage) {
        sessionStorage.setItem("returnTo", window.location.pathname + window.location.search);
      }
      navigate("/login", { replace: true });
      return;
    }

    // Partners skip onboarding and profile checks
    if (isPartnerView) return;
    
    // Users on /join page skip onboarding - they're becoming partners
    if (isJoinPage) return;

    if (isProfileLoading) return;

    if (user && !isOnboardingComplete) {
      localStorage.removeItem("bump_skip_due");
      navigate("/onboarding", { replace: true });
      return;
    }

    if (isOnboardingComplete && window.location.pathname === "/onboarding") {
      navigate("/", { replace: true });
    }
  }, [authLoading, partnerLoading, user, isPartnerView, isJoinPage, isProfileLoading, isOnboardingComplete, navigate, location]);

  // For /join page, only need auth loading check
  if (isJoinPage) {
    if (authLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          Loading...
        </div>
      );
    }
    if (!user) return null;
    return children;
  }

  if (authLoading || partnerLoading || isProfileLoading) {
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

      <Route path="/ai">
        {() => (
          <RequireAuth>
            <AiPage />
          </RequireAuth>
        )}
      </Route>

      <Route path="/join">
        {() => (
          <RequireAuth>
            <JoinPage />
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
      <PartnerProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <DeepLinkListener />
            <Toaster />
            <Router />
          </TooltipProvider>
        </QueryClientProvider>
      </PartnerProvider>
    </AuthProvider>
  );
}