// client/src/contexts/PartnerContext.tsx

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

interface PartnerContextValue {
  // Role flags
  isPartnerView: boolean;
  isLoading: boolean;
  
  // When viewing as partner, this is the mom's info
  momUserId: string | null;
  momName: string | null;
  
  // For mom: active partner info
  hasActivePartner: boolean;
  partnerAcceptedAt: string | null;
  
  // Actions
  refreshPartnerAccess: () => Promise<void>;
}

const PartnerContext = createContext<PartnerContextValue | undefined>(undefined);

export function PartnerProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  
  const [isPartnerView, setIsPartnerView] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [momUserId, setMomUserId] = useState<string | null>(null);
  const [momName, setMomName] = useState<string | null>(null);
  const [hasActivePartner, setHasActivePartner] = useState(false);
  const [partnerAcceptedAt, setPartnerAcceptedAt] = useState<string | null>(null);

  const checkPartnerAccess = useCallback(async () => {
    if (!user) {
      setIsPartnerView(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // First, check if user has their own pregnancy profile (they're a mom)
      const { data: ownProfile } = await supabase
        .from("pregnancy_profiles")
        .select("user_id, mom_name")
        .eq("user_id", user.id)
        .single();

      if (ownProfile) {
        // User is a mom (has their own profile)
        setIsPartnerView(false);
        setMomUserId(null);
        setMomName(null);

        // Check if they have an active partner
        const { data: partnerData } = await supabase
          .from("partner_access")
          .select("accepted_at")
          .eq("mom_user_id", user.id)
          .not("accepted_at", "is", null)
          .is("revoked_at", null)
          .single();

        setHasActivePartner(!!partnerData);
        setPartnerAcceptedAt(partnerData?.accepted_at ?? null);
      } else {
        // Check if user is a partner with access to someone else's profile
        const { data: partnerAccess } = await supabase
          .from("partner_access")
          .select("mom_user_id, accepted_at")
          .eq("partner_user_id", user.id)
          .not("accepted_at", "is", null)
          .is("revoked_at", null)
          .single();

        if (partnerAccess) {
          // User is viewing as partner - fetch mom's profile info
          const { data: momProfile } = await supabase
            .from("pregnancy_profiles")
            .select("mom_name")
            .eq("user_id", partnerAccess.mom_user_id)
            .single();

          setIsPartnerView(true);
          setMomUserId(partnerAccess.mom_user_id);
          setMomName(momProfile?.mom_name ?? null);
          setHasActivePartner(false);
          setPartnerAcceptedAt(null);
        } else {
          // User has no profile and no partner access - treat as new user
          setIsPartnerView(false);
          setMomUserId(null);
          setMomName(null);
          setHasActivePartner(false);
          setPartnerAcceptedAt(null);
        }
      }
    } catch (error) {
      console.error("Error checking partner access:", error);
      setIsPartnerView(false);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      checkPartnerAccess();
    }
  }, [authLoading, checkPartnerAccess]);

  const value = useMemo(() => ({
    isPartnerView,
    isLoading: isLoading || authLoading,
    momUserId,
    momName,
    hasActivePartner,
    partnerAcceptedAt,
    refreshPartnerAccess: checkPartnerAccess,
  }), [isPartnerView, isLoading, authLoading, momUserId, momName, hasActivePartner, partnerAcceptedAt, checkPartnerAccess]);

  return (
    <PartnerContext.Provider value={value}>
      {children}
    </PartnerContext.Provider>
  );
}

export function usePartnerAccess() {
  const context = useContext(PartnerContext);
  if (!context) {
    throw new Error("usePartnerAccess must be used within a PartnerProvider");
  }
  return context;
}