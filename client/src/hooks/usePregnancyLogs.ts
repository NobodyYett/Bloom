// client/src/hooks/usePregnancyLogs.ts
// CRUD operations for pregnancy check-ins with atomic save support

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerAccess } from "@/contexts/PartnerContext";

// ============================================
// Types
// ============================================

export type CheckinMood = "happy" | "neutral" | "sad";
export type CheckinEnergy = "high" | "medium" | "low";
export type CheckinSlot = "morning" | "evening" | "night";

export interface PregnancyCheckin {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  checkin_date: string;
  week: number | null;
  slot: CheckinSlot;
  mood: CheckinMood;
  energy: CheckinEnergy | null;
  symptoms: string | null;
  entry_group_id: string | null;
}

export interface CreateCheckinInput {
  date: string;
  week: number;
  slot: CheckinSlot;
  mood: CheckinMood;
  energy?: CheckinEnergy;
  symptoms?: string;
  notes?: string; // For backward compatibility - ignored if using atomic save
}

export interface CreateJournalInput {
  entry_date?: string;
  title?: string;
  body: string;
  mood?: string;
  symptoms?: string[];
  image_path?: string;
}

export interface AtomicSaveResult {
  checkin: PregnancyCheckin;
  journal: {
    id: string;
    entry_date: string;
    title: string | null;
    body: string;
    mood: string | null;
    symptoms: string[];
    image_path: string | null;
    entry_group_id: string | null;
    created_at: string;
  } | null;
  entry_group_id: string | null;
}

// ============================================
// Fetch Functions
// ============================================

async function fetchTodayCheckins(
  userId: string,
  date: string
): Promise<PregnancyCheckin[]> {
  const { data, error } = await supabase
    .from("pregnancy_checkins")
    .select("*")
    .eq("user_id", userId)
    .eq("checkin_date", date)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchRecentCheckins(
  userId: string,
  limit: number = 7
): Promise<PregnancyCheckin[]> {
  const { data, error } = await supabase
    .from("pregnancy_checkins")
    .select("*")
    .eq("user_id", userId)
    .order("checkin_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function fetchWeekCheckins(
  userId: string,
  startDate: string,
  endDate: string
): Promise<PregnancyCheckin[]> {
  const { data, error } = await supabase
    .from("pregnancy_checkins")
    .select("*")
    .eq("user_id", userId)
    .gte("checkin_date", startDate)
    .lte("checkin_date", endDate)
    .order("checkin_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

// ============================================
// Hooks
// ============================================

/**
 * Fetch today's check-ins
 */
export function useTodayLogs(date: string) {
  const { user } = useAuth();
  const { isPartnerView, momUserId } = usePartnerAccess();
  
  const userId = isPartnerView ? momUserId : user?.id;

  return useQuery({
    queryKey: ["checkins", "today", userId, date],
    queryFn: () => fetchTodayCheckins(userId!, date),
    enabled: !!userId && !!date,
  });
}

/**
 * Fetch recent check-ins (for week-at-a-glance)
 */
export function useRecentCheckins(limit: number = 7) {
  const { user } = useAuth();
  const { isPartnerView, momUserId } = usePartnerAccess();
  
  const userId = isPartnerView ? momUserId : user?.id;

  return useQuery({
    queryKey: ["checkins", "recent", userId, limit],
    queryFn: () => fetchRecentCheckins(userId!, limit),
    enabled: !!userId,
  });
}

/**
 * Fetch check-ins for a date range
 */
export function useWeekCheckins(startDate: string, endDate: string) {
  const { user } = useAuth();
  const { isPartnerView, momUserId } = usePartnerAccess();
  
  const userId = isPartnerView ? momUserId : user?.id;

  return useQuery({
    queryKey: ["checkins", "week", userId, startDate, endDate],
    queryFn: () => fetchWeekCheckins(userId!, startDate, endDate),
    enabled: !!userId && !!startDate && !!endDate,
  });
}

/**
 * Fetch check-ins for the last 7 days (for weekly summary)
 * For partners, this now returns empty - use usePartnerWeeklyInsights instead
 */
export function useWeekLogs() {
  const { user } = useAuth();
  const { isPartnerView } = usePartnerAccess();
  
  // Mom only - partners should use usePartnerWeeklyInsights
  const userId = user?.id;
  
  // Calculate last 7 days
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const startDate = weekAgo.toISOString().split("T")[0];
  const endDate = today.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["checkins", "weekLogs", userId, startDate, endDate],
    queryFn: () => fetchWeekCheckins(userId!, startDate, endDate),
    // Disable for partners - they should use usePartnerWeeklyInsights
    enabled: !!userId && !isPartnerView,
  });
}

// ============================================
// Partner Weekly Insights (RPC-based)
// ============================================

export interface PartnerWeekData {
  week_start: string;
  week_end: string;
  days_logged: number;
  mood_counts: Record<string, number>;
  energy_counts: Record<string, number>;
  slot_counts: Record<string, number>;
  top_symptoms: Array<{ symptom: string; count: number }>;
}

export interface PartnerInsightsDeltas {
  days_logged: number;
  mood: { happy: number; neutral: number; sad: number };
  energy: { high: number; medium: number; low: number };
  symptoms: {
    increased: Array<{ symptom: string; delta: number }>;
    decreased: Array<{ symptom: string; delta: number }>;
    new: Array<{ symptom: string; count: number }>;
    gone: Array<{ symptom: string; count: number }>;
  };
}

export interface PartnerInsightsWithTrends {
  mom_user_id: string;
  current: PartnerWeekData;
  previous: PartnerWeekData;
  deltas: PartnerInsightsDeltas;
  generated_at: string;
}

// Legacy type for backward compatibility
export interface PartnerInsightsData {
  mom_user_id: string;
  week_start: string;
  week_end: string;
  days_logged: number;
  mood_counts: Record<string, number>;
  energy_counts: Record<string, number>;
  slot_counts: Record<string, number>;
  top_symptoms: Array<{ symptom: string; count: number }>;
  generated_at: string;
}

/**
 * Fetch aggregated weekly insights WITH TRENDS for partner view
 * Uses RPC to get derived data + week-over-week comparison
 */
export function usePartnerWeeklyInsights() {
  const { isPartnerView, momUserId } = usePartnerAccess();
  
  // Calculate last 7 days
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const weekStart = weekAgo.toISOString().split("T")[0];
  const weekEnd = today.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["partner", "weeklyInsightsWithTrends", momUserId, weekStart, weekEnd],
    queryFn: async () => {
      if (!momUserId) throw new Error("No mom linked");
      
      const { data, error } = await supabase.rpc("get_partner_weekly_insights_with_trends", {
        p_mom_user_id: momUserId,
        p_week_start: weekStart,
        p_week_end: weekEnd,
      });

      if (error) throw error;
      return data as PartnerInsightsWithTrends;
    },
    enabled: isPartnerView && !!momUserId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Create a check-in (single, without journal)
 */
export function useCreatePregnancyLog() {
  const { user } = useAuth();
  const { isPartnerView } = usePartnerAccess();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCheckinInput) => {
      if (!user) throw new Error("Not authenticated");
      if (isPartnerView) throw new Error("Only mom can create check-ins");

      const { data, error } = await supabase
        .from("pregnancy_checkins")
        .insert({
          user_id: user.id,
          checkin_date: input.date,
          week: input.week,
          slot: input.slot,
          mood: input.mood,
          energy: input.energy || null,
          symptoms: input.symptoms || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as PregnancyCheckin;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkins"] });
    },
  });
}

/**
 * Atomic save: check-in + journal together
 * Uses RPC function for transaction safety
 */
export function useAtomicCheckinAndJournal() {
  const { user } = useAuth();
  const { isPartnerView } = usePartnerAccess();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      checkin,
      journal,
    }: {
      checkin: CreateCheckinInput;
      journal?: CreateJournalInput;
    }): Promise<AtomicSaveResult> => {
      if (!user) throw new Error("Not authenticated");
      if (isPartnerView) throw new Error("Only mom can create entries");

      // Build payloads
      const checkinPayload = {
        checkin_date: checkin.date,
        week: checkin.week,
        slot: checkin.slot,
        mood: checkin.mood,
        energy: checkin.energy || null,
        symptoms: checkin.symptoms || null,
      };

      const journalPayload = journal?.body?.trim()
        ? {
            entry_date: journal.entry_date || checkin.date,
            title: journal.title || null,
            body: journal.body,
            mood: journal.mood || null,
            symptoms: journal.symptoms || [],
            image_path: journal.image_path || null,
          }
        : null;

      // Call RPC function
      const { data, error } = await supabase.rpc("save_checkin_and_journal", {
        checkin_payload: checkinPayload,
        journal_payload: journalPayload,
      });

      if (error) throw error;
      return data as AtomicSaveResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkins"] });
      queryClient.invalidateQueries({ queryKey: ["journal"] });
    },
  });
}

/**
 * Update a check-in
 */
export function useUpdateCheckin() {
  const { user } = useAuth();
  const { isPartnerView } = usePartnerAccess();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<CreateCheckinInput> & { id: string }) => {
      if (!user) throw new Error("Not authenticated");
      if (isPartnerView) throw new Error("Only mom can update check-ins");

      const updateData: Record<string, unknown> = {};
      if (input.date) updateData.checkin_date = input.date;
      if (input.week !== undefined) updateData.week = input.week;
      if (input.slot) updateData.slot = input.slot;
      if (input.mood) updateData.mood = input.mood;
      if (input.energy !== undefined) updateData.energy = input.energy || null;
      if (input.symptoms !== undefined) updateData.symptoms = input.symptoms || null;

      const { data, error } = await supabase
        .from("pregnancy_checkins")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data as PregnancyCheckin;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkins"] });
    },
  });
}

/**
 * Delete a check-in
 */
export function useDeleteCheckin() {
  const { user } = useAuth();
  const { isPartnerView } = usePartnerAccess();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      if (isPartnerView) throw new Error("Only mom can delete check-ins");

      const { error } = await supabase
        .from("pregnancy_checkins")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkins"] });
    },
  });
}

// ============================================
// Stats Helpers
// ============================================

/**
 * Calculate mood distribution from check-ins
 */
export function calculateMoodStats(checkins: PregnancyCheckin[]): {
  happy: number;
  neutral: number;
  sad: number;
} {
  const stats = { happy: 0, neutral: 0, sad: 0 };
  checkins.forEach((c) => {
    if (c.mood in stats) {
      stats[c.mood as keyof typeof stats]++;
    }
  });
  return stats;
}

/**
 * Get most common symptom from check-ins
 */
export function getTopSymptom(checkins: PregnancyCheckin[]): string | null {
  const symptomCount: Record<string, number> = {};
  
  checkins.forEach((c) => {
    if (c.symptoms) {
      c.symptoms.split(",").forEach((s) => {
        const trimmed = s.trim().toLowerCase();
        if (trimmed) {
          symptomCount[trimmed] = (symptomCount[trimmed] || 0) + 1;
        }
      });
    }
  });

  const entries = Object.entries(symptomCount);
  if (entries.length === 0) return null;
  
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/**
 * Get most common energy level from check-ins
 */
export function getTopEnergy(
  checkins: PregnancyCheckin[]
): CheckinEnergy | null {
  const energyCount: Record<string, number> = {};
  
  checkins.forEach((c) => {
    if (c.energy) {
      energyCount[c.energy] = (energyCount[c.energy] || 0) + 1;
    }
  });

  const entries = Object.entries(energyCount);
  if (entries.length === 0) return null;
  
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0] as CheckinEnergy;
}