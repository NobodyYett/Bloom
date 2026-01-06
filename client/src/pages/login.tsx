import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Apple, Chrome } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const [loadingProvider, setLoadingProvider] = useState<
    null | "google" | "apple"
  >(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();

  // Redirect to home if user is already logged in
  useEffect(() => {
    if (!loading && user) {
      console.log("User authenticated, navigating to home");
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  async function handleSignIn(provider: "google" | "apple") {
    try {
      setLoadingProvider(provider);

      // CRITICAL: Always use canonical domain for OAuth redirects
      // This prevents redirect leakage if users access via legacy domains
      const CANONICAL_WEB_ORIGIN = import.meta.env.VITE_PUBLIC_WEB_ORIGIN || "https://bloom.zelkzonline.com";
      
      // Use custom URL scheme for mobile deep link callback
      const redirectTo = Capacitor.isNativePlatform()
        ? "com.zelkz.bloom://auth/callback"
        : `${CANONICAL_WEB_ORIGIN}/auth/callback`;

      console.log("OAuth redirect URL:", redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        toast({
          title: "Sign-in failed",
          description: error.message,
          variant: "destructive",
        });
        setLoadingProvider(null);
        return;
      }

      if (Capacitor.isNativePlatform() && data?.url) {
        console.log("Opening OAuth URL:", data.url);
        await Browser.open({
          url: data.url,
          presentationStyle: "popover",
        });
      } else if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error("Sign-in error:", err);
      toast({
        title: "Something went wrong",
        description: "Please try again.",
      });
      setLoadingProvider(null);
    }
  }

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  // If user exists, don't render login (will redirect via useEffect)
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Redirecting...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted px-4 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="petal petal-1" />
        <div className="petal petal-2" />
        <div className="petal petal-3" />
        <div className="petal petal-4" />
        <div className="petal petal-5" />
        <div className="petal petal-6" />
      </div>

      <div className="relative w-full max-w-md rounded-2xl border bg-card/80 backdrop-blur p-8 shadow-lg">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Welcome to
          </p>
          <h1 className="text-3xl font-serif font-semibold tracking-tight mb-3">
            Bloom
          </h1>

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-3">
            <p className="text-sm leading-relaxed text-primary blossom-script">
              A gentle reminder to you that every pregnancy is unique.
            </p>
            <p className="text-sm leading-relaxed text-primary blossom-script">
              We are honored to help guide yours.
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Sign in to begin your personalized pregnancy experience.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            className="w-full flex items-center justify-center gap-2"
            variant="outline"
            disabled={loadingProvider !== null}
            onClick={() => handleSignIn("google")}
          >
            <Chrome className="w-4 h-4" />
            {loadingProvider === "google"
              ? "Connecting to Google..."
              : "Continue with Google"}
          </Button>

          <Button
            type="button"
            className="w-full flex items-center justify-center gap-2 bg-black text-white hover:bg-black/90"
            disabled={loadingProvider !== null}
            onClick={() => handleSignIn("apple")}
          >
            <Apple className="w-4 h-4" />
            {loadingProvider === "apple"
              ? "Connecting to Apple..."
              : "Continue with Apple"}
          </Button>
        </div>

        <p className="mt-6 text-[11px] text-center text-muted-foreground leading-relaxed">
          By continuing, you agree to our{" "}
          <button 
            type="button"
            onClick={() => window.open('/terms.html', '_blank')} 
            className="underline hover:text-foreground"
          >
            Terms of Service
          </button>{" "}
          and{" "}
          <button 
            type="button"
            onClick={() => window.open('/privacy.html', '_blank')} 
            className="underline hover:text-foreground"
          >
            Privacy Policy
          </button>.
        </p>
      </div>
    </div>
  );
}