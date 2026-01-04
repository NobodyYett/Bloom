// client/src/components/weekly-summary.tsx

import { useMemo, useState, useEffect } from "react";
import { useWeekLogs } from "@/hooks/usePregnancyLogs";
import { BarChart3, Smile, Meh, Frown, Zap, Sun, Sunset, Moon, TrendingUp, Sparkles, Check, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNudgeForCheckin, isNudgeCompleted, markNudgeCompleted, type CheckinContext } from "@/lib/nudges";
import { Checkbox } from "@/components/ui/checkbox";

interface WeeklySummaryProps {
  isPaid?: boolean;
  checkinContext?: CheckinContext | null;
  isPartnerView?: boolean;
}

type Mood = "happy" | "neutral" | "sad";
type Energy = "high" | "medium" | "low";
type Slot = "morning" | "evening" | "night";

interface WeekStats {
  totalCheckins: number;
  moodCounts: Record<Mood, number>;
  dominantMood: Mood | null;
  symptomCounts: Record<string, number>;
  topSymptoms: string[];
  slotCounts: Record<Slot, number>;
  challengingSlot: Slot | null;
  energyCounts: Record<Energy, number>;
  hasEnergyData: boolean;
  dominantEnergy: Energy | null;
}

function analyzeWeekLogs(logs: any[]): WeekStats {
  const moodCounts: Record<Mood, number> = { happy: 0, neutral: 0, sad: 0 };
  const symptomCounts: Record<string, number> = {};
  const slotCounts: Record<Slot, number> = { morning: 0, evening: 0, night: 0 };
  const energyCounts: Record<Energy, number> = { high: 0, medium: 0, low: 0 };
  
  let hasEnergyData = false;

  for (const log of logs) {
    if (log.mood && moodCounts.hasOwnProperty(log.mood)) {
      moodCounts[log.mood as Mood]++;
    }

    if (log.symptoms) {
      const symptoms = String(log.symptoms).split(",").map((s: string) => s.trim().toLowerCase());
      for (const symptom of symptoms) {
        if (symptom) {
          symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
        }
      }
    }

    const slot = log.slot || log.time_of_day;
    if (slot && slotCounts.hasOwnProperty(slot)) {
      slotCounts[slot as Slot]++;
    }

    if (log.energy && energyCounts.hasOwnProperty(log.energy)) {
      energyCounts[log.energy as Energy]++;
      hasEnergyData = true;
    }
  }

  let dominantMood: Mood | null = null;
  let maxMoodCount = 0;
  for (const [mood, count] of Object.entries(moodCounts)) {
    if (count > maxMoodCount) {
      maxMoodCount = count;
      dominantMood = mood as Mood;
    }
  }

  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([symptom]) => symptom.charAt(0).toUpperCase() + symptom.slice(1));

  let challengingSlot: Slot | null = null;
  const slotSadNeutral: Record<Slot, number> = { morning: 0, evening: 0, night: 0 };
  for (const log of logs) {
    const slot = log.slot || log.time_of_day;
    if (slot && (log.mood === "sad" || log.mood === "neutral")) {
      slotSadNeutral[slot as Slot]++;
    }
  }
  let maxChallenging = 0;
  for (const [slot, count] of Object.entries(slotSadNeutral)) {
    if (count > maxChallenging && slotCounts[slot as Slot] > 0) {
      maxChallenging = count;
      challengingSlot = slot as Slot;
    }
  }

  let dominantEnergy: Energy | null = null;
  let maxEnergyCount = 0;
  for (const [energy, count] of Object.entries(energyCounts)) {
    if (count > maxEnergyCount) {
      maxEnergyCount = count;
      dominantEnergy = energy as Energy;
    }
  }

  return {
    totalCheckins: logs.length,
    moodCounts,
    dominantMood,
    symptomCounts,
    topSymptoms,
    slotCounts,
    challengingSlot,
    energyCounts,
    hasEnergyData,
    dominantEnergy,
  };
}

function getMoodLabel(mood: Mood): string {
  return mood === "happy" ? "great" : mood === "neutral" ? "okay" : "not great";
}

function getEnergyLabel(energy: Energy): string {
  return energy === "high" ? "high energy" : energy === "medium" ? "moderate energy" : "lower energy";
}

const moodIcons: Record<Mood, React.ReactNode> = {
  happy: <Smile className="w-4 h-4 text-green-600 dark:text-green-400" />,
  neutral: <Meh className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />,
  sad: <Frown className="w-4 h-4 text-red-600 dark:text-red-400" />,
};

export function WeeklySummary({ 
  isPaid = false, 
  checkinContext = null,
  isPartnerView = false 
}: WeeklySummaryProps) {
  // Fetch logs - for partners this will fetch mom's logs
  const { data: weekLogs = [], isLoading } = useWeekLogs();
  const stats = useMemo(() => analyzeWeekLogs(weekLogs), [weekLogs]);

  // Nudge state - only for mom view
  const [nudgeCompleted, setNudgeCompleted] = useState(false);
  const nudge = getNudgeForCheckin(checkinContext);

  useEffect(() => {
    if (!isPartnerView) {
      setNudgeCompleted(isNudgeCompleted());
    }
  }, [isPartnerView]);

  function handleNudgeToggle(checked: boolean) {
    if (checked) {
      markNudgeCompleted();
      setNudgeCompleted(true);
    }
  }

  // Build summary text - simplified for partner
  const summaryParts: string[] = [];
  if (stats.dominantMood) {
    const moodText = getMoodLabel(stats.dominantMood);
    summaryParts.push(`Feeling mostly ${moodText} this week`);
  }
  // Show symptoms for both mom and partner (so partner can be supportive)
  if (stats.topSymptoms.length > 0) {
    const symptomsText = stats.topSymptoms.slice(0, 2).join(" and ").toLowerCase();
    summaryParts.push(`with ${symptomsText} showing up most often`);
  }

  const freeRecap = summaryParts.length > 0 
    ? summaryParts.join(", ") + "."
    : "No check-ins recorded this week yet.";

  const hasWeekData = !isLoading && stats.totalCheckins > 0;

  // Partner view: simplified card showing mood/energy summary (no private notes)
  if (isPartnerView) {
    return (
      <section className="bg-card rounded-xl p-6 border border-border shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
            <Heart className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h2 className="font-medium text-sm">How She's Feeling</h2>
            <p className="text-xs text-muted-foreground">
              {hasWeekData 
                ? `${stats.totalCheckins} check-in${stats.totalCheckins !== 1 ? "s" : ""} this week`
                : "Waiting for check-ins"
              }
            </p>
          </div>
        </div>

        {hasWeekData && (
          <>
            {/* Summary Text - mood focused */}
            <p className="text-sm text-foreground leading-relaxed mb-4">
              {stats.dominantMood 
                ? `Feeling mostly ${getMoodLabel(stats.dominantMood)} this week${stats.topSymptoms.length > 0 ? `, with ${stats.topSymptoms.slice(0, 2).join(" and ").toLowerCase()} showing up most often` : ""}.`
                : "Check-ins recorded this week."
              }
            </p>

            {/* Visual Stats Row */}
            <div className="grid grid-cols-3 gap-3">
              {/* Mood Distribution */}
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-2">Mood</div>
                <div className="flex items-center gap-1.5">
                  {(["happy", "neutral", "sad"] as Mood[]).map((mood) => (
                    <div key={mood} className="flex items-center gap-0.5">
                      {moodIcons[mood]}
                      <span className="text-xs font-medium">{stats.moodCounts[mood]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Symptom */}
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-2">Top symptom</div>
                <div className="text-sm font-medium truncate">
                  {stats.topSymptoms[0] || "None"}
                </div>
              </div>

              {/* Energy */}
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-2">Energy</div>
                <div className="flex items-center gap-1">
                  <Zap className={cn(
                    "w-4 h-4",
                    stats.dominantEnergy === "high" ? "text-green-500" :
                    stats.dominantEnergy === "medium" ? "text-yellow-500" : "text-red-500"
                  )} />
                  <span className="text-sm font-medium capitalize">
                    {stats.dominantEnergy || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Supportive tip based on how she's feeling */}
            {(stats.dominantMood === "sad" || stats.dominantEnergy === "low") && (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  💙 {stats.dominantMood === "sad" 
                    ? "She might need extra support this week. Small gestures like making dinner or giving her space to rest can help."
                    : "Energy has been low. Consider taking on extra tasks around the house to help her rest."}
                </p>
              </div>
            )}
          </>
        )}

        {!hasWeekData && !isLoading && (
          <p className="text-sm text-muted-foreground">
            Check back later to see how the week is going.
          </p>
        )}
      </section>
    );
  }

  // Mom view: full card with nudge and all details
  return (
    <section className="bg-card rounded-xl p-6 border border-border shadow-sm">
      {/* Today's Gentle Nudge */}
      <div className="flex items-start gap-3 mb-4">
        <div className={cn(
          "shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5",
          nudgeCompleted 
            ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" 
            : "bg-primary/10 text-primary"
        )}>
          {nudgeCompleted ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-muted-foreground mb-1">Today's gentle nudge</h3>
          <div className="flex items-center gap-3">
            <p className={cn(
              "text-sm flex-1",
              nudgeCompleted ? "text-muted-foreground line-through" : "text-foreground"
            )}>
              {nudgeCompleted ? "Nice. Small wins count." : nudge.message}
            </p>
            {!nudgeCompleted && (
              <Checkbox 
                checked={nudgeCompleted}
                onCheckedChange={handleNudgeToggle}
                className="shrink-0"
              />
            )}
          </div>
        </div>
      </div>

      {/* Divider - only show if we have week data */}
      {hasWeekData && (
        <div className="border-t border-border my-4" />
      )}

      {/* Week at a Glance - only show if we have data */}
      {hasWeekData && (
        <>
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-medium text-sm">Your Week at a Glance</h2>
              <p className="text-xs text-muted-foreground">{stats.totalCheckins} check-in{stats.totalCheckins !== 1 ? "s" : ""} over the last 7 days</p>
            </div>
          </div>

          {/* Summary Text */}
          <p className="text-sm text-foreground leading-relaxed mb-4">
            {freeRecap}
          </p>

          {/* Visual Stats Row */}
          <div className="flex gap-3 mb-4">
            {/* Mood Distribution */}
            <div className="flex-1 bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-2">Mood</div>
              <div className="flex items-center gap-2">
                {(["happy", "neutral", "sad"] as Mood[]).map((mood) => (
                  <div key={mood} className="flex items-center gap-1">
                    {moodIcons[mood]}
                    <span className="text-xs font-medium">{stats.moodCounts[mood]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Symptom */}
            {stats.topSymptoms.length > 0 && (
              <div className="flex-1 bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-2">Top symptom</div>
                <div className="text-sm font-medium truncate">{stats.topSymptoms[0]}</div>
              </div>
            )}

            {/* Energy (if data exists) */}
            {stats.hasEnergyData && stats.dominantEnergy && (
              <div className="flex-1 bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-2">Energy</div>
                <div className="flex items-center gap-1">
                  <Zap className={cn(
                    "w-4 h-4",
                    stats.dominantEnergy === "high" ? "text-amber-500" :
                    stats.dominantEnergy === "medium" ? "text-amber-400" : "text-amber-300"
                  )} />
                  <span className="text-sm font-medium capitalize">{stats.dominantEnergy}</span>
                </div>
              </div>
            )}
          </div>

          {/* Challenging Time (Paid only) */}
          {isPaid && stats.challengingSlot && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 bg-muted/30 rounded-lg px-3 py-2">
              <Sun className="w-4 h-4" />
              <span>
                {stats.challengingSlot.charAt(0).toUpperCase() + stats.challengingSlot.slice(1)}s tend to be your tougher time
              </span>
            </div>
          )}

          {/* Paid Suggestion */}
          {isPaid && (
            <div className="flex items-start gap-2 text-sm bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
              <TrendingUp className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-foreground">Keep listening to your body — you're doing great.</p>
            </div>
          )}

          {/* Free Upgrade Hint */}
          {!isPaid && stats.totalCheckins >= 3 && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Upgrade to Premium for deeper insights and personalized suggestions.
            </p>
          )}
        </>
      )}
    </section>
  );
}