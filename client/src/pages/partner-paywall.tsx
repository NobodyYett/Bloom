// client/src/pages/partner-paywall.tsx

import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { usePremium } from "@/contexts/PremiumContext";
import { usePartnerAccess } from "@/contexts/PartnerContext";
import { Heart, RefreshCw, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

export default function PartnerPaywall() {
  const [, navigate] = useLocation();
  const { momIsPremium, refreshPremiumStatus, isPremiumLoading } = usePremium();
  const { isPartnerView, momName } = usePartnerAccess();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // If partner now has access (mom subscribed), redirect to home
  useEffect(() => {
    if (momIsPremium && isPartnerView) {
      navigate("/", { replace: true });
    }
  }, [momIsPremium, isPartnerView, navigate]);

  // If not a partner, redirect to subscribe
  useEffect(() => {
    if (!isPartnerView) {
      navigate("/subscribe", { replace: true });
    }
  }, [isPartnerView, navigate]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await refreshPremiumStatus();
    setIsRefreshing(false);
  }

  if (isPremiumLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto py-12 px-4 text-center space-y-6">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Heart className="w-10 h-10 text-primary" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-bold">Partner Access</h1>
          <p className="text-muted-foreground">
            Partner View is a Bloom Premium feature
          </p>
        </div>

        {/* Explanation */}
        <div className="bg-card border border-border rounded-xl p-6 text-left space-y-3">
          <p className="text-sm">
            To access Partner View and support {momName || "mom"} during pregnancy, 
            {momName ? ` ${momName}` : " she"} needs to have an active Bloom Premium subscription.
          </p>
          <p className="text-sm text-muted-foreground">
            Once subscribed, you&apos;ll automatically gain access to:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>• View pregnancy progress and milestones</li>
            <li>• See shared to-do lists</li>
            <li>• Track appointments together</li>
            <li>• Get partner-specific tips</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Access
              </>
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground">
            Already subscribed? Tap refresh to check again.
          </p>
        </div>

        {/* Back */}
        <Button variant="ghost" onClick={() => navigate("/")}>
          Go Back
        </Button>
      </div>
    </Layout>
  );
}