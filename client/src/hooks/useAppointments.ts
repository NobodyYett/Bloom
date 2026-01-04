// client/src/hooks/useAppointments.ts

import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  scheduleAppointmentReminders,
  cancelAppointmentReminders,
  isAppointmentRemindersEnabled,
  getDefaultReminderTimes,
} from "@/lib/notifications";

export interface Appointment {
  id: string;
  user_id: string;
  title: string;
  starts_at: string; // ISO string
  location: string | null;
  notes: string | null;
  reminder_minutes: number[] | null; // Custom reminder times for this appointment
  created_at: string;
  updated_at: string;
}

export type CreateAppointmentInput = {
  title: string;
  starts_at: string; // ISO string
  location?: string | null;
  notes?: string | null;
  reminder_minutes?: number[] | null; // Optional custom reminder times
};

export type UpdateAppointmentInput = {
  id: string;
  userId: string;
  title?: string;
  starts_at?: string;
  location?: string | null;
  notes?: string | null;
  reminder_minutes?: number[] | null;
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
    .eq("user_id", userId)
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

async function fetchNextAppointment(userId: string): Promise<Appointment | null> {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("pregnancy_appointments")
    .select("*")
    .eq("user_id", userId)
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
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

      // Use provided reminder times or defaults
      const reminderTimes = input.reminder_minutes ?? [
        getDefaultReminderTimes().firstReminder,
        getDefaultReminderTimes().secondReminder,
      ];

      const { data, error } = await supabase
        .from("pregnancy_appointments")
        .insert({
          user_id: userData.user.id,
          title: input.title,
          starts_at: input.starts_at,
          location: input.location ?? null,
          notes: input.notes ?? null,
          reminder_minutes: reminderTimes,
        })
        .select("*")
        .single();

      if (error) throw error;

      // Schedule notifications
      if (isAppointmentRemindersEnabled()) {
        await scheduleAppointmentReminders(
          {
            id: data.id,
            title: data.title,
            starts_at: data.starts_at,
            location: data.location,
          },
          reminderTimes
        );
      }

      return data as Appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["next-appointment"] });
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateAppointmentInput) => {
      const updateData: Record<string, any> = {};
      
      if (input.title !== undefined) updateData.title = input.title;
      if (input.starts_at !== undefined) updateData.starts_at = input.starts_at;
      if (input.location !== undefined) updateData.location = input.location;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.reminder_minutes !== undefined) updateData.reminder_minutes = input.reminder_minutes;

      const { data, error } = await supabase
        .from("pregnancy_appointments")
        .update(updateData)
        .eq("id", input.id)
        .eq("user_id", input.userId)
        .select("*")
        .single();

      if (error) throw error;

      // Reschedule notifications with new times
      await cancelAppointmentReminders(input.id);
      
      if (isAppointmentRemindersEnabled()) {
        const reminderTimes = data.reminder_minutes ?? [
          getDefaultReminderTimes().firstReminder,
          getDefaultReminderTimes().secondReminder,
        ];
        
        await scheduleAppointmentReminders(
          {
            id: data.id,
            title: data.title,
            starts_at: data.starts_at,
            location: data.location,
          },
          reminderTimes
        );
      }

      return data as Appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["next-appointment"] });
    },
  });
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, userId }: DeleteAppointmentInput) => {
      // Cancel notifications first
      await cancelAppointmentReminders(id);

      const { error } = await supabase
        .from("pregnancy_appointments")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["next-appointment"] });
    },
  });
}

// ---- Utility: Reschedule all appointment notifications ----
// Call this when the user re-enables appointment reminders

export async function rescheduleAllAppointmentReminders(userId: string): Promise<void> {
  if (!isAppointmentRemindersEnabled()) return;

  try {
    const appointments = await fetchAppointments(userId);
    const now = new Date();

    for (const appt of appointments) {
      const appointmentTime = new Date(appt.starts_at);
      
      // Only schedule for future appointments
      if (appointmentTime > now) {
        const reminderTimes = appt.reminder_minutes ?? [
          getDefaultReminderTimes().firstReminder,
          getDefaultReminderTimes().secondReminder,
        ];

        await scheduleAppointmentReminders(
          {
            id: appt.id,
            title: appt.title,
            starts_at: appt.starts_at,
            location: appt.location,
          },
          reminderTimes
        );
      }
    }

    console.log(`Rescheduled reminders for ${appointments.length} appointments`);
  } catch (error) {
    console.error("Failed to reschedule appointment reminders:", error);
  }
}