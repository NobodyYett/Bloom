// client/src/hooks/usePregnancyLogs.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerAccess } from "@/contexts/PartnerContext";
import { type CheckinSlot, getSuggestedSlot } from "@/lib/checkinSlots";
import { subDays, format } from "date-fns";

// ---- helpers ----

type Mood = "happy" | "neutral" | "sad";
type Energy = "high" | "medium" | "low";

type CreateLogInput = {
  date: string; // "yyyy-MM-dd"
  week: number;
  mood: Mood;
  slot?: CheckinSlot;
  energy?: Energy;
  symptoms?: string;
  notes?: string;
};

// Normalize Supabase column names to match UI expectations.
function normalizeLogRow<T extends Record<string, any>>(row: T): T & { createdAt?: string } {
  if (!row) return row as any;

  const createdAt = (row as any).createdAt ?? (row as any).created_at;
  if (createdAt !== undefined && (row as any).createdAt === undefined) {
    return { ...(row as any), createdAt };
  }
  return row as any;
}

// Legacy helper - maps to new slot system for backwards compat
export function getTimeOfDaySlot(
  d: Date = new Date(),
): "morning" | "afternoon" | "evening" {
  const hour = d.getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

// ---- queries ----

// All logs for current user (used on Journal page)
export function usePregnancyLogs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pregnancyLogs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("pregnancy_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(normalizeLogRow);
    },
  });
}

// All logs for a *specific* date (used by DailyCheckIn)
export function useTodayLogs(date: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pregnancyLogs", "today", user?.id, date],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("pregnancy_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", date)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []).map(normalizeLogRow);
    },
  });
}

// Logs for last 7 days (used by Weekly Summary)
// For partners, fetches the mom's logs (summary only - notes hidden in UI)
export function useWeekLogs() {
  const { user } = useAuth();
  const { isPartnerView, momUserId } = usePartnerAccess();
  
  // When in partner view, fetch mom's logs; otherwise fetch own logs
  const targetUserId = isPartnerView ? momUserId : user?.id;

  return useQuery({
    queryKey: ["pregnancyLogs", "week", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      if (!targetUserId) return [];

      const today = new Date();
      const sevenDaysAgo = subDays(today, 6); // Include today = 7 days total
      const startDate = format(sevenDaysAgo, "yyyy-MM-dd");
      const endDate = format(today, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("pregnancy_logs")
        .select("*")
        .eq("user_id", targetUserId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(normalizeLogRow);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Backwards-compat wrapper
export function useTodayLog(date: string) {
  const result = useTodayLogs(date);
  return {
    ...result,
    data: result.data?.[0] ?? null,
  };
}

// ---- mutation ----

export function useCreatePregnancyLog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLogInput) => {
      if (!user) {
        throw new Error("Not authenticated");
      }

      const slot = input.slot ?? getSuggestedSlot();

      const { data, error } = await supabase
        .from("pregnancy_logs")
        .insert({
          user_id: user.id,
          date: input.date,
          week: input.week,
          mood: input.mood,
          energy: input.energy ?? null,
          symptoms: input.symptoms ?? null,
          notes: input.notes ?? null,
          slot: slot,
          time_of_day: slot,
        })
        .select("*")
        .single();

      if (error) throw error;
      return normalizeLogRow(data as any);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pregnancyLogs"] });
      queryClient.invalidateQueries({
        queryKey: ["pregnancyLogs", "today", user?.id, vars.date],
      });
      queryClient.invalidateQueries({
        queryKey: ["pregnancyLogs", "week", user?.id],
      });
    },
  });
}