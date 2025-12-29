// client/src/hooks/usePregnancyState.ts (FIXED - persists to Supabase)

import { useMemo, useState, useEffect, useCallback } from "react";
import { differenceInWeeks, differenceInDays, format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
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
}

// Data fetching function for React Query
const fetchProfileData = async (userId: string | undefined) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("pregnancy_profiles")
    .select("due_date, baby_name, baby_sex, onboarding_complete")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data;
};

export function usePregnancyState(): PregnancyState {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // 1. Fetch profile data using React Query
  const {
    data: profile,
    isLoading: isProfileFetching,
    refetch,
  } = useQuery({
    queryKey: ["pregnancyProfile", user?.id],
    queryFn: () => fetchProfileData(user?.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  // Local state initialized to null/unknown/false until data is loaded
  const [dueDate, setDueDateState] = useState<Date | null>(null);
  const [babyNameState, setBabyNameState] = useState<string | null>(null);
  const [babySexState, setBabySexState] = useState<BabySex>("unknown");
  const [isOnboardingCompleteState, setIsOnboardingCompleteState] =
    useState(false);

  // 2. Sync fetched data to component state
  useEffect(() => {
    if (profile) {
      setDueDateState(profile.due_date ? new Date(profile.due_date) : null);
      setBabyNameState(profile.baby_name ?? null);
      setBabySexState(profile.baby_sex ?? "unknown");
      setIsOnboardingCompleteState(profile.onboarding_complete ?? false);
    } else if (!isProfileFetching && user && !authLoading) {
      // New user, profile not yet created/fetched
      setDueDateState(null);
      setBabyNameState(null);
      setBabySexState("unknown");
      setIsOnboardingCompleteState(false);
    }
  }, [profile, isProfileFetching, user, authLoading]);

  const today = useMemo(() => new Date(), []);

  // 3. FIXED: Setters now persist to Supabase

  const setDueDate = useCallback(
    async (date: Date | null) => {
      // Update local state immediately for responsive UI
      setDueDateState(date);

      if (!user) {
        console.error("Cannot save due date: no user logged in");
        return;
      }

      try {
        const { error } = await supabase
          .from("pregnancy_profiles")
          .update({
            due_date: date ? format(date, "yyyy-MM-dd") : null,
          })
          .eq("user_id", user.id);

        if (error) {
          console.error("Failed to save due date:", error);
          // Revert local state on error
          refetch();
        } else {
          // Invalidate cache so other components get fresh data
          queryClient.invalidateQueries({
            queryKey: ["pregnancyProfile", user.id],
          });
        }
      } catch (err) {
        console.error("Failed to save due date:", err);
        refetch();
      }
    },
    [user, refetch, queryClient]
  );

  const setBabyName = useCallback(
    async (name: string | null) => {
      // Update local state immediately for responsive UI
      setBabyNameState(name);

      if (!user) {
        console.error("Cannot save baby name: no user logged in");
        return;
      }

      try {
        const { error } = await supabase
          .from("pregnancy_profiles")
          .update({
            baby_name: name,
          })
          .eq("user_id", user.id);

        if (error) {
          console.error("Failed to save baby name:", error);
          // Revert local state on error
          refetch();
        } else {
          // Invalidate cache so other components get fresh data
          queryClient.invalidateQueries({
            queryKey: ["pregnancyProfile", user.id],
          });
        }
      } catch (err) {
        console.error("Failed to save baby name:", err);
        refetch();
      }
    },
    [user, refetch, queryClient]
  );

  const setBabySex = useCallback(
    async (sex: BabySex) => {
      // Update local state immediately for responsive UI
      setBabySexState(sex);

      if (!user) {
        console.error("Cannot save baby sex: no user logged in");
        return;
      }

      try {
        const { error } = await supabase
          .from("pregnancy_profiles")
          .update({
            baby_sex: sex,
          })
          .eq("user_id", user.id);

        if (error) {
          console.error("Failed to save baby sex:", error);
          // Revert local state on error
          refetch();
        } else {
          // Invalidate cache so other components get fresh data
          queryClient.invalidateQueries({
            queryKey: ["pregnancyProfile", user.id],
          });
        }
      } catch (err) {
        console.error("Failed to save baby sex:", err);
        refetch();
      }
    },
    [user, refetch, queryClient]
  );

  // 4. Pregnancy metrics calculation
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

    const progress = Math.min(
      100,
      Math.max(0, (currentWeek / TOTAL_PREGNANCY_WEEKS) * 100)
    );

    return {
      currentWeek,
      daysRemaining,
      trimester,
      progress,
    };
  }, [dueDate, today]);

  // Total loading state combines auth and profile fetching
  const isProfileLoading = authLoading || isProfileFetching;

  return {
    dueDate,
    setDueDate,
    today,
    ...pregnancyMetrics,
    babyName: babyNameState,
    setBabyName,
    babySex: babySexState,
    setBabySex,
    isProfileLoading,
    isOnboardingComplete: isOnboardingCompleteState,
    setIsOnboardingComplete: setIsOnboardingCompleteState,
    refetch,
  };
}