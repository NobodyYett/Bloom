// client/src/pages/subscribe.tsx

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerAccess } from "@/contexts/PartnerContext";
import { usePremium } from "@/contexts/PremiumContext";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";
import {
  getCurrentOffering,
  purchasePackage,
  restorePurchases,
  type Package,
  type Offering,
} from "@/lib/purchases";
import {
  Crown,
  Check,
  Loader2,
  Smartphone,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PlanType = "monthly" | "annual";

export default function SubscribePage() {
  const { user } = useAuth();
  const { isPartnerView } = usePartnerAccess();
  const { isPremium, canPurchase, refreshPremiumStatus } = usePremium();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [offering, setOffering] = useState<Offering | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("annual");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingOffering, setIsLoadingOffering] = useState(true);

  // Redirect partner to partner-paywall
  useEffect(() => {
    if (isPartnerView) {
      navigate("/partner-paywall", { replace: true });
    }
  }, [isPartnerView, navigate]);

  // Load offerings on mount (native only)
  useEffect(() => {
    if (!canPurchase) {
      setIsLoadingOffering(false);
      return;
    }

    async function loadOffering() {
      try {
        const currentOffering = await getCurrentOffering();
        setOffering(currentOffering);
      } catch (err) {
        console.error("[Subscribe] Failed to load offerings:", err);
      } finally {
        setIsLoadingOffering(false);
      }
    }

    loadOffering();
  }, [canPurchase]);

  // Get package by type (deterministic selection)
  function getPackageByType(type: PlanType): Package | null {
    if (!offering) return null;

    // Prefer named packages from RevenueCat
    if (type === "monthly" && offering.monthly) {
      return offering.monthly;
    }
    if (type === "annual" && offering.annual) {
      return offering.annual;
    }

    // Fallback: search by identifier pattern
    const searchTerms = type === "monthly" 
      ? ["monthly", "month", "1m", "_m_"] 
      : ["annual", "yearly", "year", "12m", "_y_"];

    const pkg = offering.availablePackages.find((p) =>
      searchTerms.some(
        (term) =>
          p.identifier.toLowerCase().includes(term) ||
          p.product.identifier.toLowerCase().includes(term)
      )
    );

    return pkg || null;
  }

  const monthlyPkg = getPackageByType("monthly");
  const annualPkg = getPackageByType("annual");
  const selectedPkg = selectedPlan === "monthly" ? monthlyPkg : annualPkg;

  async function handlePurchase() {
    if (!selectedPkg || !canPurchase) return;

    setIsPurchasing(true);
    try {
      const result = await purchasePackage(selectedPkg);

      if (result.success) {
        toast({
          title: "Welcome to Bloom Premium!",
          description: "Your subscription is now active.",
        });
        
        // Refresh from Supabase (webhook will have updated it)
        // Add small delay for webhook processing
        setTimeout(async () => {
          await refreshPremiumStatus();
          navigate("/", { replace: true });
        }, 2000);
      } else if (result.error === "cancelled") {
        // User cancelled - do nothing
      } else {
        toast({
          variant: "destructive",
          title: "Purchase failed",
          description: result.error || "Please try again.",
        });
      }
    } catch (err) {
      console.error("[Subscribe] Purchase error:", err);
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: "Please try again later.",
      });
    } finally {
      setIsPurchasing(false);
    }
  }

  async function handleRestore() {
    if (!canPurchase) return;

    setIsRestoring(true);
    try {
      const result = await restorePurchases();

      if (result.success) {
        toast({
          title: "Purchases restored",
          description: "Checking your subscription status...",
        });
        
        // Refresh from Supabase
        setTimeout(async () => {
          await refreshPremiumStatus();
        }, 2000);
      } else {
        toast({
          variant: "destructive",
          title: "Restore failed",
          description: result.error || "No previous purchases found.",
        });
      }
    } catch (err) {
      console.error("[Subscribe] Restore error:", err);
    } finally {
      setIsRestoring(false);
    }
  }

  // Already premium
  if (isPremium) {
    return (
      <Layout>
        <div className="max-w-md mx-auto py-12 text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Crown className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-bold">You&apos;re Premium!</h1>
          <p className="text-muted-foreground">
            You have full access to all Bloom features.
          </p>
          <Button onClick={() => navigate("/")}>
            Go Home
          </Button>
        </div>
      </Layout>
    );
  }

  // Web: Show mobile-only message
  if (!Capacitor.isNativePlatform()) {
    return (
      <Layout>
        <div className="max-w-md mx-auto py-12 text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="font-serif text-2xl font-bold">
            Subscriptions Available in App
          </h1>
          <p className="text-muted-foreground">
            To subscribe to Bloom Premium, please use the iOS or Android app.
          </p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Go Back
          </Button>
        </div>
      </Layout>
    );
  }

  // Loading offerings
  if (isLoadingOffering) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Features list
  const features = [
    "Partner View for your support person",
    "Unlimited Ivy AI questions",
    "Detailed weekly insights",
    "Smart task suggestions",
    "Priority support",
  ];

  return (
    <Layout>
      <div className="max-w-lg mx-auto py-8 px-4 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Crown className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold">Bloom Premium</h1>
          <p className="text-muted-foreground">
            Unlock the full pregnancy experience
          </p>
        </div>

        {/* Features */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-3">
          {features.map((feature, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-primary" />
              </div>
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>

        {/* Plan Selection */}
        {(monthlyPkg || annualPkg) && (
          <div className="space-y-3">
            {annualPkg && (
              <button
                type="button"
                onClick={() => setSelectedPlan("annual")}
                className={cn(
                  "w-full p-4 rounded-xl border-2 text-left transition-all",
                  selectedPlan === "annual"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">Annual</div>
                    <div className="text-sm text-muted-foreground">
                      Best value — save 40%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      {annualPkg.product.priceString}
                    </div>
                    <div className="text-xs text-muted-foreground">per year</div>
                  </div>
                </div>
              </button>
            )}

            {monthlyPkg && (
              <button
                type="button"
                onClick={() => setSelectedPlan("monthly")}
                className={cn(
                  "w-full p-4 rounded-xl border-2 text-left transition-all",
                  selectedPlan === "monthly"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">Monthly</div>
                    <div className="text-sm text-muted-foreground">
                      Flexible billing
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      {monthlyPkg.product.priceString}
                    </div>
                    <div className="text-xs text-muted-foreground">per month</div>
                  </div>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Purchase Button */}
        <Button
          className="w-full h-12 text-base"
          onClick={handlePurchase}
          disabled={isPurchasing || !selectedPkg}
        >
          {isPurchasing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Crown className="w-4 h-4 mr-2" />
              Subscribe Now
            </>
          )}
        </Button>

        {/* Restore */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleRestore}
            disabled={isRestoring}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            {isRestoring ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3" />
                Restore Purchases
              </>
            )}
          </button>
        </div>

        {/* Legal */}
        <p className="text-xs text-center text-muted-foreground">
          Payment will be charged to your App Store account. Subscription
          automatically renews unless canceled at least 24 hours before the end
          of the current period.
        </p>
      </div>
    </Layout>
  );
}