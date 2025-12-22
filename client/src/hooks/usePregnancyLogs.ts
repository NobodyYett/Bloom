// client/src/hooks/usePregnancyLogs.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

// ---- helpers ----

type Mood = "happy" | "neutral" | "sad";

type CreateLogInput = {
  date: string; // "yyyy-MM-dd"
  week: number;
  mood: Mood;
  symptoms?: string;
  notes?: string;
};

// Normalize Supabase column names to match UI expectations.
// Supabase returns `created_at`, while some UI code expects `createdAt`.
function normalizeLogRow<T extends Record<string, any>>(row: T): T & { createdAt?: string } {
  if (!row) return row as any;

  const createdAt = (row as any).createdAt ?? (row as any).created_at;
  if (createdAt !== undefined && (row as any).createdAt === undefined) {
    return { ...(row as any), createdAt };
  }
  return row as any;
}

export function getTimeOfDaySlot(
  d: Date = new Date(),
): "morning" | "afternoon" | "evening" {
  const hour = d.getHours();
  if (hour < 12) return "morning"; // before noon
  if (hour < 18) return "afternoon"; // 12:00–17:59
  return "evening"; // 18:00+
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

// Backwards-compat wrapper (in case anything else still imports it)
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

      const now = new Date();
      const timeOfDay = getTimeOfDaySlot(now);

      const { data, error } = await supabase
        .from("pregnancy_logs")
        .insert({
          user_id: user.id,
          date: input.date,
          week: input.week,
          mood: input.mood,
          symptoms: input.symptoms ?? null,
          notes: input.notes ?? null,
          time_of_day: timeOfDay,
        })
        .select("*")
        .single();

      if (error) throw error;
      return normalizeLogRow(data as any);
    },
    onSuccess: (_data, vars) => {
      // refresh overall list + today's list
      queryClient.invalidateQueries({ queryKey: ["pregnancyLogs"] });
      queryClient.invalidateQueries({
        queryKey: ["pregnancyLogs", "today", vars.date],
      });
    },
  });
}
