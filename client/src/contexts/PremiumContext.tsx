// client/src/contexts/PremiumContext.tsx
//
// Single source of truth for premium subscription status
// Wraps RevenueCat and provides usePremium() hook

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { usePartnerAccess } from "@/contexts/PartnerContext";
import {
  initializePurchases,
  getCustomerInfo,
  loginUser,
  logoutUser,
  hasEntitlement,
  addCustomerInfoListener,
  isNativePlatform,
  ENTITLEMENT_ID,
  type CustomerInfo,
} from "@/lib/purchases";

// ============================================
// Types
// ============================================

interface PremiumContextValue {
  /** User has active premium subscription */
  isPremium: boolean;
  /** Household-level premium (uses mom's premium when in partner view) */
  effectiveIsPremium: boolean;
  /** Loading initial state */
  isLoading: boolean;
  /** Full customer info from RevenueCat */
  customerInfo: CustomerInfo | null;
  /** Manually refresh entitlement status */
  refreshEntitlement: () => Promise<void>;
  /** Whether we're on a native platform (can purchase) */
  canPurchase: boolean;
  /** Sync premium status to Supabase (for server-side checks) */
  syncPremiumToSupabase: (isPremium: boolean) => Promise<void>;
}

// ============================================
// Context
// ============================================

const PremiumContext = createContext<PremiumContextValue | null>(null);

// ============================================
// Provider
// ============================================

interface PremiumProviderProps {
  children: ReactNode;
}

export function PremiumProvider({ children }: PremiumProviderProps) {
  const { user } = useAuth();
  const { isPartnerView, momIsPremium, momUserId } = usePartnerAccess();
  
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [initialized, setInitialized] = useState(false);
  
  const canPurchase = isNativePlatform();
  
  console.log("[Premium] PremiumProvider render, canPurchase:", canPurchase);

  // Sync premium status to Supabase for server-side enforcement (ask-ivy limits)
  const syncPremiumToSupabase = useCallback(async (premium: boolean) => {
    if (!user?.id) {
      console.log("[Premium] Cannot sync - no user");
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          is_premium: premium,
          premium_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });

      if (error) {
        console.error("[Premium] Sync to Supabase failed:", error);
      } else {
        console.log("[Premium] Synced to Supabase: is_premium =", premium);
      }
    } catch (err) {
      console.error("[Premium] Sync error:", err);
    }
  }, [user?.id]);

  // Update premium status from customer info
  const updatePremiumStatus = useCallback((info: CustomerInfo | null) => {
    console.log("[Premium] updatePremiumStatus called with info:", info);
    setCustomerInfo(info);
    const hasPremium = hasEntitlement(info, ENTITLEMENT_ID);
    console.log("[Premium] hasPremium:", hasPremium);
    setIsPremium(hasPremium);
    
    // Auto-sync to Supabase when premium status changes (only for mom, not partner)
    if (user?.id && !isPartnerView) {
      syncPremiumToSupabase(hasPremium);
    }
  }, [user?.id, isPartnerView, syncPremiumToSupabase]);

  // Refresh entitlement from RevenueCat (native) or Supabase (web)
  const refreshEntitlement = useCallback(async () => {
    console.log("[Premium] refreshEntitlement called, canPurchase:", canPurchase);
    
    if (!canPurchase) {
      // Web: refresh from Supabase (use mom's profile when in partner view)
      const profileId = isPartnerView ? momUserId : user?.id;
      if (profileId) {
        try {
          const { data } = await supabase
            .from("profiles")
            .select("is_premium")
            .eq("id", profileId)
            .single();
          
          setIsPremium(data?.is_premium === true);
        } catch (err) {
          console.log("[Premium] Web refresh failed");
        }
      }
      setIsLoading(false);
      return;
    }

    try {
      const info = await getCustomerInfo();
      updatePremiumStatus(info);
    } catch (error) {
      console.error("[Premium] Refresh failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [canPurchase, user?.id, isPartnerView, momUserId, updatePremiumStatus]);

  // Initialize RevenueCat on mount (native) or check Supabase (web)
  useEffect(() => {
    async function init() {
      console.log("[Premium] Init useEffect starting");
      console.log("[Premium] canPurchase:", canPurchase);
      console.log("[Premium] user?.id:", user?.id);
      
      if (!canPurchase) {
        console.log("[Premium] Not native platform, skipping RevenueCat init");
        // Web: Check Supabase for premium status (purchased on mobile)
        if (user?.id) {
          try {
            const { data } = await supabase
              .from("profiles")
              .select("is_premium")
              .eq("id", user.id)
              .single();
            
            if (data?.is_premium) {
              setIsPremium(true);
              console.log("[Premium] Web user has premium (from mobile purchase)");
            }
          } catch (err) {
            console.log("[Premium] Could not check web premium status");
          }
        }
        setIsLoading(false);
        setInitialized(true);
        return;
      }

      console.log("[Premium] Calling initializePurchases...");
      const success = await initializePurchases();
      console.log("[Premium] initializePurchases returned:", success);
      
      if (success) {
        setInitialized(true);
      } else {
        console.log("[Premium] initializePurchases failed, setting isLoading false");
        setIsLoading(false);
      }
    }

    init();
  }, [canPurchase, user?.id]);

  // Login/logout user when auth changes
  useEffect(() => {
    async function syncUser() {
      console.log("[Premium] syncUser useEffect, initialized:", initialized, "canPurchase:", canPurchase, "user:", user?.id);
      
      if (!initialized || !canPurchase) {
        console.log("[Premium] syncUser skipping - not initialized or not native");
        return;
      }

      setIsLoading(true);

      try {
        if (user?.id) {
          // Login to RevenueCat with user ID
          console.log("[Premium] Logging in user to RevenueCat:", user.id);
          const info = await loginUser(user.id);
          console.log("[Premium] loginUser returned:", info);
          updatePremiumStatus(info);
        } else {
          // Logout from RevenueCat
          console.log("[Premium] Logging out from RevenueCat");
          const info = await logoutUser();
          updatePremiumStatus(info);
        }
      } catch (error) {
        console.error("[Premium] User sync failed:", error);
      } finally {
        setIsLoading(false);
      }
    }

    syncUser();
  }, [user?.id, initialized, canPurchase, updatePremiumStatus]);

  // Listen for customer info updates (e.g., subscription renewal, cancellation)
  useEffect(() => {
    if (!initialized || !canPurchase) return;

    let cleanup: (() => void) | null = null;

    async function setupListener() {
      cleanup = await addCustomerInfoListener((info) => {
        console.log("[Premium] Customer info updated via listener");
        updatePremiumStatus(info);
      });
    }

    setupListener();

    return () => {
      cleanup?.();
    };
  }, [initialized, canPurchase, updatePremiumStatus]);

  // Dev-only premium override for local testing
  const devForcePremium = import.meta.env.DEV && import.meta.env.VITE_FORCE_PREMIUM === "true";
  
  useEffect(() => {
    if (devForcePremium) {
      console.warn("[Premium] DEV OVERRIDE: Forcing premium=true via VITE_FORCE_PREMIUM");
    }
  }, [devForcePremium]);

  const finalIsPremium = devForcePremium || isPremium;
  const finalEffectiveIsPremium = devForcePremium || (isPartnerView ? (momIsPremium ?? false) : isPremium);

  const value: PremiumContextValue = {
    isPremium: finalIsPremium,
    effectiveIsPremium: finalEffectiveIsPremium,
    isLoading,
    customerInfo,
    refreshEntitlement,
    canPurchase,
    syncPremiumToSupabase,
  };

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function usePremium(): PremiumContextValue {
  const context = useContext(PremiumContext);
  
  if (!context) {
    throw new Error("usePremium must be used within a PremiumProvider");
  }
  
  return context;
}