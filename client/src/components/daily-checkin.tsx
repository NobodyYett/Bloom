// client/src/components/daily-checkin.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Smile, Frown, Meh, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCreatePregnancyLog, useTodayLogs } from "@/hooks/usePregnancyLogs";
import { format } from "date-fns";

interface DailyCheckInProps {
  currentWeek: number;
}

export function DailyCheckIn({ currentWeek }: DailyCheckInProps) {
  const { toast } = useToast();
  const todayDate = format(new Date(), "yyyy-MM-dd");

  const { data: todayLogs = [], isLoading: checkingTodayLogs } =
    useTodayLogs(todayDate);

  const createLogMutation = useCreatePregnancyLog();

  // Form state
  const [selectedMood, setSelectedMood] = useState<"happy" | "neutral" | "sad" | null>(null);
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");

  async function saveCheckin() {
    if (!selectedMood) {
      toast({
        title: "Please select a mood",
        description: "Let us know how you're feeling today.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createLogMutation.mutateAsync({
        date: todayDate,
        week: currentWeek,
        mood: selectedMood,
        symptoms: symptoms.trim() ? symptoms.trim() : undefined,
        notes: notes.trim() ? notes.trim() : undefined,
      });

      toast({
        title: "Check-in saved!",
        description: "Thanks for tracking your day.",
      });

      // Reset form
      setSelectedMood(null);
      setSymptoms("");
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
    "h-full bg-card rounded-xl p-6 border border-border shadow-sm flex flex-col";

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

  const moodBtnBase =
    "flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-lg border transition-all min-w-0";
  const moodBtnInactive = "border-border hover:bg-muted";
  const moodBtnActive = "border-primary bg-primary/5 text-primary";

  return (
    <div className={cardClass}>
      {/* Header */}
      <div className="text-center">
        <h3 className="font-serif text-2xl font-semibold">Daily Check-in</h3>
        <p className="text-base text-muted-foreground mt-1">
          How are you feeling right now?
        </p>
      </div>

      {/* Mood buttons - centered and responsive */}
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

      {/* Always visible: Selected indicator + Symptoms + Notes + Save */}
      <div className="mt-4 space-y-3">
        {selectedMood && (
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-2">
            {moodIcon(selectedMood)}
            <span>
              Selected: <span className="font-medium">feeling {moodLabel(selectedMood)}</span>
            </span>
          </div>
        )}

        <div>
          <div className="text-xs font-medium mb-1">Symptoms (optional)</div>
          <Textarea
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="Any symptoms right now?"
            className="resize-none bg-background"
            rows={2}
          />
        </div>

        <div>
          <div className="text-xs font-medium mb-1">Notes (optional)</div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything you want to remember?"
            className="resize-none bg-background"
            rows={2}
          />
        </div>

        <Button
          className="w-full"
          onClick={saveCheckin}
          disabled={createLogMutation.isPending}
        >
          {createLogMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save check-in"
          )}
        </Button>
      </div>

      {/* Previous entries section - only show if there are logs */}
      {hasAnyLogs && (
        <>
          <p className="text-sm text-muted-foreground mt-5 text-center">
            Here's how today's been feeling so far.
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

                <div className="space-y-0.5">
                  <div className="text-xs text-muted-foreground">
                    {timeLabel(log)}{" "}
                    {log?.mood ? `• feeling ${moodLabel(log.mood)}` : ""}
                  </div>

                  {previewText(log) ? (
                    <div className="text-sm text-foreground leading-snug">
                      "{previewText(log)}"
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