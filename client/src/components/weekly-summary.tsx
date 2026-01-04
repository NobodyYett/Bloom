// client/src/components/weekly-summary.tsx

import { useMemo, useState, useEffect } from "react";
import { useWeekLogs } from "@/hooks/usePregnancyLogs";
import { 
  BarChart3, Smile, Meh, Frown, Zap, Sparkles, Heart,
  Coffee, Moon, Bath, MessageCircle, Utensils, Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNudgeForCheckin, isNudgeCompleted, markNudgeCompleted, type CheckinContext } from "@/lib/nudges";
import { Checkbox } from "@/components/ui/checkbox";

interface WeeklySummaryProps {
  isPaid?: boolean;
  checkinContext?: CheckinContext | null;
  isPartnerView?: boolean;
  currentWeek?: number;
  trimester?: 1 | 2 | 3;
  momName?: string | null;
  hasUpcomingAppointment?: boolean;
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

  const dominantMood = (Object.entries(moodCounts) as [Mood, number][])
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([symptom]) => symptom.charAt(0).toUpperCase() + symptom.slice(1));

  const challengingSlot = (Object.entries(slotCounts) as [Slot, number][])
    .filter(([_, count]) => count > 0)
    .sort((a, b) => {
      const sadAtA = logs.filter(l => (l.slot || l.time_of_day) === a[0] && l.mood === "sad").length;
      const sadAtB = logs.filter(l => (l.slot || l.time_of_day) === b[0] && l.mood === "sad").length;
      return sadAtB - sadAtA;
    })[0]?.[0] || null;

  const dominantEnergy = hasEnergyData
    ? (Object.entries(energyCounts) as [Energy, number][])
        .filter(([_, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null
    : null;

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
  switch (mood) {
    case "happy": return "great";
    case "neutral": return "okay";
    case "sad": return "not so great";
  }
}

const moodIcons: Record<Mood, React.ReactNode> = {
  happy: <Smile className="w-4 h-4 text-green-600 dark:text-green-400" />,
  neutral: <Meh className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />,
  sad: <Frown className="w-4 h-4 text-red-600 dark:text-red-400" />,
};

// Generate support suggestions based on check-in data
interface SupportSuggestion {
  icon: React.ReactNode;
  text: string;
}

function getSupportSuggestions(
  stats: WeekStats,
  trimester: 1 | 2 | 3,
  hasUpcomingAppointment: boolean
): SupportSuggestion[] {
  const suggestions: SupportSuggestion[] = [];

  if (stats.dominantEnergy === "low") {
    suggestions.push({
      icon: <Coffee className="w-4 h-4" />,
      text: "Energy has been low — consider taking on an extra task so she can rest.",
    });
  }

  const symptomsLower = stats.topSymptoms.map(s => s.toLowerCase());
  
  if (symptomsLower.includes("headache") || symptomsLower.includes("headaches")) {
    suggestions.push({
      icon: <Moon className="w-4 h-4" />,
      text: "Headaches have been showing up — helping keep lights dim and water nearby may help.",
    });
  }
  
  if (symptomsLower.includes("nausea")) {
    suggestions.push({
      icon: <Utensils className="w-4 h-4" />,
      text: "Nausea has been tough — offering to prepare bland, easy foods could help.",
    });
  }
  
  if (symptomsLower.includes("back pain") || symptomsLower.includes("cramps")) {
    suggestions.push({
      icon: <Bath className="w-4 h-4" />,
      text: "She's been dealing with aches — a gentle back rub or warm bath could help.",
    });
  }
  
  if (symptomsLower.includes("insomnia") || symptomsLower.includes("fatigue")) {
    suggestions.push({
      icon: <Moon className="w-4 h-4" />,
      text: "Sleep has been difficult — helping keep evenings calm may help.",
    });
  }

  if (stats.dominantMood === "sad") {
    suggestions.push({
      icon: <MessageCircle className="w-4 h-4" />,
      text: "She may need extra support — sometimes listening without trying to fix things helps most.",
    });
  }

  if (hasUpcomingAppointment) {
    suggestions.push({
      icon: <Calendar className="w-4 h-4" />,
      text: "An appointment is coming up — planning to attend can mean a lot.",
    });
  }

  if (suggestions.length < 2) {
    if (trimester === 1) {
      suggestions.push({
        icon: <Heart className="w-4 h-4" />,
        text: "First trimester can be exhausting — being patient with fatigue goes a long way.",
      });
    } else if (trimester === 2) {
      suggestions.push({
        icon: <Heart className="w-4 h-4" />,
        text: "Body changes can feel strange — reminding her how amazing she looks helps.",
      });
    } else {
      suggestions.push({
        icon: <Heart className="w-4 h-4" />,
        text: "The final stretch can be uncomfortable — small comforts make a big difference.",
      });
    }
  }

  return suggestions.slice(0, 3);
}

export function WeeklySummary({ 
  isPaid = false, 
  checkinContext = null,
  isPartnerView = false,
  currentWeek = 0,
  trimester = 2,
  momName = null,
  hasUpcomingAppointment = false,
}: WeeklySummaryProps) {
  const { data: weekLogs = [], isLoading } = useWeekLogs();
  const stats = useMemo(() => analyzeWeekLogs(weekLogs), [weekLogs]);

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

  // Build summary text - different for mom vs partner
  const summaryParts: string[] = [];
  if (stats.dominantMood) {
    const moodText = getMoodLabel(stats.dominantMood);
    summaryParts.push(`Feeling mostly ${moodText} this week`);
  }
  if (stats.topSymptoms.length > 0) {
    const symptomsText = stats.topSymptoms.slice(0, 2).join(" and ").toLowerCase();
    summaryParts.push(`with ${symptomsText} showing up most often`);
  }

  const freeRecap = summaryParts.length > 0 
    ? summaryParts.join(", ") + "."
    : "No check-ins recorded this week yet.";

  // Partner-specific personal summary (uses mom's name or "She")
  const partnerSummary = useMemo(() => {
    if (!stats.dominantMood) {
      return momName 
        ? `${momName} hasn't logged any check-ins this week yet.`
        : "No check-ins recorded this week yet.";
    }
    
    const moodText = getMoodLabel(stats.dominantMood);
    const nameOrShe = momName || "She";
    
    let summary = `${nameOrShe}'s been feeling mostly ${moodText} this week`;
    
    if (stats.topSymptoms.length > 0) {
      const symptomsText = stats.topSymptoms.slice(0, 2).join(" and ").toLowerCase();
      summary += `, with ${symptomsText} showing up most often`;
    }
    
    return summary + ".";
  }, [stats.dominantMood, stats.topSymptoms, momName]);

  const hasWeekData = !isLoading && stats.totalCheckins > 0;

  const supportSuggestions = useMemo(() => 
    getSupportSuggestions(stats, trimester, hasUpcomingAppointment),
    [stats, trimester, hasUpcomingAppointment]
  );

  // PARTNER VIEW - Neutral styling, vertical stats
  if (isPartnerView) {
    return (
      <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Header - neutral dark styling, no purple */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <Heart className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-medium text-sm text-foreground">
                {momName ? `How ${momName}'s Feeling` : "How She's Feeling"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {hasWeekData 
                  ? `${stats.totalCheckins} check-in${stats.totalCheckins !== 1 ? "s" : ""} this week`
                  : "Waiting for check-ins"
                }
              </p>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="p-5">
          {hasWeekData ? (
            <div className="space-y-4">
              {/* Summary text - personal for partner */}
              <p className="text-sm text-foreground/90 leading-relaxed">
                {partnerSummary}
              </p>

              {/* Vertical stacked indicators */}
              <div className="space-y-2">
                {/* Mood Row */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <span className="text-xs text-muted-foreground">Mood</span>
                  <div className="flex items-center gap-2">
                    {(["happy", "neutral", "sad"] as Mood[]).map((mood) => (
                      <div key={mood} className="flex items-center gap-1">
                        {moodIcons[mood]}
                        <span className="text-xs font-medium">{stats.moodCounts[mood]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Symptom Row */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <span className="text-xs text-muted-foreground">Top Symptom</span>
                  <span className="text-sm font-medium">
                    {stats.topSymptoms[0] || "None"}
                  </span>
                </div>

                {/* Energy Row */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <span className="text-xs text-muted-foreground">Energy</span>
                  <div className="flex items-center gap-1.5">
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
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                {momName 
                  ? `Once ${momName} logs how she's feeling, you'll see a summary here.`
                  : "Once she logs how she's feeling, you'll see a summary here."
                }
              </p>
            </div>
          )}
        </div>

        {/* Support Section */}
        <div className="px-5 pb-5">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              How You Can Help
            </span>
          </div>

          {hasWeekData && supportSuggestions.length > 0 ? (
            <div className="space-y-2">
              {supportSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 text-muted-foreground">
                    {suggestion.icon}
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {suggestion.text}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-3 px-4 rounded-lg bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Support suggestions will appear once check-ins are recorded.
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  // MOM VIEW
  return (
    <section className="bg-card rounded-xl p-6 border border-border shadow-sm">
      {/* Today's Gentle Nudge - FIXED: nudge.message instead of nudge */}
      {!nudgeCompleted && nudge && (
        <div className="flex items-start gap-3 pb-4 mb-4 border-b border-border">
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground mb-1">Today's gentle nudge</p>
            <p className="text-sm text-foreground">{nudge.message}</p>
          </div>
          <Checkbox
            checked={nudgeCompleted}
            onCheckedChange={handleNudgeToggle}
            className="mt-1"
          />
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-medium text-sm">Your Week at a Glance</h2>
          <p className="text-xs text-muted-foreground">
            {hasWeekData 
              ? `${stats.totalCheckins} check-in${stats.totalCheckins !== 1 ? "s" : ""} over the last 7 days`
              : "Start checking in to see your week"
            }
          </p>
        </div>
      </div>

      {hasWeekData && (
        <>
          <p className="text-sm text-foreground leading-relaxed mb-4">{freeRecap}</p>

          <div className="grid grid-cols-3 gap-3 mb-4">
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

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-2">Top symptom</div>
              <div className="text-sm font-medium truncate">
                {stats.topSymptoms[0] || "None"}
              </div>
            </div>

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

          {!isPaid && (
            <p className="text-xs text-muted-foreground text-center">
              Upgrade to Premium for deeper insights and personalized suggestions.
            </p>
          )}
        </>
      )}

      {!hasWeekData && !isLoading && (
        <p className="text-sm text-muted-foreground">
          Check in daily to see patterns in your mood, energy, and symptoms.
        </p>
      )}
    </section>
  );
}