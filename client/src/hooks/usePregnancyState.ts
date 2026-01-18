// client/src/hooks/usePregnancyState.ts
// Central state management for pregnancy/postpartum lifecycle

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { differenceInDays, differenceInWeeks, parseISO } from "date-fns";

// ============================================
// Types
// ============================================

export type AppMode = "pregnancy" | "infancy"; // "infancy" = postpartum mode
export type BabySex = "boy" | "girl" | "unknown";

interface PregnancyProfile {
  user_id: string;
  due_date: string | null;
  baby_name: string | null;
  baby_sex: BabySex;
  mom_name: string | null;
  partner_name: string | null;
  app_mode: AppMode;
  baby_birth_date: string | null;
  onboarding_complete: boolean;
  infancy_onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

interface PregnancyState {
  // Loading states
  isProfileLoading: boolean;
  isOnboardingComplete: boolean;
  
  // Core dates
  dueDate: Date | null;
  babyBirthDate: Date | null;
  
  // Mode
  appMode: AppMode;
  
  // Computed pregnancy values
  currentWeek: number;
  daysRemaining: number;
  trimester: 1 | 2 | 3;
  
  // Computed postpartum values
  babyAgeWeeks: number;
  babyAgeDays: number;
  postpartumWeek: number; // 1-12+ for recovery tracking
  
  // Baby info
  babyName: string | null;
  babySex: BabySex;
  
  // Parent names
  momName: string | null;
  partnerName: string | null;
  
  // Setters
  setDueDate: (date: Date | null) => Promise<void>;
  setBabyName: (name: string | null) => Promise<void>;
  setBabySex: (sex: BabySex) => Promise<void>;
  setMomName: (name: string | null) => Promise<void>;
  setPartnerName: (name: string | null) => Promise<void>;
  
  // Mode transitions
  transitionToInfancy: (birthDate: Date) => Promise<void>;
  setInfancyOnboardingComplete: (complete: boolean) => Promise<void>;
  
  // Refresh
  refetch: () => Promise<void>;
}

// ============================================
// Helper Functions
// ============================================

function calculatePregnancyWeek(dueDate: Date): number {
  const today = new Date();
  const daysUntilDue = differenceInDays(dueDate, today);
  const weeksRemaining = Math.floor(daysUntilDue / 7);
  const currentWeek = 40 - weeksRemaining;
  return Math.max(1, Math.min(42, currentWeek));
}

function calculateDaysRemaining(dueDate: Date): number {
  const today = new Date();
  return Math.max(0, differenceInDays(dueDate, today));
}

function calculateTrimester(week: number): 1 | 2 | 3 {
  if (week <= 13) return 1;
  if (week <= 27) return 2;
  return 3;
}

function calculateBabyAge(birthDate: Date): { weeks: number; days: number } {
  const today = new Date();
  const totalDays = differenceInDays(today, birthDate);
  return {
    weeks: Math.floor(totalDays / 7),
    days: totalDays % 7,
  };
}

function calculatePostpartumWeek(birthDate: Date): number {
  const today = new Date();
  const weeks = differenceInWeeks(today, birthDate);
  return Math.max(1, weeks + 1); // 1-indexed
}

// ============================================
// Hook
// ============================================

export function usePregnancyState(): PregnancyState {
  const { user } = useAuth();
  
  const [profile, setProfile] = useState<PregnancyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("pregnancy_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error("Failed to fetch pregnancy profile:", err);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("pregnancy_profile_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pregnancy_profiles",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            setProfile(payload.new as PregnancyProfile);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Parse dates
  const dueDate = useMemo(() => {
    if (!profile?.due_date) return null;
    try {
      return parseISO(profile.due_date);
    } catch {
      return null;
    }
  }, [profile?.due_date]);

  const babyBirthDate = useMemo(() => {
    if (!profile?.baby_birth_date) return null;
    try {
      return parseISO(profile.baby_birth_date);
    } catch {
      return null;
    }
  }, [profile?.baby_birth_date]);

  // Computed values
  const currentWeek = useMemo(() => {
    if (!dueDate) return 0;
    return calculatePregnancyWeek(dueDate);
  }, [dueDate]);

  const daysRemaining = useMemo(() => {
    if (!dueDate) return 0;
    return calculateDaysRemaining(dueDate);
  }, [dueDate]);

  const trimester = useMemo(() => {
    return calculateTrimester(currentWeek);
  }, [currentWeek]);

  const babyAge = useMemo(() => {
    if (!babyBirthDate) return { weeks: 0, days: 0 };
    return calculateBabyAge(babyBirthDate);
  }, [babyBirthDate]);

  const postpartumWeek = useMemo(() => {
    if (!babyBirthDate) return 0;
    return calculatePostpartumWeek(babyBirthDate);
  }, [babyBirthDate]);

  // Setters
  const setDueDate = useCallback(async (date: Date | null) => {
    if (!user) return;
    const { error } = await supabase
      .from("pregnancy_profiles")
      .update({ due_date: date?.toISOString().split("T")[0] || null })
      .eq("user_id", user.id);
    if (error) throw error;
  }, [user]);

  const setBabyName = useCallback(async (name: string | null) => {
    if (!user) return;
    const { error } = await supabase
      .from("pregnancy_profiles")
      .update({ baby_name: name })
      .eq("user_id", user.id);
    if (error) throw error;
  }, [user]);

  const setBabySex = useCallback(async (sex: BabySex) => {
    if (!user) return;
    const { error } = await supabase
      .from("pregnancy_profiles")
      .update({ baby_sex: sex })
      .eq("user_id", user.id);
    if (error) throw error;
  }, [user]);

  const setMomName = useCallback(async (name: string | null) => {
    if (!user) return;
    const { error } = await supabase
      .from("pregnancy_profiles")
      .update({ mom_name: name })
      .eq("user_id", user.id);
    if (error) throw error;
  }, [user]);

  const setPartnerName = useCallback(async (name: string | null) => {
    if (!user) return;
    const { error } = await supabase
      .from("pregnancy_profiles")
      .update({ partner_name: name })
      .eq("user_id", user.id);
    if (error) throw error;
  }, [user]);

  const transitionToInfancy = useCallback(async (birthDate: Date) => {
    if (!user) return;
    const { error } = await supabase
      .from("pregnancy_profiles")
      .update({
        app_mode: "infancy",
        baby_birth_date: birthDate.toISOString(),
      })
      .eq("user_id", user.id);
    if (error) throw error;
  }, [user]);

  const setInfancyOnboardingComplete = useCallback(async (complete: boolean) => {
    if (!user) return;
    const { error } = await supabase
      .from("pregnancy_profiles")
      .update({ infancy_onboarding_complete: complete })
      .eq("user_id", user.id);
    if (error) throw error;
  }, [user]);

  return {
    isProfileLoading: isLoading,
    isOnboardingComplete: profile?.onboarding_complete ?? false,
    
    dueDate,
    babyBirthDate,
    
    appMode: profile?.app_mode ?? "pregnancy",
    
    currentWeek,
    daysRemaining,
    trimester,
    
    babyAgeWeeks: babyAge.weeks,
    babyAgeDays: babyAge.days,
    postpartumWeek,
    
    babyName: profile?.baby_name ?? null,
    babySex: profile?.baby_sex ?? "unknown",
    
    momName: profile?.mom_name ?? null,
    partnerName: profile?.partner_name ?? null,
    
    setDueDate,
    setBabyName,
    setBabySex,
    setMomName,
    setPartnerName,
    
    transitionToInfancy,
    setInfancyOnboardingComplete,
    
    refetch: fetchProfile,
  };
}