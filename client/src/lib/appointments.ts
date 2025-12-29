import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Appointment {
  id: string;
  user_id: string;
  title: string;
  starts_at: string; // ISO string
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateAppointmentInput = {
  title: string;
  starts_at: string; // ISO string
  location?: string | null;
  notes?: string | null;
};

export type DeleteAppointmentInput = {
  id: string;
  userId: string;
};

// ---- Queries ----

async function fetchAppointments(userId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("pregnancy_appointments")
    .select("*")
    .eq("user_id", userId) // ✅ SAFETY
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

async function fetchNextAppointment(userId: string): Promise<Appointment | null> {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("pregnancy_appointments")
    .select("*")
    .eq("user_id", userId) // ✅ SAFETY
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error; // no rows
  return data ?? null;
}

export function useAppointments(userId?: string) {
  return useQuery({
    queryKey: ["appointments", userId],
    enabled: !!userId,
    queryFn: () => fetchAppointments(userId as string),
  });
}

export function useNextAppointment(userId?: string) {
  return useQuery({
    queryKey: ["next-appointment", userId],
    enabled: !!userId,
    queryFn: () => fetchNextAppointment(userId as string),
  });
}

// ---- Mutations ----

export function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAppointmentInput) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user)
        throw userError ?? new Error("Not logged in");

      const { data, error } = await supabase
        .from("pregnancy_appointments")
        .insert({
          user_id: userData.user.id,
          title: input.title,
          starts_at: input.starts_at,
          location: input.location ?? null,
          notes: input.notes ?? null,
        })
        .select("*")
        .single();

      if (error) throw error;
      return data as Appointment;
    },
    onSuccess: (_created) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["next-appointment"] });
    },
  });
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, userId }: DeleteAppointmentInput) => {
      const { error } = await supabase
        .from("pregnancy_appointments")
        .delete()
        .eq("id", id)
        .eq("user_id", userId); // ✅ SAFETY

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["next-appointment"] });
    },
  });
}
