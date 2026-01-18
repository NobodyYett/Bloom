// client/src/contexts/PremiumContext.tsx

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerAccess } from "@/contexts/PartnerContext";
import { supabase } from "@/lib/supabase";
import { Capacitor } from "@capacitor/core";
import {
  initializePurchases,
  loginUser,
  logoutUser,
  getCustomerInfo,
  hasEntitlement,
  ENTITLEMENT_ID,
} from "@/lib/purchases";

interface PremiumContextValue {
  // Premium status (server-authoritative from Supabase)
  isPremium: boolean;
  isPremiumLoading: boolean;
  
  // For partners: is the MOM premium?
  momIsPremium: boolean;
  
  // Can this user purchase? (native only, mom only)
  canPurchase: boolean;
  
  // Refresh premium status from Supabase
  refreshPremiumStatus: () => Promise<void>;
  
  // RevenueCat SDK state (for purchase UI only, not authoritative)
  rcCustomerInfo: any | null;
}

const PremiumContext = createContext<PremiumContextValue | null>(null);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isPartnerView, momUserId } = usePartnerAccess();
  
  const [isPremium, setIsPremium] = useState(false);
  const [momIsPremium, setMomIsPremium] = useState(false);
  const [isPremiumLoading, setIsPremiumLoading] = useState(true);
  const [rcCustomerInfo, setRcCustomerInfo] = useState<any | null>(null);

  // Can purchase: native platform + not a partner
  const canPurchase = Capacitor.isNativePlatform() && !isPartnerView;

  // Fetch premium status from Supabase (SERVER-AUTHORITATIVE)
  const refreshPremiumStatus = useCallback(async () => {
    if (!user?.id) {
      setIsPremium(false);
      setMomIsPremium(false);
      setIsPremiumLoading(false);
      return;
    }

    setIsPremiumLoading(true);

    try {
      // Fetch current user's premium status
      const { data: profile, error } = await supabase
        .from("pregnancy_profiles")
        .select("is_premium")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[Premium] Error fetching profile:", error);
      }

      const userIsPremium = profile?.is_premium === true;
      setIsPremium(userIsPremium);

      // If partner, also fetch mom's premium status
      if (isPartnerView && momUserId) {
        const { data: momProfile, error: momError } = await supabase
          .from("pregnancy_profiles")
          .select("is_premium")
          .eq("user_id", momUserId)
          .maybeSingle();

        if (momError) {
          console.error("[Premium] Error fetching mom profile:", momError);
        }

        setMomIsPremium(momProfile?.is_premium === true);
      } else {
        // If mom viewing, mom's premium = their own premium
        setMomIsPremium(userIsPremium);
      }
    } catch (err) {
      console.error("[Premium] Unexpected error:", err);
    } finally {
      setIsPremiumLoading(false);
    }
  }, [user?.id, isPartnerView, momUserId]);

  // Initialize RevenueCat on native (for purchase UI only - NOT authoritative)
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user?.id) return;

    async function initRC() {
      try {
        const initialized = await initializePurchases();
        if (!initialized) return;

        // Log in to RevenueCat with Supabase user ID
        await loginUser(user!.id);
        
        // Get customer info for UI purposes only
        const info = await getCustomerInfo();
        setRcCustomerInfo(info);

        // Note: We do NOT write to Supabase here
        // The webhook handles all premium status updates
        if (info && hasEntitlement(info, ENTITLEMENT_ID)) {
          console.log("[Premium] RC shows entitlement - webhook will sync to Supabase");
        }
      } catch (err) {
        console.error("[Premium] RevenueCat init error:", err);
      }
    }

    initRC();
  }, [user?.id]);

  // Fetch premium status on mount and when user changes
  useEffect(() => {
    refreshPremiumStatus();
  }, [refreshPremiumStatus]);

  // Subscribe to realtime changes on pregnancy_profiles (current user)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("premium-status-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pregnancy_profiles",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: { new?: { is_premium?: boolean } }) => {
          console.log("[Premium] Realtime update received");
          if (payload.new?.is_premium !== undefined) {
            setIsPremium(payload.new.is_premium);
            if (!isPartnerView) {
              setMomIsPremium(payload.new.is_premium);
            }
          }
        }
      )
      .subscribe();

    // Also subscribe to mom's profile if partner
    let momChannel: ReturnType<typeof supabase.channel> | null = null;
    if (isPartnerView && momUserId) {
      momChannel = supabase
        .channel("mom-premium-status-changes")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "pregnancy_profiles",
            filter: `user_id=eq.${momUserId}`,
          },
          (payload: { new?: { is_premium?: boolean } }) => {
            console.log("[Premium] Mom realtime update received");
            if (payload.new?.is_premium !== undefined) {
              setMomIsPremium(payload.new.is_premium);
            }
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(channel);
      if (momChannel) {
        supabase.removeChannel(momChannel);
      }
    };
  }, [user?.id, isPartnerView, momUserId]);

  // Clean up RevenueCat on logout
  useEffect(() => {
    if (!user && Capacitor.isNativePlatform()) {
      logoutUser();
      setRcCustomerInfo(null);
    }
  }, [user]);

  return (
    <PremiumContext.Provider
      value={{
        isPremium,
        isPremiumLoading,
        momIsPremium,
        canPurchase,
        refreshPremiumStatus,
        rcCustomerInfo,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium(): PremiumContextValue {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error("usePremium must be used within a PremiumProvider");
  }
  return context;
}