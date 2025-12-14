// client/src/hooks/usePregnancyState.ts (FINAL LOOP-FIXING VERSION)

import { useMemo, useState, useEffect } from "react";
import { differenceInWeeks, differenceInDays } from "date-fns";
import { useQuery } from "@tanstack/react-query"; 
import { useAuth } from "@/hooks/useAuth"; 
import { supabase } from "@/lib/supabase";

const TOTAL_PREGNANCY_WEEKS = 40;

export type BabySex = "boy" | "girl" | "unknown";

export interface PregnancyState {
  dueDate: Date | null; 
  setDueDate: (date: Date | null) => void; 
  isProfileLoading: boolean; 
  isOnboardingComplete: boolean; 
  // FIX: Exposed setter to manually update the completion flag locally
  setIsOnboardingComplete: (isComplete: boolean) => void; 
  // FIX: Expose refetch
  refetch: () => void;

  currentWeek: number;
  daysRemaining: number;
  today: Date;
  trimester: 1 | 2 | 3;
  progress: number; // 0–100

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

  // 1. Fetch profile data using React Query
  const { data: profile, isLoading: isProfileFetching, refetch } = useQuery({
    queryKey: ["pregnancyProfile", user?.id],
    queryFn: () => fetchProfileData(user?.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  // Local state initialized to null/unknown/false until data is loaded
  const [dueDate, setDueDateState] = useState<Date | null>(null);
  const [babyNameState, setBabyNameState] = useState<string | null>(null);
  const [babySexState, setBabySexState] = useState<BabySex>("unknown");
  const [isOnboardingCompleteState, setIsOnboardingCompleteState] = useState(false); 

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

  const setDueDate = (date: Date | null) => {
    setDueDateState(date);
    refetch(); 
  };
  const setBabyName = (name: string | null) => {
    setBabyNameState(name);
    refetch();
  };
  const setBabySex = (sex: BabySex) => {
    setBabySexState(sex);
    refetch();
  };


  // 4. Pregnancy metrics calculation (omitted for brevity)
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
    // EXPOSE FIXES
    setIsOnboardingComplete: setIsOnboardingCompleteState, 
    refetch, 
  };
}