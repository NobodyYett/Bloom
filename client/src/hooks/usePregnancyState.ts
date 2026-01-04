// client/src/hooks/usePregnancyState.ts

import { useMemo, useState, useEffect, useCallback } from "react";
import { differenceInWeeks, differenceInDays, format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerAccess } from "@/contexts/PartnerContext";
import { supabase } from "@/lib/supabase";

const TOTAL_PREGNANCY_WEEKS = 40;

export type BabySex = "boy" | "girl" | "unknown";

export interface PregnancyState {
  dueDate: Date | null;
  setDueDate: (date: Date | null) => void;
  isProfileLoading: boolean;
  isOnboardingComplete: boolean;
  setIsOnboardingComplete: (isComplete: boolean) => void;
  refetch: () => void;

  currentWeek: number;
  daysRemaining: number;
  today: Date;
  trimester: 1 | 2 | 3;
  progress: number;

  babyName: string | null;
  setBabyName: (name: string | null) => void;
  babySex: BabySex;
  setBabySex: (sex: BabySex) => void;

  // Parent names
  momName: string | null;
  setMomName: (name: string | null) => void;
  partnerName: string | null;
  setPartnerName: (name: string | null) => void;
}

// Helper: parse "yyyy-MM-dd" as LOCAL date (not UTC)
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Data fetching function for React Query
const fetchProfileData = async (userId: string | undefined) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("pregnancy_profiles")
    .select("due_date, baby_name, baby_sex, onboarding_complete, mom_name, partner_name")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data;
};

export function usePregnancyState(): PregnancyState {
  const { user, loading: authLoading } = useAuth();
  const { isPartnerView, momUserId, isLoading: partnerLoading } = usePartnerAccess();
  const queryClient = useQueryClient();

  // Key insight: When in partner view, fetch the MOM's profile, not the partner's
  const profileUserId = isPartnerView ? momUserId : user?.id;

  const {
    data: profile,
    isLoading: isProfileFetching,
    refetch,
  } = useQuery({
    queryKey: ["pregnancyProfile", profileUserId],
    queryFn: () => fetchProfileData(profileUserId ?? undefined),
    enabled: !!profileUserId && !partnerLoading,
    staleTime: 1000 * 60,
  });

  const [dueDate, setDueDateState] = useState<Date | null>(null);
  const [babyNameState, setBabyNameState] = useState<string | null>(null);
  const [babySexState, setBabySexState] = useState<BabySex>("unknown");
  const [isOnboardingCompleteState, setIsOnboardingCompleteState] = useState(false);
  const [momNameState, setMomNameState] = useState<string | null>(null);
  const [partnerNameState, setPartnerNameState] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDueDateState(profile.due_date ? parseLocalDate(profile.due_date) : null);
      setBabyNameState(profile.baby_name ?? null);
      setBabySexState(profile.baby_sex ?? "unknown");
      setIsOnboardingCompleteState(profile.onboarding_complete ?? false);
      setMomNameState(profile.mom_name ?? null);
      setPartnerNameState(profile.partner_name ?? null);
    } else if (!isProfileFetching && profileUserId && !authLoading && !partnerLoading) {
      setDueDateState(null);
      setBabyNameState(null);
      setBabySexState("unknown");
      setIsOnboardingCompleteState(false);
      setMomNameState(null);
      setPartnerNameState(null);
    }
  }, [profile, isProfileFetching, profileUserId, authLoading, partnerLoading]);

  const today = useMemo(() => new Date(), []);

  // Partners should not be able to update profile data
  const setDueDate = useCallback(
    async (date: Date | null) => {
      if (isPartnerView) return; // Partners can't edit
      setDueDateState(date);
      if (!user) return;

      try {
        const { error } = await supabase
          .from("pregnancy_profiles")
          .update({ due_date: date ? format(date, "yyyy-MM-dd") : null })
          .eq("user_id", user.id);

        if (error) {
          console.error("Failed to save due date:", error);
          refetch();
        } else {
          queryClient.invalidateQueries({ queryKey: ["pregnancyProfile", user.id] });
        }
      } catch (err) {
        console.error("Failed to save due date:", err);
        refetch();
      }
    },
    [user, isPartnerView, refetch, queryClient]
  );

  const setBabyName = useCallback(
    async (name: string | null) => {
      if (isPartnerView) return; // Partners can't edit
      setBabyNameState(name);
      if (!user) return;

      try {
        const { error } = await supabase
          .from("pregnancy_profiles")
          .update({ baby_name: name })
          .eq("user_id", user.id);

        if (error) {
          console.error("Failed to save baby name:", error);
          refetch();
        } else {
          queryClient.invalidateQueries({ queryKey: ["pregnancyProfile", user.id] });
        }
      } catch (err) {
        console.error("Failed to save baby name:", err);
        refetch();
      }
    },
    [user, isPartnerView, refetch, queryClient]
  );

  const setBabySex = useCallback(
    async (sex: BabySex) => {
      if (isPartnerView) return; // Partners can't edit
      setBabySexState(sex);
      if (!user) return;

      try {
        const { error } = await supabase
          .from("pregnancy_profiles")
          .update({ baby_sex: sex })
          .eq("user_id", user.id);

        if (error) {
          console.error("Failed to save baby sex:", error);
          refetch();
        } else {
          queryClient.invalidateQueries({ queryKey: ["pregnancyProfile", user.id] });
        }
      } catch (err) {
        console.error("Failed to save baby sex:", err);
        refetch();
      }
    },
    [user, isPartnerView, refetch, queryClient]
  );

  const setMomName = useCallback(
    async (name: string | null) => {
      if (isPartnerView) return; // Partners can't edit
      setMomNameState(name);
      if (!user) return;

      try {
        const { error } = await supabase
          .from("pregnancy_profiles")
          .update({ mom_name: name })
          .eq("user_id", user.id);

        if (error) {
          console.error("Failed to save mom name:", error);
          refetch();
        } else {
          queryClient.invalidateQueries({ queryKey: ["pregnancyProfile", user.id] });
        }
      } catch (err) {
        console.error("Failed to save mom name:", err);
        refetch();
      }
    },
    [user, isPartnerView, refetch, queryClient]
  );

  const setPartnerName = useCallback(
    async (name: string | null) => {
      if (isPartnerView) return; // Partners can't edit
      setPartnerNameState(name);
      if (!user) return;

      try {
        const { error } = await supabase
          .from("pregnancy_profiles")
          .update({ partner_name: name })
          .eq("user_id", user.id);

        if (error) {
          console.error("Failed to save partner name:", error);
          refetch();
        } else {
          queryClient.invalidateQueries({ queryKey: ["pregnancyProfile", user.id] });
        }
      } catch (err) {
        console.error("Failed to save partner name:", err);
        refetch();
      }
    },
    [user, isPartnerView, refetch, queryClient]
  );

  const pregnancyMetrics = useMemo(() => {
    if (!dueDate) {
      return {
        currentWeek: 0,
        daysRemaining: 280,
        trimester: 1 as const,
        progress: 0,
      };
    }

    const weeksUntilDue = differenceInWeeks(dueDate, today);
    const rawWeek = TOTAL_PREGNANCY_WEEKS - weeksUntilDue;
    const currentWeek = Math.max(0, Math.min(42, rawWeek));
    const daysRemaining = Math.max(0, differenceInDays(dueDate, today));

    let trimester: 1 | 2 | 3 = 1;
    if (currentWeek > 27) {
      trimester = 3;
    } else if (currentWeek > 13) {
      trimester = 2;
    }

    const progress = Math.min(100, Math.max(0, (currentWeek / TOTAL_PREGNANCY_WEEKS) * 100));

    return { currentWeek, daysRemaining, trimester, progress };
  }, [dueDate, today]);

  const isProfileLoading = authLoading || partnerLoading || isProfileFetching;

  return {
    dueDate,
    setDueDate,
    today,
    ...pregnancyMetrics,
    babyName: babyNameState,
    setBabyName,
    babySex: babySexState,
    setBabySex,
    momName: momNameState,
    setMomName,
    partnerName: partnerNameState,
    setPartnerName,
    isProfileLoading,
    isOnboardingComplete: isOnboardingCompleteState,
    setIsOnboardingComplete: setIsOnboardingCompleteState,
    refetch,
  };
}