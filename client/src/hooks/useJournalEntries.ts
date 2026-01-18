// client/src/hooks/useJournalEntries.ts
// CRUD operations for pregnancy journal entries

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerAccess } from "@/contexts/PartnerContext";

// ============================================
// Types
// ============================================

// Size limits
export const JOURNAL_LIMITS = {
  TITLE_MAX_LENGTH: 100,
  BODY_MAX_LENGTH: 10000,
  IMAGE_MAX_SIZE_MB: 5,
  IMAGE_MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  SYMPTOMS_MAX_COUNT: 20,
  SYMPTOM_MAX_LENGTH: 50,
} as const;

export type JournalMood = 
  | "Happy" 
  | "Calm" 
  | "Excited" 
  | "Anxious" 
  | "Tired" 
  | "Emotional" 
  | "Grateful" 
  | "Hopeful"
  | "Overwhelmed"
  | "Content";

export const MOOD_OPTIONS: { value: JournalMood; emoji: string }[] = [
  { value: "Happy", emoji: "😊" },
  { value: "Calm", emoji: "😌" },
  { value: "Excited", emoji: "🤩" },
  { value: "Anxious", emoji: "😰" },
  { value: "Tired", emoji: "😴" },
  { value: "Emotional", emoji: "🥹" },
  { value: "Grateful", emoji: "🙏" },
  { value: "Hopeful", emoji: "✨" },
  { value: "Overwhelmed", emoji: "😵‍💫" },
  { value: "Content", emoji: "☺️" },
];

export const SYMPTOM_SUGGESTIONS = [
  "Nausea",
  "Fatigue",
  "Back pain",
  "Headache",
  "Cravings",
  "Insomnia",
  "Heartburn",
  "Swelling",
  "Mood swings",
  "Braxton Hicks",
  "Baby kicks",
  "Round ligament pain",
];

export interface JournalEntry {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  entry_date: string;
  title: string | null;
  body: string;
  mood: JournalMood | null;
  symptoms: string[];
  image_path: string | null;
  is_private: boolean;
  pinned: boolean;
  deleted_at: string | null;
}

export interface CreateJournalInput {
  entry_date?: string;
  title?: string;
  body: string;
  mood?: JournalMood;
  symptoms?: string[];
  image_path?: string;
  pinned?: boolean;
}

export interface UpdateJournalInput {
  entry_date?: string;
  title?: string;
  body?: string;
  mood?: JournalMood | null;
  symptoms?: string[];
  image_path?: string | null;
  pinned?: boolean;
}

// ============================================
// Fetch Functions
// ============================================

async function fetchJournalEntries(
  userId: string,
  options?: { limit?: number; offset?: number; pinnedOnly?: boolean }
): Promise<JournalEntry[]> {
  const { limit = 20, offset = 0, pinnedOnly = false } = options || {};

  let query = supabase
    .from("pregnancy_journal_entries")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("pinned", { ascending: false })
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (pinnedOnly) {
    query = query.eq("pinned", true);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

async function fetchJournalEntry(entryId: string): Promise<JournalEntry | null> {
  const { data, error } = await supabase
    .from("pregnancy_journal_entries")
    .select("*")
    .eq("id", entryId)
    .is("deleted_at", null)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

async function fetchJournalStats(userId: string): Promise<{
  totalEntries: number;
  thisWeek: number;
  streak: number;
}> {
  // Get total count
  const { count: totalEntries } = await supabase
    .from("pregnancy_journal_entries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null);

  // Get this week's entries
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const { count: thisWeek } = await supabase
    .from("pregnancy_journal_entries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("entry_date", weekAgo.toISOString().split("T")[0]);

  // Calculate streak (consecutive days with entries)
  const { data: recentEntries } = await supabase
    .from("pregnancy_journal_entries")
    .select("entry_date")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("entry_date", { ascending: false })
    .limit(30);

  let streak = 0;
  if (recentEntries && recentEntries.length > 0) {
    const uniqueDates = [...new Set(recentEntries.map(e => e.entry_date))].sort().reverse();
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    
    // Start counting if today or yesterday has an entry
    if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
      streak = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        const prevDate = new Date(uniqueDates[i - 1]);
        const currDate = new Date(uniqueDates[i]);
        const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / 86400000);
        if (diffDays === 1) {
          streak++;
        } else {
          break;
        }
      }
    }
  }

  return {
    totalEntries: totalEntries || 0,
    thisWeek: thisWeek || 0,
    streak,
  };
}

// ============================================
// Image Upload
// ============================================

/**
 * Validate image file size and type
 */
export function validateJournalImage(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: "Please upload a JPEG, PNG, WebP, or HEIC image" };
  }
  
  if (file.size > JOURNAL_LIMITS.IMAGE_MAX_SIZE_BYTES) {
    return { valid: false, error: `Image must be ${JOURNAL_LIMITS.IMAGE_MAX_SIZE_MB}MB or less` };
  }
  
  return { valid: true };
}

export async function uploadJournalImage(
  userId: string,
  entryId: string,
  file: File
): Promise<string> {
  // Validate before upload
  const validation = validateJournalImage(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${entryId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("journal-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  return filePath;
}

export async function deleteJournalImage(imagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from("journal-images")
    .remove([imagePath]);

  if (error) throw error;
}

export function getJournalImageUrl(imagePath: string): string | null {
  if (!imagePath) return null;

  const { data } = supabase.storage
    .from("journal-images")
    .getPublicUrl(imagePath);

  // Since bucket is private, we need signed URL
  // But getPublicUrl won't work - need to use createSignedUrl
  // For simplicity, we'll handle this in the component with a separate call
  return data?.publicUrl || null;
}

export async function getSignedImageUrl(imagePath: string): Promise<string | null> {
  if (!imagePath) return null;

  const { data, error } = await supabase.storage
    .from("journal-images")
    .createSignedUrl(imagePath, 3600); // 1 hour expiry

  if (error) {
    console.error("Failed to get signed URL:", error);
    return null;
  }

  return data?.signedUrl || null;
}

// ============================================
// Hooks
// ============================================

/**
 * Fetch paginated journal entries
 * NOTE: Journal is mom-only. Partners cannot access.
 */
export function useJournalEntries(options?: { 
  limit?: number; 
  pinnedOnly?: boolean;
  enabled?: boolean;
}) {
  const { user } = useAuth();
  const { isPartnerView } = usePartnerAccess();
  
  // Journal is mom-only - partners cannot access
  const userId = user?.id;
  const { limit = 20, pinnedOnly = false, enabled = true } = options || {};

  return useQuery({
    queryKey: ["journal", "entries", userId, { limit, pinnedOnly }],
    queryFn: () => fetchJournalEntries(userId!, { limit, pinnedOnly }),
    // Disable query entirely for partners
    enabled: enabled && !!userId && !isPartnerView,
  });
}

/**
 * Fetch recent journal entries with body content (for Today page preview)
 * NOTE: Journal is mom-only. Partners cannot access.
 */
export function useRecentJournalEntries(limit: number = 2) {
  const { user } = useAuth();
  const { isPartnerView } = usePartnerAccess();
  
  const userId = user?.id;

  return useQuery({
    queryKey: ["journal", "recent", userId, limit],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("pregnancy_journal_entries")
        .select("id, entry_date, title, body, mood, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .neq("body", "")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    // Mom-only
    enabled: !!userId && !isPartnerView,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Fetch a single journal entry
 */
export function useJournalEntry(entryId: string | null) {
  return useQuery({
    queryKey: ["journal", "entry", entryId],
    queryFn: () => fetchJournalEntry(entryId!),
    enabled: !!entryId,
  });
}

/**
 * Fetch journal stats (total entries, this week, streak)
 * NOTE: Journal is mom-only. Partners cannot access.
 */
export function useJournalStats() {
  const { user } = useAuth();
  const { isPartnerView } = usePartnerAccess();
  
  // Journal is mom-only - partners cannot access
  const userId = user?.id;

  return useQuery({
    queryKey: ["journal", "stats", userId],
    queryFn: () => fetchJournalStats(userId!),
    // Disable query entirely for partners
    enabled: !!userId && !isPartnerView,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Create a new journal entry
 */
export function useCreateJournalEntry() {
  const { user } = useAuth();
  const { isPartnerView } = usePartnerAccess();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateJournalInput) => {
      if (!user) throw new Error("Not authenticated");
      if (isPartnerView) throw new Error("Journal is private to mom");

      // Validate input sizes
      if (input.title && input.title.length > JOURNAL_LIMITS.TITLE_MAX_LENGTH) {
        throw new Error(`Title must be ${JOURNAL_LIMITS.TITLE_MAX_LENGTH} characters or less`);
      }
      if (input.body.length > JOURNAL_LIMITS.BODY_MAX_LENGTH) {
        throw new Error(`Entry must be ${JOURNAL_LIMITS.BODY_MAX_LENGTH} characters or less`);
      }
      if (input.symptoms && input.symptoms.length > JOURNAL_LIMITS.SYMPTOMS_MAX_COUNT) {
        throw new Error(`Maximum ${JOURNAL_LIMITS.SYMPTOMS_MAX_COUNT} tags allowed`);
      }
      if (input.symptoms?.some(s => s.length > JOURNAL_LIMITS.SYMPTOM_MAX_LENGTH)) {
        throw new Error(`Tags must be ${JOURNAL_LIMITS.SYMPTOM_MAX_LENGTH} characters or less`);
      }

      const { data, error } = await supabase
        .from("pregnancy_journal_entries")
        .insert({
          user_id: user.id,
          entry_date: input.entry_date || new Date().toISOString().split("T")[0],
          title: input.title?.slice(0, JOURNAL_LIMITS.TITLE_MAX_LENGTH) || null,
          body: input.body.slice(0, JOURNAL_LIMITS.BODY_MAX_LENGTH),
          mood: input.mood || null,
          symptoms: (input.symptoms || []).slice(0, JOURNAL_LIMITS.SYMPTOMS_MAX_COUNT),
          image_path: input.image_path || null,
          pinned: input.pinned || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as JournalEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal"] });
    },
  });
}

/**
 * Update a journal entry
 */
export function useUpdateJournalEntry() {
  const { user } = useAuth();
  const { isPartnerView } = usePartnerAccess();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateJournalInput & { id: string }) => {
      if (!user) throw new Error("Not authenticated");
      if (isPartnerView) throw new Error("Journal is private to mom");

      // Validate input sizes
      if (input.title && input.title.length > JOURNAL_LIMITS.TITLE_MAX_LENGTH) {
        throw new Error(`Title must be ${JOURNAL_LIMITS.TITLE_MAX_LENGTH} characters or less`);
      }
      if (input.body && input.body.length > JOURNAL_LIMITS.BODY_MAX_LENGTH) {
        throw new Error(`Entry must be ${JOURNAL_LIMITS.BODY_MAX_LENGTH} characters or less`);
      }
      if (input.symptoms && input.symptoms.length > JOURNAL_LIMITS.SYMPTOMS_MAX_COUNT) {
        throw new Error(`Maximum ${JOURNAL_LIMITS.SYMPTOMS_MAX_COUNT} tags allowed`);
      }

      const updateData: Record<string, unknown> = {
        ...input,
        updated_at: new Date().toISOString(),
      };
      
      // Truncate if needed
      if (updateData.title) {
        updateData.title = (updateData.title as string).slice(0, JOURNAL_LIMITS.TITLE_MAX_LENGTH);
      }
      if (updateData.body) {
        updateData.body = (updateData.body as string).slice(0, JOURNAL_LIMITS.BODY_MAX_LENGTH);
      }
      if (updateData.symptoms) {
        updateData.symptoms = (updateData.symptoms as string[]).slice(0, JOURNAL_LIMITS.SYMPTOMS_MAX_COUNT);
      }

      const { data, error } = await supabase
        .from("pregnancy_journal_entries")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", user.id) // Security: ensure user owns entry
        .select()
        .single();

      if (error) throw error;
      return data as JournalEntry;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      queryClient.setQueryData(["journal", "entry", data.id], data);
    },
  });
}

/**
 * Delete a journal entry
 */
export function useDeleteJournalEntry() {
  const { user } = useAuth();
  const { isPartnerView } = usePartnerAccess();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      if (!user) throw new Error("Not authenticated");
      if (isPartnerView) throw new Error("Journal is private to mom");

      // Get entry to check for image
      const { data: entry } = await supabase
        .from("pregnancy_journal_entries")
        .select("image_path")
        .eq("id", entryId)
        .eq("user_id", user.id)
        .single();

      // Delete image from storage if exists
      if (entry?.image_path) {
        await deleteJournalImage(entry.image_path).catch(console.error);
      }

      // Hard delete (could do soft delete instead)
      const { error } = await supabase
        .from("pregnancy_journal_entries")
        .delete()
        .eq("id", entryId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal"] });
    },
  });
}

/**
 * Toggle pin status
 */
export function useToggleJournalPin() {
  const { user } = useAuth();
  const { isPartnerView } = usePartnerAccess();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      if (!user) throw new Error("Not authenticated");
      if (isPartnerView) throw new Error("Journal is private to mom");

      const { data, error } = await supabase
        .from("pregnancy_journal_entries")
        .update({ pinned })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data as JournalEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal"] });
    },
  });
}

// ============================================
// Helpers
// ============================================

/**
 * Format entry date for display
 */
export function formatEntryDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const entryDate = new Date(date);
  entryDate.setHours(0, 0, 0, 0);

  if (entryDate.getTime() === today.getTime()) {
    return "Today";
  } else if (entryDate.getTime() === yesterday.getTime()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
}

/**
 * Get mood emoji
 */
export function getMoodEmoji(mood: string | null): string {
  if (!mood) return "";
  const found = MOOD_OPTIONS.find(m => m.value === mood);
  return found?.emoji || "😊";
}

/**
 * Generate auto-title from date and week number
 */
export function generateAutoTitle(entryDate: string, weekNumber?: number): string {
  const date = new Date(entryDate + "T00:00:00");
  const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
  
  if (weekNumber && weekNumber > 0) {
    return `Week ${weekNumber} — ${dayName}`;
  }
  
  return dayName;
}

/**
 * Truncate text for preview
 */
export function truncateText(text: string, maxLength: number = 120): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}