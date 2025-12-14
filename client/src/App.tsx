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

// Simple auth gate that works with wouter
function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading: authLoading } = useAuth(); 
  const { isProfileLoading, isOnboardingComplete } = usePregnancyState(); 
  const [, navigate] = useLocation();

  // 1. Profile Creation Check/Insert
  useEffect(() => {
    if (user && !authLoading) {
      async function ensureProfileExists() {
        const { data: existing } = await supabase
          .from("pregnancy_profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();
        
        if (!existing) {
          const { error: insertError } = await supabase
            .from("pregnancy_profiles")
            .insert({ user_id: user.id });
            
          if (insertError && insertError.code !== "23505") {
            console.error("Profile creation failed:", insertError);
          }
        }
      }
      ensureProfileExists();
    }
  }, [user, authLoading]);

  // 2. Authentication and Onboarding Redirect Logic
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