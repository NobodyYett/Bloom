// client/src/components/daily-checkin.tsx

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Smile, Frown, Meh, Loader2, Sun, Sunset, Moon, Zap, Battery, BatteryLow, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCreatePregnancyLog, useTodayLogs } from "@/hooks/usePregnancyLogs";
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
}

type Energy = "high" | "medium" | "low";

const SYMPTOM_CHIPS = [
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

const slotIcons: Record<CheckinSlot, React.ReactNode> = {
  morning: <Sun className="w-3.5 h-3.5 shrink-0" />,
  evening: <Sunset className="w-3.5 h-3.5 shrink-0" />,
  night: <Moon className="w-3.5 h-3.5 shrink-0" />,
};

const energyConfig: Record<Energy, { icon: React.ReactNode; label: string }> = {
  high: { icon: <Zap className="w-4 h-4" />, label: "High" },
  medium: { icon: <Battery className="w-4 h-4" />, label: "Medium" },
  low: { icon: <BatteryLow className="w-4 h-4" />, label: "Low" },
};

export function DailyCheckIn({ currentWeek }: DailyCheckInProps) {
  const { toast } = useToast();
  const todayDate = format(new Date(), "yyyy-MM-dd");

  const { data: todayLogs = [], isLoading: checkingTodayLogs } =
    useTodayLogs(todayDate);

  const createLogMutation = useCreatePregnancyLog();

  const [selectedSlot, setSelectedSlot] = useState<CheckinSlot>(() => getSuggestedSlot());
  const [selectedMood, setSelectedMood] = useState<"happy" | "neutral" | "sad" | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<Energy | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptoms, setCustomSymptoms] = useState("");
  const [showCommonSymptoms, setShowCommonSymptoms] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setSelectedSlot(getSuggestedSlot());
  }, [todayDate]);

  const completedSlots = new Set(
    todayLogs.map((log: any) => log.slot || log.time_of_day).filter(Boolean)
  );

  function toggleSymptom(symptom: string) {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
  }

  async function saveCheckin() {
    if (!selectedMood) {
      toast({
        title: "Please select a mood",
        description: "Let us know how you're feeling.",
        variant: "destructive",
      });
      return;
    }

    // Combine preset symptoms with custom symptoms
    const allSymptoms: string[] = [...selectedSymptoms];
    if (customSymptoms.trim()) {
      // Split by comma if multiple, or just add the single entry
      const customList = customSymptoms
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      allSymptoms.push(...customList);
    }

    try {
      await createLogMutation.mutateAsync({
        date: todayDate,
        week: currentWeek,
        mood: selectedMood,
        slot: selectedSlot,
        energy: selectedEnergy ?? undefined,
        symptoms: allSymptoms.length > 0 ? allSymptoms.join(", ") : undefined,
        notes: notes.trim() ? notes.trim() : undefined,
      });

      toast({
        title: "Check-in saved!",
        description: `${getSlotLabel(selectedSlot)} check-in recorded.`,
      });

      setSelectedMood(null);
      setSelectedEnergy(null);
      setSelectedSymptoms([]);
      setCustomSymptoms("");
      setNotes("");
    } catch (error) {
      toast({
        title: "Oops!",
        description:
          error instanceof Error ? error.message : "Failed to save check-in",
        variant: "destructive",
      });
    }
  }

  const cardClass =
    "h-full bg-card rounded-xl p-6 border border-border shadow-sm flex flex-col overflow-hidden";

  const moodLabel = (mood: string) =>
    mood === "happy" ? "great" : mood === "neutral" ? "okay" : "not so good";

  const moodIcon = (mood: string) =>
    mood === "happy" ? (
      <Smile className="w-4 h-4" />
    ) : mood === "neutral" ? (
      <Meh className="w-4 h-4" />
    ) : (
      <Frown className="w-4 h-4" />
    );

  const timeLabel = (log: any) => {
    try {
      return log?.created_at ? format(new Date(log.created_at), "p") : "";
    } catch {
      return "";
    }
  };

  const slotLabelFn = (log: any) => {
    const slot = log?.slot || log?.time_of_day;
    if (!slot) return "";
    return getSlotLabel(slot as CheckinSlot);
  };

  const previewText = (log: any) => {
    const raw =
      (log?.notes && String(log.notes)) ||
      (log?.symptoms && String(log.symptoms)) ||
      "";
    const trimmed = raw.trim();
    if (!trimmed) return "";
    return trimmed.length > 44 ? trimmed.slice(0, 44) + "…" : trimmed;
  };

  if (checkingTodayLogs) {
    return (
      <div className={cardClass + " items-center justify-center"}>
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const hasAnyLogs = todayLogs.length > 0;
  const lastTwo = hasAnyLogs ? todayLogs.slice(-2).reverse() : [];
  const suggestedSlot = getSuggestedSlot();
  const suggestedSlotCompleted = completedSlots.has(suggestedSlot);

  const moodBtnBase =
    "flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-lg border transition-all min-w-0";
  const moodBtnInactive = "border-border hover:bg-muted";
  const moodBtnActive = "border-primary bg-primary/5 text-primary";

  const slotBtnBase =
    "flex-1 flex items-center justify-center gap-1 py-2 px-1 rounded-lg border transition-all text-xs min-w-0";
  const slotBtnInactive = "border-border hover:bg-muted text-muted-foreground";
  const slotBtnActive = "border-primary bg-primary/10 text-primary font-medium";
  const slotBtnCompleted = "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400";

  const energyBtnBase =
    "flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg border transition-all min-w-0";
  const energyBtnInactive = "border-border hover:bg-muted text-muted-foreground";
  const energyBtnActive = "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400";

  // Count of selected symptoms for badge
  const selectedCount = selectedSymptoms.length;

  return (
    <div className={cardClass}>
      <div className="text-center">
        <h3 className="font-serif text-2xl font-semibold">Daily Check-in</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {suggestedSlotCompleted 
            ? "Add another check-in anytime" 
            : "How are you feeling right now?"}
        </p>
      </div>

      <div className="mt-4 flex gap-1.5 w-full">
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

      <div className="mt-4 flex gap-2 w-full">
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
          <Smile className="w-5 h-5" />
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
          <Meh className="w-5 h-5" />
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
          <Frown className="w-5 h-5" />
          <span className="text-xs font-medium">Not good</span>
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <div className="text-xs font-medium">Energy (optional)</div>
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

      <div className="mt-4 space-y-2">
        <div className="text-xs font-medium">Symptoms (optional)</div>
        
        {/* Custom symptoms input */}
        <Input
          value={customSymptoms}
          onChange={(e) => setCustomSymptoms(e.target.value)}
          placeholder="How are you feeling? (e.g., Energetic, Anxious, Baby kicking!)"
          className="bg-background text-sm"
        />
        
        {/* Collapsible common symptoms */}
        <button
          type="button"
          onClick={() => setShowCommonSymptoms(!showCommonSymptoms)}
          className="flex items-center justify-between w-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted rounded-lg border border-border transition-colors"
        >
          <span className="flex items-center gap-2">
            Common symptoms
            {selectedCount > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded-full">
                {selectedCount} selected
              </span>
            )}
          </span>
          {showCommonSymptoms ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        
        {showCommonSymptoms && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SYMPTOM_CHIPS.map((symptom) => (
              <button
                key={symptom}
                type="button"
                onClick={() => toggleSymptom(symptom)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-full border transition-all",
                  selectedSymptoms.includes(symptom)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border hover:bg-muted text-muted-foreground"
                )}
              >
                {symptom}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <div className="text-xs font-medium">Notes (optional)</div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything you want to remember?"
          className="resize-none bg-background"
          rows={2}
        />
      </div>

      <Button
        className="w-full mt-4"
        onClick={saveCheckin}
        disabled={createLogMutation.isPending}
      >
        {createLogMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          `Save ${getSlotLabel(selectedSlot)} check-in`
        )}
      </Button>

      <BreathingMoment mood={selectedMood} />

      {hasAnyLogs && (
        <>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Today's check-ins
          </p>

          <div className="space-y-2 mt-3">
            {lastTwo.map((log: any, idx: number) => (
              <div
                key={log?.id ?? idx}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
              >
                <div className="mt-[2px] text-muted-foreground">
                  {moodIcon(log?.mood)}
                </div>

                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                    <span className="font-medium">{slotLabelFn(log)}</span>
                    <span>•</span>
                    <span>{timeLabel(log)}</span>
                    {log?.mood && (
                      <>
                        <span>•</span>
                        <span>feeling {moodLabel(log.mood)}</span>
                      </>
                    )}
                  </div>

                  {previewText(log) ? (
                    <div className="text-sm text-foreground leading-snug truncate">
                      {previewText(log)}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">
                      (no notes)
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}