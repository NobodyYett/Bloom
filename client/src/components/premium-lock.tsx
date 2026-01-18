// client/src/components/premium-lock.tsx

import { ReactNode } from "react";
import { useLocation } from "wouter";
import { usePartnerAccess } from "@/contexts/PartnerContext";
import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PremiumLockProps {
  isPaid: boolean;
  children: ReactNode;
  message?: string;
  showLockOverlay?: boolean;
}

export function PremiumLock({
  isPaid,
  children,
  message = "This is a premium feature",
  showLockOverlay = true,
}: PremiumLockProps) {
  const [, navigate] = useLocation();
  const { isPartnerView } = usePartnerAccess();

  // If premium, show children
  if (isPaid) {
    return <>{children}</>;
  }

  // Determine where to redirect based on user type
  // Partners go to partner-paywall (no purchase CTA)
  // Moms go to subscribe (can purchase)
  const paywallRoute = isPartnerView ? "/partner-paywall" : "/subscribe";

  // Show locked state
  if (showLockOverlay) {
    return (
      <div className="relative">
        {/* Blurred/disabled content */}
        <div className="opacity-50 pointer-events-none select-none blur-[2px]">
          {children}
        </div>

        {/* Lock overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl">
          <div className="text-center space-y-3 p-6">
            <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{message}</p>
            <Button
              size="sm"
              onClick={() => navigate(paywallRoute)}
            >
              <Crown className="w-4 h-4 mr-2" />
              {isPartnerView ? "Learn More" : "Upgrade"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Simple hidden version
  return null;
}

// Hook for programmatic checks and redirects
export function usePremiumGate() {
  const [, navigate] = useLocation();
  const { isPartnerView } = usePartnerAccess();

  const redirectToPaywall = () => {
    navigate(isPartnerView ? "/partner-paywall" : "/subscribe");
  };

  return { redirectToPaywall, paywallRoute: isPartnerView ? "/partner-paywall" : "/subscribe" };
}