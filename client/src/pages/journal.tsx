// client/src/pages/journal.tsx
// Pregnancy journal - grouped by week, matching production layout

import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { usePregnancyState } from "@/hooks/usePregnancyState";
import { usePartnerAccess } from "@/contexts/PartnerContext";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  Plus,
  BookOpen,
  Calendar,
  Clock,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Image as ImageIcon,
  X,
  ChevronLeft,
  Loader2,
  Sparkles,
  Smile,
  Meh,
  Frown,
} from "lucide-react";

import {
  useJournalEntries,
  useJournalEntry,
  useCreateJournalEntry,
  useUpdateJournalEntry,
  useDeleteJournalEntry,
  useToggleJournalPin,
  uploadJournalImage,
  getSignedImageUrl,
  validateJournalImage,
  type JournalEntry,
  type JournalMood,
  type CreateJournalInput,
  MOOD_OPTIONS,
  SYMPTOM_SUGGESTIONS,
  JOURNAL_LIMITS,
} from "@/hooks/useJournalEntries";

// ============================================
// Mood Configuration
// ============================================

type SimpleMood = "happy" | "neutral" | "sad";

const MOOD_CONFIG: Record<SimpleMood, { 
  label: string; 
  icon: typeof Smile; 
  borderColor: string;
  bgColor: string;
  iconBg: string;
  statBg: string;
}> = {
  happy: { 
    label: "Feeling great", 
    icon: Smile, 
    borderColor: "border-l-green-500",
    bgColor: "bg-gradient-to-r from-green-950/40 to-green-950/10",
    iconBg: "bg-green-900/60 text-green-400",
    statBg: "bg-green-900/40",
  },
  neutral: { 
    label: "Feeling okay", 
    icon: Meh, 
    borderColor: "border-l-yellow-500",
    bgColor: "bg-gradient-to-r from-yellow-950/30 to-yellow-950/10",
    iconBg: "bg-yellow-900/60 text-yellow-400",
    statBg: "bg-yellow-900/40",
  },
  sad: { 
    label: "Not feeling great", 
    icon: Frown, 
    borderColor: "border-l-red-500",
    bgColor: "bg-gradient-to-r from-red-950/40 to-red-950/10",
    iconBg: "bg-red-900/60 text-red-400",
    statBg: "bg-red-900/40",
  },
};

function getSimpleMood(mood: string | null): SimpleMood {
  if (!mood) return "neutral";
  const lower = mood.toLowerCase();
  if (["happy", "excited", "grateful", "hopeful", "content"].includes(lower)) return "happy";
  if (["sad", "anxious", "overwhelmed"].includes(lower)) return "sad";
  return "neutral";
}

// ============================================
// Journal Stats Component
// ============================================

interface JournalStatsProps {
  entries: JournalEntry[];
}

function JournalStats({ entries }: JournalStatsProps) {
  const stats = useMemo(() => {
    let great = 0;
    let okay = 0;
    let tough = 0;

    entries.forEach((entry) => {
      const simpleMood = getSimpleMood(entry.mood);
      if (simpleMood === "happy") great++;
      else if (simpleMood === "sad") tough++;
      else okay++;
    });

    return { total: entries.length, great, okay, tough };
  }, [entries]);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-lg font-semibold text-foreground mb-4">Journal Stats</h3>
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total Entries</p>
        </div>
        <div className={cn("rounded-lg p-3 text-center", MOOD_CONFIG.happy.statBg)}>
          <p className="text-2xl font-bold text-green-400">{stats.great}</p>
          <p className="text-xs text-muted-foreground">Great Days</p>
        </div>
        <div className={cn("rounded-lg p-3 text-center", MOOD_CONFIG.neutral.statBg)}>
          <p className="text-2xl font-bold text-yellow-400">{stats.okay}</p>
          <p className="text-xs text-muted-foreground">Okay Days</p>
        </div>
        <div className={cn("rounded-lg p-3 text-center", MOOD_CONFIG.sad.statBg)}>
          <p className="text-2xl font-bold text-red-400">{stats.tough}</p>
          <p className="text-xs text-muted-foreground">Tough Days</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Week Group Component
// ============================================

interface WeekGroupProps {
  weekNumber: number;
  entries: JournalEntry[];
  onEntryClick: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
}

function WeekGroup({ weekNumber, entries, onEntryClick, onPin }: WeekGroupProps) {
  return (
    <div className="flex gap-6">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center">
          <span className="text-lg font-semibold text-foreground">{weekNumber}</span>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <div className="pt-2">
          <h2 className="text-xl font-semibold text-foreground">Week {weekNumber}</h2>
          <p className="text-sm text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </p>
        </div>

        <div className="space-y-3">
          {entries.map((entry) => (
            <JournalCard
              key={entry.id}
              entry={entry}
              onClick={() => onEntryClick(entry.id)}
              onPin={(pinned) => onPin(entry.id, pinned)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Journal Card Component
// ============================================

interface JournalCardProps {
  entry: JournalEntry;
  onClick: () => void;
  onPin: (pinned: boolean) => void;
}

function JournalCard({ entry, onClick, onPin }: JournalCardProps) {
  const simpleMood = getSimpleMood(entry.mood);
  const moodConfig = MOOD_CONFIG[simpleMood];
  const MoodIcon = moodConfig.icon;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  const formattedDate = format(new Date(entry.entry_date + "T00:00:00"), "EEEE, MMM d");
  const formattedTime = format(new Date(entry.created_at), "h:mm a");

  // Load signed image URL
  useEffect(() => {
    if (entry.image_path) {
      setImageLoading(true);
      getSignedImageUrl(entry.image_path)
        .then((url) => {
          setImageUrl(url);
        })
        .catch((err) => {
          console.error("Failed to load image:", err);
        })
        .finally(() => {
          setImageLoading(false);
        });
    }
  }, [entry.image_path]);

  const handleThumbnailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (imageUrl) {
      setShowLightbox(true);
    }
  };

  return (
    <>
      <div
        onClick={onClick}
        className={cn(
          "group relative rounded-xl border-l-4 cursor-pointer transition-all hover:shadow-md overflow-hidden",
          moodConfig.borderColor,
          moodConfig.bgColor
        )}
      >
        <div className="flex items-start justify-between gap-4 p-4">
          {/* Left content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 mb-3">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", moodConfig.iconBg)}>
                <MoodIcon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{moodConfig.label}</p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formattedDate}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formattedTime}
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPin(!entry.pinned);
                }}
                className={cn(
                  "p-1.5 rounded-full transition-opacity",
                  entry.pinned 
                    ? "text-primary opacity-100" 
                    : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted"
                )}
              >
                {entry.pinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
              </button>
            </div>

            {/* Symptoms section */}
            {entry.symptoms && entry.symptoms.length > 0 && (
              <div className="mb-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Symptoms</p>
                <p className="text-sm text-foreground">{entry.symptoms.join(", ")}</p>
              </div>
            )}

            {/* Journal entry body */}
            {entry.body && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Journal</p>
                <p className="text-sm text-foreground line-clamp-3">{entry.body}</p>
              </div>
            )}
          </div>

          {/* Right side - Image thumbnail (only render if image loaded successfully) */}
          {entry.image_path && imageUrl && (
            <div 
              onClick={handleThumbnailClick}
              className="w-[84px] h-[84px] rounded-xl overflow-hidden border border-border/40 bg-muted/20 flex-shrink-0 cursor-pointer"
            >
              <img 
                src={imageUrl} 
                alt="" 
                className="w-full h-full object-cover opacity-90 hover:opacity-100 transition" 
              />
            </div>
          )}
        </div>
      </div>

      {/* Lightbox modal */}
      {showLightbox && imageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
        >
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/40 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={imageUrl} 
            alt="Journal photo" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

// ============================================
// Entry Detail Component
// ============================================

interface EntryDetailProps {
  entry: JournalEntry;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPin: (pinned: boolean) => void;
}

function EntryDetail({ entry, onBack, onEdit, onDelete, onPin }: EntryDetailProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  const simpleMood = getSimpleMood(entry.mood);
  const moodConfig = MOOD_CONFIG[simpleMood];

  useEffect(() => {
    if (entry.image_path) {
      getSignedImageUrl(entry.image_path).then(setImageUrl);
    }
  }, [entry.image_path]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPin(!entry.pinned)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              entry.pinned ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {entry.pinned ? <Pin className="w-5 h-5" /> : <PinOff className="w-5 h-5" />}
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className={cn(
        "rounded-xl border-l-4 p-6",
        moodConfig.borderColor,
        "bg-card border border-border"
      )}>
        <p className="text-sm text-muted-foreground mb-2">
          {format(new Date(entry.entry_date + "T00:00:00"), "EEEE, MMMM d, yyyy")}
        </p>

        <h1 className="font-serif text-2xl font-semibold text-foreground mb-4">
          {entry.title || format(new Date(entry.entry_date + "T00:00:00"), "EEEE")}
        </h1>

        {entry.image_path && imageUrl && (
          <div className="mb-6">
            <img src={imageUrl} alt="" className="w-full max-h-96 object-contain rounded-xl" />
          </div>
        )}

        <p className="text-foreground leading-relaxed whitespace-pre-wrap">{entry.body}</p>

        {entry.symptoms.length > 0 && (
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Symptoms</p>
            <div className="flex flex-wrap gap-2">
              {entry.symptoms.map((symptom) => (
                <span key={symptom} className="px-3 py-1 bg-muted text-muted-foreground text-sm rounded-full">
                  {symptom}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this journal entry and any attached photo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================
// Entry Form Component
// ============================================

interface EntryFormProps {
  entry?: JournalEntry | null;
  onSave: (data: CreateJournalInput, imageFile?: File) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  currentWeek?: number;
}

function EntryForm({ entry, onSave, onCancel, isSaving, currentWeek }: EntryFormProps) {
  const [date, setDate] = useState(entry?.entry_date || format(new Date(), "yyyy-MM-dd"));
  const [title, setTitle] = useState(entry?.title || "");
  const [body, setBody] = useState(entry?.body || "");
  const [mood, setMood] = useState<JournalMood | null>(entry?.mood as JournalMood || null);
  const [symptoms, setSymptoms] = useState<string[]>(entry?.symptoms || []);
  const [customSymptom, setCustomSymptom] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (entry?.image_path) {
      getSignedImageUrl(entry.image_path).then(setExistingImageUrl);
    }
  }, [entry?.image_path]);

  useEffect(() => {
    setTimeout(() => bodyRef.current?.focus(), 100);
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validation = validateJournalImage(file);
    if (!validation.valid) return;
    
    setImageFile(file);
    setRemoveImage(false);
    
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleSymptom = (symptom: string) => {
    setSymptoms(prev => prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]);
  };

  const addCustomSymptom = () => {
    const trimmed = customSymptom.trim();
    if (trimmed && !symptoms.includes(trimmed)) {
      setSymptoms([...symptoms, trimmed]);
      setCustomSymptom("");
    }
  };

  const handleSubmit = async () => {
    if (!body.trim()) return;
    await onSave({ entry_date: date, title: title.trim() || undefined, body: body.trim(), mood: mood || undefined, symptoms, image_path: removeImage ? undefined : (entry?.image_path ?? undefined) }, imageFile || undefined);
  };

  const showImage = imagePreview || (!removeImage && existingImageUrl);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-muted-foreground">Date</label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
      </div>

      <div>
        <label className="text-sm font-medium text-muted-foreground">Title (optional)</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give this entry a title..." maxLength={100} className="mt-1" />
      </div>

      <div>
        <label className="text-sm font-medium text-muted-foreground">Your thoughts</label>
        <Textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write about your day..." rows={6} maxLength={10000} className="mt-1 resize-none" />
      </div>

      <div>
        <label className="text-sm font-medium text-muted-foreground">How are you feeling?</label>
        <div className="flex flex-wrap gap-2 mt-2">
          {MOOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMood(mood === option.value ? null : option.value)}
              className={cn("px-3 py-1.5 rounded-full text-sm border transition-all", mood === option.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}
            >
              {option.emoji} {option.value}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-muted-foreground">Tags</label>
        <div className="flex flex-wrap gap-2 mt-2">
          {SYMPTOM_SUGGESTIONS.slice(0, 8).map((symptom) => (
            <button
              key={symptom}
              type="button"
              onClick={() => toggleSymptom(symptom)}
              className={cn("px-2.5 py-1 rounded-full text-xs border transition-all", symptoms.includes(symptom) ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted text-muted-foreground")}
            >
              {symptom}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input value={customSymptom} onChange={(e) => setCustomSymptom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSymptom())} placeholder="Add custom tag..." className="flex-1 h-8 text-sm" />
          <Button type="button" size="sm" variant="outline" onClick={addCustomSymptom}>Add</Button>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-muted-foreground">Photo (optional)</label>
        {showImage ? (
          <div className="relative mt-2 w-32 h-32">
            <img src={imagePreview || existingImageUrl || ""} alt="Preview" className="w-full h-full object-cover rounded-lg" />
            <button type="button" onClick={handleRemoveImage} className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-muted">
            <ImageIcon className="w-4 h-4" />
            Add a photo
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={handleImageSelect} className="hidden" />
      </div>

      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onCancel} className="flex-1" disabled={isSaving}>Cancel</Button>
        <Button onClick={handleSubmit} className="flex-1" disabled={isSaving || !body.trim()}>
          {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : entry ? "Update" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Main Journal Page
// ============================================

export default function JournalPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isPartnerView, momName } = usePartnerAccess();
  const { dueDate, setDueDate, currentWeek, appMode, babyBirthDate } = usePregnancyState();
  const [location, navigate] = useLocation();

  const [view, setView] = useState<"list" | "detail" | "create" | "edit">("list");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const { data: entries, isLoading } = useJournalEntries({ limit: 100 });
  const { data: selectedEntry } = useJournalEntry(selectedEntryId);

  const createEntry = useCreateJournalEntry();
  const updateEntry = useUpdateJournalEntry();
  const deleteEntry = useDeleteJournalEntry();
  const togglePin = useToggleJournalPin();

  // Handle deep link to specific entry (e.g., /journal?entry=123)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const entryId = params.get("entry");
    if (entryId && entries) {
      // Check if entry exists
      const entryExists = entries.some(e => e.id === entryId);
      if (entryExists) {
        setSelectedEntryId(entryId);
        setView("detail");
        // Clear the URL param without reloading
        navigate("/journal", { replace: true });
      }
    }
  }, [entries, navigate]);

  // Group entries by week
  const entriesByWeek = useMemo(() => {
    if (!entries) return [];
    
    const groups: Record<number, JournalEntry[]> = {};
    
    entries.forEach((entry) => {
      let weekNum: number;
      
      if (dueDate) {
        // Compute week based on entry date and due date
        // week = 40 - floor((dueDate - entry_date) / 7 days)
        const entryDate = new Date(entry.entry_date + "T00:00:00");
        const dueDateObj = new Date(dueDate);
        const diffMs = dueDateObj.getTime() - entryDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffWeeks = Math.floor(diffDays / 7);
        weekNum = 40 - diffWeeks;
        // Clamp to 1-42 (allowing a bit past 40 for late entries)
        weekNum = Math.max(1, Math.min(42, weekNum));
      } else {
        // Fallback if no due date
        weekNum = currentWeek || 20;
      }
      
      if (!groups[weekNum]) groups[weekNum] = [];
      groups[weekNum].push(entry);
    });

    return Object.entries(groups)
      .map(([week, entries]) => ({
        weekNumber: parseInt(week),
        entries: entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      }))
      .sort((a, b) => b.weekNumber - a.weekNumber);
  }, [entries, dueDate, currentWeek]);

  const handleViewEntry = (id: string) => {
    setSelectedEntryId(id);
    setView("detail");
  };

  const handleSaveEntry = async (data: CreateJournalInput, imageFile?: File) => {
    try {
      if (view === "edit" && selectedEntryId) {
        let imagePath = data.image_path;
        if (imageFile && user) imagePath = await uploadJournalImage(user.id, selectedEntryId, imageFile);
        await updateEntry.mutateAsync({ id: selectedEntryId, ...data, image_path: imagePath });
        toast({ title: "Entry updated" });
        setView("detail");
      } else {
        const newEntry = await createEntry.mutateAsync(data);
        if (imageFile && user && newEntry?.id) {
          const imagePath = await uploadJournalImage(user.id, newEntry.id, imageFile);
          await updateEntry.mutateAsync({ id: newEntry.id, image_path: imagePath });
        }
        toast({ title: "Entry saved" });
        setView("list");
      }
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to save.", variant: "destructive" });
    }
  };

  const handleDeleteEntry = async () => {
    if (!selectedEntryId) return;
    try {
      await deleteEntry.mutateAsync(selectedEntryId);
      toast({ title: "Entry deleted" });
      setView("list");
      setSelectedEntryId(null);
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    }
  };

  const handleTogglePin = async (entryId: string, pinned: boolean) => {
    try {
      await togglePin.mutateAsync({ id: entryId, pinned });
    } catch (error) {
      console.error("Failed to toggle pin:", error);
    }
  };

  if (isPartnerView) {
    return (
      <Layout dueDate={dueDate} setDueDate={setDueDate} appMode={appMode} babyBirthDate={babyBirthDate}>
        <div className="max-w-3xl mx-auto text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="font-serif text-2xl font-semibold text-foreground mb-3">Private Journal</h1>
          <p className="text-muted-foreground max-w-sm mx-auto">{momName ? `${momName}'s` : "Mom's"} journal is a private space for personal reflections.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout dueDate={dueDate} setDueDate={setDueDate} appMode={appMode} babyBirthDate={babyBirthDate}>
      <div className="max-w-3xl mx-auto">
        {view === "list" && (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <h1 className="font-serif text-3xl font-semibold text-foreground">Your Pregnancy Journal</h1>
              <p className="text-muted-foreground mt-2">A record of your journey, one day at a time</p>
            </div>

            {/* Journal Stats - shown when there are entries */}
            {!isLoading && entries && entries.length > 0 && (
              <JournalStats entries={entries} />
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && (!entries || entries.length === 0) && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">Start documenting your pregnancy journey.</p>
                <Button onClick={() => setView("create")}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Write your first entry
                </Button>
              </div>
            )}

            {!isLoading && entriesByWeek.length > 0 && (
              <div className="space-y-10">
                {entriesByWeek.map((group) => (
                  <WeekGroup key={group.weekNumber} weekNumber={group.weekNumber} entries={group.entries} onEntryClick={handleViewEntry} onPin={handleTogglePin} />
                ))}
              </div>
            )}

            {!isLoading && entries && entries.length > 0 && (
              <div className="fixed bottom-6 right-6">
                <Button size="lg" className="rounded-full w-14 h-14 shadow-lg" onClick={() => setView("create")}>
                  <Plus className="w-6 h-6" />
                </Button>
              </div>
            )}
          </div>
        )}

        {view === "detail" && selectedEntry && (
          <EntryDetail entry={selectedEntry} onBack={() => { setView("list"); setSelectedEntryId(null); }} onEdit={() => setView("edit")} onDelete={handleDeleteEntry} onPin={(pinned) => handleTogglePin(selectedEntry.id, pinned)} />
        )}

        <Dialog open={view === "create" || view === "edit"} onOpenChange={(open) => { if (!open) setView(selectedEntryId ? "detail" : "list"); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">{view === "create" ? "New Journal Entry" : "Edit Entry"}</DialogTitle>
            </DialogHeader>
            <EntryForm entry={view === "edit" ? selectedEntry : null} onSave={handleSaveEntry} onCancel={() => setView(selectedEntryId ? "detail" : "list")} isSaving={createEntry.isPending || updateEntry.isPending} currentWeek={currentWeek} />
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}