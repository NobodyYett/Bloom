// client/src/components/daily-checkin.tsx

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Smile, Frown, Meh, Loader2, Sun, Sunset, Moon, Zap, Battery, BatteryLow, ChevronDown, Image, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCreatePregnancyLog, useTodayLogs, useAtomicCheckinAndJournal } from "@/hooks/usePregnancyLogs";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import {
  type CheckinSlot,
  getSuggestedSlot,
  getSlotLabel,
  ALL_SLOTS,
} from "@/lib/checkinSlots";
import { BreathingMoment } from "@/components/breathing-moment";

interface DailyCheckInProps {
  currentWeek: number;
  appMode?: "pregnancy" | "infancy";
}

type Energy = "high" | "medium" | "low";

// Symptom chips - shared between pregnancy and postpartum
const PREGNANCY_SYMPTOM_CHIPS = [
  "Nausea",
  "Fatigue",
  "Headache",
  "Back pain",
  "Cramps",
  "Heartburn",
  "Swelling",
  "Insomnia",
  "Mood swings",
  "Cravings",
];

// Postpartum-specific symptoms (some overlap with pregnancy)
const POSTPARTUM_SYMPTOM_CHIPS = [
  "Fatigue",
  "Sleep deprivation",
  "Back pain",
  "Anxiety",
  "Mood swings",
  "Headache",
  "Breast pain",
  "Cramping",
  "Swelling",
  "Low energy",
];

function getSymptomChips(appMode: "pregnancy" | "infancy" = "pregnancy"): string[] {
  return appMode === "infancy" ? POSTPARTUM_SYMPTOM_CHIPS : PREGNANCY_SYMPTOM_CHIPS;
}

const slotIcons: Record<CheckinSlot, React.ReactNode> = {
  morning: <Sun className="w-3.5 h-3.5 shrink-0" />,
  evening: <Sunset className="w-3.5 h-3.5 shrink-0" />,
  night: <Moon className="w-3.5 h-3.5 shrink-0" />,
};

const energyConfig: Record<Energy, { icon: React.ReactNode; label: string }> = {
  high: { icon: <Zap className="w-3.5 h-3.5" />, label: "High" },
  medium: { icon: <Battery className="w-3.5 h-3.5" />, label: "Medium" },
  low: { icon: <BatteryLow className="w-3.5 h-3.5" />, label: "Low" },
};

export function DailyCheckIn({ currentWeek, appMode = "pregnancy" }: DailyCheckInProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const todayDate = format(new Date(), "yyyy-MM-dd");
  
  // Get appropriate symptom chips based on app mode
  const symptomChips = getSymptomChips(appMode);

  const { data: todayLogs = [], isLoading: checkingTodayLogs } =
    useTodayLogs(todayDate);

  // Fetch today's journal entries for display
  const { data: journalEntries = [] } = useJournalEntries({ limit: 5 });
  const todayJournalEntries = journalEntries.filter(
    (e) => e.entry_date === todayDate
  ).slice(0, 2);

  const createLogMutation = useCreatePregnancyLog();
  const atomicSaveMutation = useAtomicCheckinAndJournal();

  const [selectedSlot, setSelectedSlot] = useState<CheckinSlot>(() => getSuggestedSlot());
  const [selectedMood, setSelectedMood] = useState<"happy" | "neutral" | "sad" | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<Energy | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [symptomInput, setSymptomInput] = useState("");
  const [showSymptomPicker, setShowSymptomPicker] = useState(false);
  const [journalNotes, setJournalNotes] = useState("");
  const [journalImage, setJournalImage] = useState<File | null>(null);
  const [journalImagePreview, setJournalImagePreview] = useState<string | null>(null);
  const [savingJournal, setSavingJournal] = useState(false);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const symptomInputRef = useRef<HTMLInputElement>(null);
  const symptomComposerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedSlot(getSuggestedSlot());
  }, [todayDate]);

  // Close symptom picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (symptomComposerRef.current && !symptomComposerRef.current.contains(event.target as Node)) {
        setShowSymptomPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const completedSlots = new Set(
    todayLogs.map((log: any) => log.slot || log.time_of_day).filter(Boolean)
  );

  function addSymptom(symptom: string) {
    const trimmed = symptom.trim();
    if (trimmed && !selectedSymptoms.includes(trimmed)) {
      setSelectedSymptoms((prev) => [...prev, trimmed]);
    }
  }

  function removeSymptom(symptom: string) {
    setSelectedSymptoms((prev) => prev.filter((s) => s !== symptom));
  }

  function toggleSymptom(symptom: string) {
    if (selectedSymptoms.includes(symptom)) {
      removeSymptom(symptom);
    } else {
      addSymptom(symptom);
    }
  }

  function handleSymptomInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (symptomInput.trim()) {
        addSymptom(symptomInput);
        setSymptomInput("");
      }
    } else if (e.key === "Backspace" && !symptomInput && selectedSymptoms.length > 0) {
      // Remove last chip when backspace on empty input
      removeSymptom(selectedSymptoms[selectedSymptoms.length - 1]);
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Image too large",
        description: "Please select an image under 5MB.",
        variant: "destructive",
      });
      return;
    }
    
    setJournalImage(file);
    const reader = new FileReader();
    reader.onload = () => setJournalImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setJournalImage(null);
    setJournalImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  // Helper to build symptoms string
  function buildSymptomsString(): string | undefined {
    const allSymptoms: string[] = [...selectedSymptoms];
    if (symptomInput.trim()) {
      const customList = symptomInput
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !allSymptoms.includes(s));
      allSymptoms.push(...customList);
    }
    return allSymptoms.length > 0 ? allSymptoms.join(", ") : undefined;
  }

  // Check if both check-in and journal have data
  const hasCheckinData = !!selectedMood;
  const hasJournalData = !!journalNotes.trim();
  const hasBothData = hasCheckinData && hasJournalData;

  async function saveCheckin() {
    if (!selectedMood) {
      toast({
        title: "Please select a mood",
        description: "Let us know how you're feeling.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createLogMutation.mutateAsync({
        date: todayDate,
        week: currentWeek,
        mood: selectedMood,
        slot: selectedSlot,
        energy: selectedEnergy ?? undefined,
        symptoms: buildSymptomsString(),
      });

      toast({
        title: "Check-in saved!",
        description: `${getSlotLabel(selectedSlot)} check-in recorded.`,
      });

      setSelectedMood(null);
      setSelectedEnergy(null);
      setSelectedSymptoms([]);
      setSymptomInput("");
    } catch (error) {
      toast({
        title: "Oops!",
        description:
          error instanceof Error ? error.message : "Failed to save check-in",
        variant: "destructive",
      });
    }
  }

  async function saveJournal() {
    if (!journalNotes.trim()) {
      toast({
        title: "Please write something",
        description: "Your journal entry is empty.",
        variant: "destructive",
      });
      return;
    }

    setSavingJournal(true);
    try {
      // Upload image if present
      let imagePath: string | undefined;
      if (journalImage && user) {
        const fileExt = journalImage.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('journal-images')
          .upload(fileName, journalImage);
        if (!uploadError) {
          imagePath = fileName;
        }
      }

      // Use atomic save with check-in + journal
      await atomicSaveMutation.mutateAsync({
        checkin: {
          date: todayDate,
          week: currentWeek,
          mood: selectedMood ?? "neutral",
          slot: selectedSlot,
          energy: selectedEnergy ?? undefined,
          symptoms: buildSymptomsString(),
        },
        journal: {
          entry_date: todayDate,
          body: journalNotes.trim(),
          mood: selectedMood ?? "neutral",
          symptoms: selectedSymptoms,
          image_path: imagePath,
        },
      });

      toast({
        title: "Journal saved!",
        description: "Your thoughts have been recorded.",
      });

      // Clear journal fields
      setJournalNotes("");
      setJournalImage(null);
      setJournalImagePreview(null);
      
      // Also clear check-in fields since we saved both
      if (selectedMood) {
        setSelectedMood(null);
        setSelectedEnergy(null);
        setSelectedSymptoms([]);
        setSymptomInput("");
      }
    } catch (error) {
      toast({
        title: "Oops!",
        description:
          error instanceof Error ? error.message : "Failed to save journal",
        variant: "destructive",
      });
    } finally {
      setSavingJournal(false);
    }
  }

  async function saveBoth() {
    if (!selectedMood) {
      toast({
        title: "Please select a mood",
        description: "Let us know how you're feeling for the check-in.",
        variant: "destructive",
      });
      return;
    }

    if (!journalNotes.trim()) {
      toast({
        title: "Please write something",
        description: "Your journal entry is empty.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Upload image if present
      let imagePath: string | undefined;
      if (journalImage && user) {
        const fileExt = journalImage.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('journal-images')
          .upload(fileName, journalImage);
        if (!uploadError) {
          imagePath = fileName;
        }
      }

      await atomicSaveMutation.mutateAsync({
        checkin: {
          date: todayDate,
          week: currentWeek,
          mood: selectedMood,
          slot: selectedSlot,
          energy: selectedEnergy ?? undefined,
          symptoms: buildSymptomsString(),
        },
        journal: {
          entry_date: todayDate,
          body: journalNotes.trim(),
          mood: selectedMood,
          symptoms: selectedSymptoms,
          image_path: imagePath,
        },
      });

      toast({
        title: "All saved!",
        description: `${getSlotLabel(selectedSlot)} check-in and journal linked together.`,
      });

      // Clear all fields
      setSelectedMood(null);
      setSelectedEnergy(null);
      setSelectedSymptoms([]);
      setSymptomInput("");
      setJournalNotes("");
      setJournalImage(null);
      setJournalImagePreview(null);
    } catch (error) {
      toast({
        title: "Oops!",
        description:
          error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      });
    }
  }

  const cardClass =
    "h-full bg-card rounded-xl p-6 border border-border shadow-sm flex flex-col overflow-hidden";

  if (checkingTodayLogs) {
    return (
      <div className={cardClass + " items-center justify-center"}>
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const suggestedSlot = getSuggestedSlot();
  const suggestedSlotCompleted = completedSlots.has(suggestedSlot);

  const moodBtnBase =
    "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg border transition-all min-w-0";
  const moodBtnInactive = "border-border hover:bg-muted";
  const moodBtnActive = "border-primary bg-primary/5 text-primary";

  const slotBtnBase =
    "flex-1 flex items-center justify-center gap-1 py-2 px-1 rounded-lg border transition-all text-xs min-w-0";
  const slotBtnInactive = "border-border hover:bg-muted text-muted-foreground";
  const slotBtnActive = "border-primary bg-primary/10 text-primary font-medium";
  const slotBtnCompleted = "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400";

  const energyBtnBase =
    "flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg border transition-all min-w-0";
  const energyBtnInactive = "border-border hover:bg-muted text-muted-foreground";
  const energyBtnActive = "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400";

  return (
    <div className={cardClass}>
      {/* ==================== CHECK-IN SECTION ==================== */}
      <div className="text-center">
        <h3 className="font-serif text-2xl font-semibold">Daily Check-in</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {suggestedSlotCompleted 
            ? "Add another check-in anytime" 
            : "How are you feeling right now?"}
        </p>
      </div>

      {/* Time of day selector */}
      <div className="mt-3 flex gap-1.5 w-full">
        {ALL_SLOTS.map((slot) => {
          const isCompleted = completedSlots.has(slot);
          const isSelected = selectedSlot === slot;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => setSelectedSlot(slot)}
              className={cn(
                slotBtnBase,
                isSelected && !isCompleted && slotBtnActive,
                isCompleted && slotBtnCompleted,
                !isSelected && !isCompleted && slotBtnInactive
              )}
            >
              {slotIcons[slot]}
              <span className="truncate">{getSlotLabel(slot)}</span>
              {isCompleted && <span className="text-[10px]">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Mood selector */}
      <div className="mt-3 flex gap-2 w-full">
        <button
          type="button"
          onClick={() =>
            setSelectedMood((prev) => (prev === "happy" ? null : "happy"))
          }
          className={cn(
            moodBtnBase,
            selectedMood === "happy" ? moodBtnActive : moodBtnInactive,
          )}
        >
          <Smile className="w-4 h-4" />
          <span className="text-xs font-medium">Great</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setSelectedMood((prev) => (prev === "neutral" ? null : "neutral"))
          }
          className={cn(
            moodBtnBase,
            selectedMood === "neutral" ? moodBtnActive : moodBtnInactive,
          )}
        >
          <Meh className="w-4 h-4" />
          <span className="text-xs font-medium">Okay</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setSelectedMood((prev) => (prev === "sad" ? null : "sad"))
          }
          className={cn(
            moodBtnBase,
            selectedMood === "sad" ? moodBtnActive : moodBtnInactive,
          )}
        >
          <Frown className="w-4 h-4" />
          <span className="text-xs font-medium">Not good</span>
        </button>
      </div>

      {/* Energy selector */}
      <div className="mt-3 space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground">Energy</div>
        <div className="flex gap-2 w-full">
          {(["high", "medium", "low"] as Energy[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() =>
                setSelectedEnergy((prev) => (prev === level ? null : level))
              }
              className={cn(
                energyBtnBase,
                selectedEnergy === level ? energyBtnActive : energyBtnInactive,
              )}
            >
              {energyConfig[level].icon}
              <span className="text-xs font-medium">{energyConfig[level].label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ==================== SYMPTOMS COMPOSER ==================== */}
      <div className="mt-3 space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground">Symptoms</div>
        
        <div ref={symptomComposerRef} className="relative">
          {/* Composer container */}
          <div 
            className={cn(
              "flex flex-col min-h-[42px] px-3 py-1.5 rounded-lg border bg-background transition-colors",
              showSymptomPicker ? "border-primary ring-1 ring-primary/20" : "border-border"
            )}
            onClick={() => symptomInputRef.current?.focus()}
          >
            {/* Top row: Input + dropdown */}
            <div className="flex items-center gap-1">
              {/* Text input */}
              <input
                ref={symptomInputRef}
                type="text"
                value={symptomInput}
                onChange={(e) => setSymptomInput(e.target.value)}
                onKeyDown={handleSymptomInputKeyDown}
                onFocus={() => setShowSymptomPicker(false)}
                placeholder="Type or pick symptoms..."
                className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />

              {/* Right: Dropdown trigger */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSymptomPicker(!showSymptomPicker);
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors shrink-0"
              >
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform",
                  showSymptomPicker && "rotate-180"
                )} />
              </button>
            </div>

            {/* Selected symptom chips - below input */}
            {selectedSymptoms.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1.5 border-t border-border/50">
                {selectedSymptoms.map((symptom) => (
                  <span
                    key={symptom}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full shrink-0"
                  >
                    {symptom}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSymptom(symptom);
                      }}
                      className="hover:text-primary/70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Dropdown picker */}
          {showSymptomPicker && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 p-2 bg-card border border-border rounded-lg shadow-lg">
              <div className="flex flex-wrap gap-1.5">
                {symptomChips.map((symptom) => (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => toggleSymptom(symptom)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-full border transition-all",
                      selectedSymptoms.includes(symptom)
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-border bg-background hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {symptom}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Check-in button - becomes "Save Both" when journal has data */}
      <Button
        className="w-full mt-3"
        onClick={hasBothData ? saveBoth : saveCheckin}
        disabled={createLogMutation.isPending || atomicSaveMutation.isPending || !selectedMood}
      >
        {(createLogMutation.isPending || atomicSaveMutation.isPending) ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : hasBothData ? (
          "Save check-in & journal"
        ) : (
          `Save ${getSlotLabel(selectedSlot)} check-in`
        )}
      </Button>

      {/* ==================== DIVIDER + BREATHING ==================== */}
      <div className="mt-4 mb-2 border-t border-border/60" />
      
      <BreathingMoment mood={selectedMood} />

      {/* ==================== JOURNAL SECTION ==================== */}
      <div className="text-center mb-2 mt-3">
        <h3 className="font-serif text-2xl font-semibold">Journal</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Capture today&apos;s thoughts (private to mom).
        </p>
      </div>

      {/* ==================== JOURNAL COMPOSER ==================== */}
      <div 
        className="relative flex items-start min-h-[42px] px-3 py-1.5 rounded-lg border border-border bg-background transition-colors"
      >
        {/* Textarea */}
        <textarea
          value={journalNotes}
          onChange={(e) => setJournalNotes(e.target.value)}
          placeholder="What's on your mind today?"
          className="flex-1 pr-8 text-sm bg-transparent resize-none outline-none placeholder:text-muted-foreground"
          rows={2}
        />
        
        {/* Image button - absolute top right */}
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className={cn(
            "absolute right-2 top-2 p-1.5 rounded transition-colors",
            journalImagePreview
              ? "text-primary hover:bg-primary/10" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title="Add photo"
        >
          <Image className="w-4 h-4" />
        </button>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          onChange={handleImageSelect}
          className="hidden"
        />
      </div>
      
      {/* Attachment preview - shows when image is selected */}
      {journalImagePreview && (
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex items-center gap-2 px-2 py-1 bg-primary/10 rounded-full">
            <img
              src={journalImagePreview}
              alt="Attached"
              className="w-5 h-5 rounded object-cover"
            />
            <span className="text-xs text-primary truncate max-w-[120px]">
              {journalImage?.name || "Photo"}
            </span>
            <button
              type="button"
              onClick={removeImage}
              className="text-primary hover:text-primary/70"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Save Journal button */}
      <Button
        className="w-full mt-3"
        onClick={saveJournal}
        disabled={savingJournal || !journalNotes.trim()}
      >
        {savingJournal ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          "Save journal entry"
        )}
      </Button>

      {/* Prior journal entries (from pregnancy_journal_entries table) */}
      {todayJournalEntries.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground mt-3 mb-1.5">
            Today&apos;s journal entries
          </p>
          <div className="space-y-1.5">
            {todayJournalEntries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => navigate(`/journal?entry=${entry.id}`)}
                className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <span className="font-medium">
                    {entry.title || format(new Date(entry.created_at), "h:mm a")}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-snug line-clamp-2">
                  {entry.body}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}