// client/src/pages/subscribe.tsx
//
// Subscription purchase page
// Real RevenueCat integration for native, graceful fallback for web

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { usePregnancyState } from "@/hooks/usePregnancyState";
import { usePremium } from "@/contexts/PremiumContext";
import {
  getCurrentOffering,
  purchasePackage,
  restorePurchases,
  type Package,
  type Offering,
} from "@/lib/purchases";
import {
  Sparkles,
  Check,
  Heart,
  Users,
  ListTodo,
  Lightbulb,
  Loader2,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SubscribePage() {
  const { dueDate, setDueDate } = usePregnancyState();
  const { isPremium, canPurchase, refreshEntitlement } = usePremium();
  const [, setLocation] = useLocation();

  const [offering, setOffering] = useState<Offering | null>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feature list
  const features = [
    {
      icon: <Users className="w-5 h-5" />,
      title: "Partner View",
      description: "Your partner stays connected to your journey without you having to explain. They'll see what you're going through and know how to support you — no words needed.",
    },
    {
      icon: <ListTodo className="w-5 h-5" />,
      title: "Shared To-Do List",
      description: "Prepare together with a shared task list. Assign responsibilities, track progress, and make sure nothing falls through the cracks before baby arrives.",
    },
    {
      icon: <Lightbulb className="w-5 h-5" />,
      title: "Smart Suggestions",
      description: "Get personalized task recommendations based on your current week — from scheduling appointments to prepping the nursery, timed perfectly.",
    },
    {
      icon: <Sparkles className="w-5 h-5" />,
      title: "More Time with Ivy",
      description: "Enjoy longer, deeper conversations with Ivy. Ask up to 5 questions daily for guidance on symptoms, what to expect, and how to prepare — whenever you need her.",
    },
  ];

  // Load offerings on mount (native only)
  useEffect(() => {
    async function loadOfferings() {
      if (!canPurchase) {
        setLoadingOfferings(false);
        return;
      }

      try {
        const currentOffering = await getCurrentOffering();
        setOffering(currentOffering);
        
        // Auto-select first package (usually monthly)
        if (currentOffering?.availablePackages?.[0]) {
          setSelectedPackage(currentOffering.availablePackages[0]);
        }
      } catch (err) {
        console.error("Failed to load offerings:", err);
        setError("Unable to load subscription options");
      } finally {
        setLoadingOfferings(false);
      }
    }

    loadOfferings();
  }, [canPurchase]);

  // Redirect if already premium
  useEffect(() => {
    if (isPremium) {
      // Small delay to show success state
      const timer = setTimeout(() => {
        setLocation("/");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isPremium, setLocation]);

  // Handle purchase
  async function handlePurchase() {
    if (!selectedPackage || purchasing) return;

    setPurchasing(true);
    setError(null);

    const result = await purchasePackage(selectedPackage);

    if (result.success) {
      // Entitlement will be updated via listener, but refresh just in case
      await refreshEntitlement();
    } else if (result.error && result.error !== "cancelled") {
      setError(result.error);
    }

    setPurchasing(false);
  }

  // Handle restore
  async function handleRestore() {
    if (restoring) return;

    setRestoring(true);
    setError(null);

    const result = await restorePurchases();

    if (result.success) {
      await refreshEntitlement();
      if (!result.customerInfo?.entitlements?.active?.premium) {
        setError("No previous purchases found");
      }
    } else if (result.error) {
      setError(result.error);
    }

    setRestoring(false);
  }

  // Success state
  if (isPremium) {
    return (
      <Layout dueDate={dueDate} setDueDate={setDueDate}>
        <div className="max-w-lg mx-auto py-16 px-4 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
            <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="font-serif text-3xl font-bold mb-3">
            Welcome to Bloom Premium
          </h1>
          <p className="text-muted-foreground mb-6">
            All features are now unlocked. You're not alone on this journey.
          </p>
          <Button onClick={() => setLocation("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </Layout>
    );
  }

  // Web fallback (can't purchase)
  if (!canPurchase) {
    return (
      <Layout dueDate={dueDate} setDueDate={setDueDate}>
        <div className="max-w-xl mx-auto py-8 px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Heart className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-serif text-3xl font-bold mb-2">Bloom Premium</h1>
            <p className="text-muted-foreground">
              Feel supported. Stay connected. Prepare together.
            </p>
          </div>

          {/* Features */}
          <div className="bg-card border border-border rounded-xl p-6 mb-6">
            <div className="space-y-5">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary mt-0.5">
                    {feature.icon}
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold">{feature.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Web message */}
          <div className="bg-muted/50 border border-border rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Subscriptions are available on the iOS and Android apps.
            </p>
            <Button onClick={() => setLocation("/")} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Native purchase flow
  return (
    <Layout dueDate={dueDate} setDueDate={setDueDate}>
      <div className="max-w-xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Heart className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold mb-2">Bloom Premium</h1>
          <p className="text-muted-foreground">
            Feel supported. Stay connected. Prepare together.
          </p>
        </div>

        {/* Features */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <div className="space-y-5">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary mt-0.5">
                  {feature.icon}
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">{feature.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Packages */}
        {loadingOfferings ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : offering?.availablePackages && offering.availablePackages.length > 0 ? (
          <div className="space-y-3 mb-6">
            {offering.availablePackages.map((pkg) => (
              <button
                key={pkg.identifier}
                onClick={() => setSelectedPackage(pkg)}
                className={cn(
                  "w-full p-4 rounded-xl border-2 transition-all text-left",
                  selectedPackage?.identifier === pkg.identifier
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{pkg.product.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {pkg.product.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{pkg.product.priceString}</p>
                    {pkg.packageType === "MONTHLY" && (
                      <p className="text-xs text-muted-foreground">per month</p>
                    )}
                    {pkg.packageType === "ANNUAL" && (
                      <p className="text-xs text-muted-foreground">per year</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-muted/50 border border-border rounded-xl p-6 text-center mb-6">
            <p className="text-sm text-muted-foreground">
              Subscription options are being set up. Please check back soon.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
            <p className="text-sm text-destructive text-center">{error}</p>
          </div>
        )}

        {/* Purchase button */}
        {selectedPackage && (
          <Button
            onClick={handlePurchase}
            disabled={purchasing}
            className="w-full h-12 text-base mb-4"
            size="lg"
          >
            {purchasing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>Continue with {selectedPackage.product.priceString}</>
            )}
          </Button>
        )}

        {/* Restore purchases */}
        <Button
          onClick={handleRestore}
          disabled={restoring}
          variant="ghost"
          className="w-full mb-4"
        >
          {restoring ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Restoring...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Restore Purchases
            </>
          )}
        </Button>

        {/* Legal text */}
        <p className="text-xs text-muted-foreground text-center">
          Payment will be charged to your App Store account. Subscription
          automatically renews unless cancelled at least 24 hours before the end
          of the current period.
        </p>

        {/* Back button */}
        <div className="mt-6 text-center">
          <Button onClick={() => setLocation("/")} variant="link" className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    </Layout>
  );
}