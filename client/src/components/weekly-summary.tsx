// client/src/components/weekly-summary.tsx

import { useMemo, useState, useEffect } from "react";
import { useWeekLogs } from "@/hooks/usePregnancyLogs";
import { 
  BarChart3, Smile, Meh, Frown, Zap, Sun, Sunset, Moon, 
  TrendingUp, Sparkles, Check, Heart, Droplets, Pill,
  Coffee, Car, ShoppingBag, Bath, MessageCircle, Utensils,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNudgeForCheckin, isNudgeCompleted, markNudgeCompleted, type CheckinContext } from "@/lib/nudges";
import { Checkbox } from "@/components/ui/checkbox";

interface WeeklySummaryProps {
  isPaid?: boolean;
  checkinContext?: CheckinContext | null;
  isPartnerView?: boolean;
  // Partner view props
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

// Generate dynamic support suggestions based on check-in data
interface SupportSuggestion {
  icon: React.ReactNode;
  text: string;
}

function getSupportSuggestions(
  stats: WeekStats,
  trimester: 1 | 2 | 3,
  hasUpcomingAppointment: boolean,
  momName?: string | null
): SupportSuggestion[] {
  const suggestions: SupportSuggestion[] = [];
  const name = momName || "her";

  // Energy-based suggestions
  if (stats.dominantEnergy === "low") {
    suggestions.push({
      icon: <Coffee className="w-4 h-4 text-amber-600" />,
      text: "Energy has been low — consider taking on extra tasks around the house so she can rest.",
    });
  }

  // Symptom-based suggestions
  const symptomsLower = stats.topSymptoms.map(s => s.toLowerCase());
  
  if (symptomsLower.includes("headache") || symptomsLower.includes("headaches")) {
    suggestions.push({
      icon: <Moon className="w-4 h-4 text-indigo-500" />,
      text: "Headaches have been showing up — help keep lights dim and water nearby.",
    });
  }
  
  if (symptomsLower.includes("nausea")) {
    suggestions.push({
      icon: <Utensils className="w-4 h-4 text-green-600" />,
      text: "Nausea has been tough — offer to prepare bland, easy foods or pick up her favorites.",
    });
  }
  
  if (symptomsLower.includes("back pain") || symptomsLower.includes("cramps")) {
    suggestions.push({
      icon: <Bath className="w-4 h-4 text-blue-500" />,
      text: "She's been dealing with aches — a gentle back rub or warm bath could help.",
    });
  }
  
  if (symptomsLower.includes("insomnia") || symptomsLower.includes("fatigue")) {
    suggestions.push({
      icon: <Moon className="w-4 h-4 text-indigo-500" />,
      text: "Sleep has been difficult — help keep the room cool and be patient with restless nights.",
    });
  }

  // Mood-based suggestions
  if (stats.dominantMood === "sad") {
    suggestions.push({
      icon: <MessageCircle className="w-4 h-4 text-rose-500" />,
      text: `She might need extra support — sometimes ${name} just needs you to listen, not solve.`,
    });
  }

  // Appointment suggestion
  if (hasUpcomingAppointment) {
    suggestions.push({
      icon: <Calendar className="w-4 h-4 text-primary" />,
      text: "An appointment is coming up — planning to attend can mean a lot.",
    });
  }

  // Trimester-based fallback suggestions if we don't have enough
  if (suggestions.length < 2) {
    if (trimester === 1) {
      suggestions.push({
        icon: <Heart className="w-4 h-4 text-rose-500" />,
        text: "First trimester can be exhausting — let her rest without guilt.",
      });
    } else if (trimester === 2) {
      suggestions.push({
        icon: <ShoppingBag className="w-4 h-4 text-primary" />,
        text: "Great time to start on the nursery together — offer to help set things up.",
      });
    } else {
      suggestions.push({
        icon: <ShoppingBag className="w-4 h-4 text-primary" />,
        text: "Getting close! Make sure the hospital bag is packed and routes are planned.",
      });
    }
  }

  // Compliment suggestion (always nice to have)
  if (suggestions.length < 3) {
    suggestions.push({
      icon: <Heart className="w-4 h-4 text-rose-500" />,
      text: `Body changes can feel strange — remind ${name} how amazing she looks.`,
    });
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

  // Build summary text
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

  const hasWeekData = !isLoading && stats.totalCheckins > 0;

  // Get dynamic support suggestions for partner view
  const supportSuggestions = useMemo(() => 
    getSupportSuggestions(stats, trimester, hasUpcomingAppointment, momName),
    [stats, trimester, hasUpcomingAppointment, momName]
  );

  // ============================================
  // PARTNER VIEW: Unified "How She's Doing" Card
  // ============================================
  if (isPartnerView) {
    return (
      <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="bg-gradient-to-r from-purple-50 to-rose-50 dark:from-purple-950/30 dark:to-rose-950/30 px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-card border border-border flex items-center justify-center shadow-sm">
              <span className="text-lg">💜</span>
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold">How She's Doing & How You Can Help</h2>
              <p className="text-xs text-muted-foreground">
                {hasWeekData 
                  ? `Based on ${stats.totalCheckins} check-in${stats.totalCheckins !== 1 ? "s" : ""} this week`
                  : "Waiting for check-ins"
                }
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Section 1: Status */}
          {hasWeekData ? (
            <>
              {/* Summary sentence */}
              <p className="text-sm text-foreground leading-relaxed">
                {freeRecap}
              </p>

              {/* Compact indicators */}
              <div className="grid grid-cols-3 gap-3">
                {/* Mood */}
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

              {/* Section 2: Support Guidance */}
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Heart className="w-3 h-3" />
                  Based on her check-ins this week
                </p>

                <div className="space-y-2.5">
                  {supportSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
                    >
                      <div className="w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center shrink-0 mt-0.5">
                        {suggestion.icon}
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {suggestion.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-2">
                No check-ins yet this week.
              </p>
              <p className="text-xs text-muted-foreground">
                Once she logs how she's feeling, you'll see a summary here with ways to help.
              </p>
            </div>
          )}

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center pt-3 border-t border-border">
            Being present and supportive is one of the best gifts you can give. 💜
          </p>
        </div>
      </section>
    );
  }

  // ============================================
  // MOM VIEW: Original full card with nudge
  // ============================================
  return (
    <section className="bg-card rounded-xl p-6 border border-border shadow-sm">
      {/* Today's Gentle Nudge */}
      {!nudgeCompleted && nudge && (
        <div className="flex items-start gap-3 pb-4 mb-4 border-b border-border">
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground mb-1">Today's gentle nudge</p>
            <p className="text-sm text-foreground">{nudge}</p>
          </div>
          <Checkbox
            checked={nudgeCompleted}
            onCheckedChange={handleNudgeToggle}
            className="mt-1"
          />
        </div>
      )}

      {/* Header */}
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
          {/* Summary Text */}
          <p className="text-sm text-foreground leading-relaxed mb-4">
            {freeRecap}
          </p>

          {/* Visual Stats Row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
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

          {/* Premium upsell */}
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