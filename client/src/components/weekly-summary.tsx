// client/src/components/weekly-summary.tsx

import { useMemo, useState, useEffect } from "react";
import { useWeekLogs, usePartnerWeeklyInsights, type PartnerInsightsWithTrends, type PartnerInsightsDeltas } from "@/hooks/usePregnancyLogs";
import { 
  BarChart3, Smile, Meh, Frown, Zap, Sparkles, Heart,
  Coffee, Moon, Bath, MessageCircle, Utensils, Calendar,
  TrendingUp, TrendingDown, Minus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNudgeForCheckin, isNudgeCompleted, markNudgeCompleted, type CheckinContext } from "@/lib/nudges";
import { getInfancyMomTip } from "@/lib/infancy-data";
import { Checkbox } from "@/components/ui/checkbox";
import { PremiumLock } from "@/components/premium-lock";

interface WeeklySummaryProps {
  isPaid?: boolean;
  checkinContext?: CheckinContext | null;
  isPartnerView?: boolean;
  currentWeek?: number;
  trimester?: 1 | 2 | 3;
  momName?: string | null;
  hasUpcomingAppointment?: boolean;
  appMode?: "pregnancy" | "infancy";
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
    case "sad": return "not great";
    default: return mood;
  }
}

/**
 * Convert partner RPC insights to WeekStats format
 * Now uses insights.current for the data
 */
function partnerInsightsToStats(insights: PartnerInsightsWithTrends | null | undefined): WeekStats {
  if (!insights || !insights.current) {
    return {
      totalCheckins: 0,
      moodCounts: { happy: 0, neutral: 0, sad: 0 },
      dominantMood: null,
      symptomCounts: {},
      topSymptoms: [],
      slotCounts: { morning: 0, evening: 0, night: 0 },
      challengingSlot: null,
      energyCounts: { high: 0, medium: 0, low: 0 },
      hasEnergyData: false,
      dominantEnergy: null,
    };
  }

  const current = insights.current;

  // Convert mood_counts from RPC format
  const moodCounts: Record<Mood, number> = {
    happy: current.mood_counts?.happy || 0,
    neutral: current.mood_counts?.neutral || 0,
    sad: current.mood_counts?.sad || 0,
  };

  // Convert energy_counts from RPC format
  const energyCounts: Record<Energy, number> = {
    high: current.energy_counts?.high || 0,
    medium: current.energy_counts?.medium || 0,
    low: current.energy_counts?.low || 0,
  };

  // Convert slot_counts from RPC format
  const slotCounts: Record<Slot, number> = {
    morning: current.slot_counts?.morning || 0,
    evening: current.slot_counts?.evening || 0,
    night: current.slot_counts?.night || 0,
  };

  // Determine dominant mood
  const dominantMood = (Object.entries(moodCounts) as [Mood, number][])
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Convert top_symptoms from array format
  const topSymptoms = (current.top_symptoms || [])
    .slice(0, 3)
    .map(s => s.symptom.charAt(0).toUpperCase() + s.symptom.slice(1));

  // Build symptomCounts from top_symptoms
  const symptomCounts: Record<string, number> = {};
  for (const s of current.top_symptoms || []) {
    symptomCounts[s.symptom] = s.count;
  }

  // Determine dominant energy
  const hasEnergyData = Object.values(energyCounts).some(c => c > 0);
  const dominantEnergy = hasEnergyData
    ? (Object.entries(energyCounts) as [Energy, number][])
        .filter(([_, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null
    : null;

  // Calculate total checkins from mood counts (each checkin has a mood)
  const totalCheckins = Object.values(moodCounts).reduce((a, b) => a + b, 0);

  return {
    totalCheckins,
    moodCounts,
    dominantMood,
    symptomCounts,
    topSymptoms,
    slotCounts,
    challengingSlot: null, // Not computed by RPC
    energyCounts,
    hasEnergyData,
    dominantEnergy,
  };
}

/**
 * Trend indicator component for partner view
 */
function TrendIndicator({ delta, showZero = false }: { delta: number; showZero?: boolean }) {
  if (delta === 0 && !showZero) return null;
  
  if (delta > 0) {
    return (
      <span className="inline-flex items-center text-xs text-green-600 dark:text-green-400 ml-1">
        <TrendingUp className="w-3 h-3 mr-0.5" />
        +{delta}
      </span>
    );
  } else if (delta < 0) {
    return (
      <span className="inline-flex items-center text-xs text-red-500 dark:text-red-400 ml-1">
        <TrendingDown className="w-3 h-3 mr-0.5" />
        {delta}
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center text-xs text-muted-foreground ml-1">
      <Minus className="w-3 h-3" />
    </span>
  );
}

// ============================================
// WEEK-OVER-WEEK TREND SYSTEM
// ============================================
// Returns directional labels only, no raw values exposed

type TrendDirection = "up" | "down" | "stable";

interface WeeklyTrends {
  mood: TrendDirection;
  energy: TrendDirection;
  symptoms: TrendDirection;
  overallWellbeing: TrendDirection;
}

interface TrendCopy {
  label: string;
  supportiveMessage: string;
}

/**
 * Compute directional trends from deltas (no raw values exposed)
 */
function computeWeeklyTrends(deltas: PartnerInsightsDeltas | null): WeeklyTrends | null {
  if (!deltas) return null;
  
  // Mood trend: positive if happy increased or sad decreased
  const moodScore = deltas.mood.happy - deltas.mood.sad;
  const moodTrend: TrendDirection = moodScore > 0 ? "up" : moodScore < 0 ? "down" : "stable";
  
  // Energy trend: positive if high increased or low decreased
  const energyScore = deltas.energy.high - deltas.energy.low;
  const energyTrend: TrendDirection = energyScore > 0 ? "up" : energyScore < 0 ? "down" : "stable";
  
  // Symptoms trend: negative if more symptoms increased than decreased
  const symptomsWorsened = deltas.symptoms.increased.length + deltas.symptoms.new.length;
  const symptomsImproved = deltas.symptoms.decreased.length + deltas.symptoms.gone.length;
  const symptomScore = symptomsImproved - symptomsWorsened;
  const symptomsTrend: TrendDirection = symptomScore > 0 ? "up" : symptomScore < 0 ? "down" : "stable";
  
  // Overall wellbeing: weighted combination
  const overallScore = moodScore + energyScore + symptomScore;
  const overallTrend: TrendDirection = overallScore > 0 ? "up" : overallScore < 0 ? "down" : "stable";
  
  return {
    mood: moodTrend,
    energy: energyTrend,
    symptoms: symptomsTrend,
    overallWellbeing: overallTrend,
  };
}

/**
 * Get supportive copy for mood trend
 */
function getMoodTrendCopy(trend: TrendDirection, isPostpartum: boolean): TrendCopy {
  if (isPostpartum) {
    switch (trend) {
      case "up":
        return {
          label: "Improving",
          supportiveMessage: "Her mood seems lighter this week — your support is making a difference.",
        };
      case "down":
        return {
          label: "Harder week",
          supportiveMessage: "This week has been emotionally heavier. Extra patience and presence help.",
        };
      default:
        return {
          label: "Steady",
          supportiveMessage: "Mood has been consistent. Staying attentive keeps things stable.",
        };
    }
  }
  
  // Pregnancy mode
  switch (trend) {
    case "up":
      return {
        label: "Improving",
        supportiveMessage: "Her mood is trending better this week — keep up the great support.",
      };
    case "down":
      return {
        label: "Harder week",
        supportiveMessage: "This week has been emotionally heavier. A little extra patience helps.",
      };
    default:
      return {
        label: "Steady",
        supportiveMessage: "Mood has held steady — consistency in your support matters.",
      };
  }
}

/**
 * Get supportive copy for energy trend
 */
function getEnergyTrendCopy(trend: TrendDirection, isPostpartum: boolean): TrendCopy {
  if (isPostpartum) {
    switch (trend) {
      case "up":
        return {
          label: "More energy",
          supportiveMessage: "She's had more energy this week — a good sign of recovery.",
        };
      case "down":
        return {
          label: "Running low",
          supportiveMessage: "Energy has been harder to come by. Rest is essential right now.",
        };
      default:
        return {
          label: "Stable",
          supportiveMessage: "Energy levels have held steady — that's a good sign.",
        };
    }
  }
  
  switch (trend) {
    case "up":
      return {
        label: "More energy",
        supportiveMessage: "She's feeling more energized this week — that's encouraging.",
      };
    case "down":
      return {
        label: "Running low",
        supportiveMessage: "Energy has dipped. Helping her rest makes a real difference.",
      };
    default:
      return {
        label: "Stable",
        supportiveMessage: "Energy has been consistent — keep supporting her pace.",
      };
  }
}

/**
 * Get supportive copy for symptoms trend
 */
function getSymptomsTrendCopy(trend: TrendDirection, isPostpartum: boolean): TrendCopy {
  if (isPostpartum) {
    switch (trend) {
      case "up":
        return {
          label: "Easing",
          supportiveMessage: "Symptoms seem to be easing — recovery is progressing.",
        };
      case "down":
        return {
          label: "More present",
          supportiveMessage: "Symptoms have been more present this week. Extra care helps.",
        };
      default:
        return {
          label: "Unchanged",
          supportiveMessage: "Symptoms have held steady. Consistent support matters.",
        };
    }
  }
  
  switch (trend) {
    case "up":
      return {
        label: "Easing",
        supportiveMessage: "Symptoms seem to be easing up this week — that's a relief.",
      };
    case "down":
      return {
        label: "More present",
        supportiveMessage: "Symptoms have been tougher. Small comforts go a long way.",
      };
    default:
      return {
        label: "Unchanged",
        supportiveMessage: "Symptoms have been about the same. Stay attentive to her needs.",
      };
  }
}

/**
 * Get overall wellbeing summary copy
 */
function getOverallTrendCopy(trend: TrendDirection, isPostpartum: boolean): TrendCopy {
  if (isPostpartum) {
    switch (trend) {
      case "up":
        return {
          label: "Better week",
          supportiveMessage: "Overall, this week has been a bit easier. Your support is helping.",
        };
      case "down":
        return {
          label: "Tougher week",
          supportiveMessage: "This week has been harder overall. Being there matters more than ever.",
        };
      default:
        return {
          label: "Holding steady",
          supportiveMessage: "Things have been consistent. Steady presence is what she needs.",
        };
    }
  }
  
  switch (trend) {
    case "up":
      return {
        label: "Better week",
        supportiveMessage: "Overall, things seem a bit brighter this week.",
      };
    case "down":
      return {
        label: "Tougher week",
        supportiveMessage: "This week has been more challenging. Extra care and patience help.",
      };
    default:
      return {
        label: "Holding steady",
        supportiveMessage: "Things have been steady. Your consistent support matters.",
      };
  }
}

/**
 * Directional trend badge component (no raw values)
 */
function TrendBadge({ 
  trend, 
  size = "sm" 
}: { 
  trend: TrendDirection; 
  size?: "sm" | "md";
}) {
  const sizeClasses = size === "md" ? "px-2 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]";
  
  switch (trend) {
    case "up":
      return (
        <span className={cn(
          "inline-flex items-center gap-0.5 rounded-full font-medium",
          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          sizeClasses
        )}>
          <TrendingUp className="w-3 h-3" />
          <span>Improving</span>
        </span>
      );
    case "down":
      return (
        <span className={cn(
          "inline-flex items-center gap-0.5 rounded-full font-medium",
          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
          sizeClasses
        )}>
          <TrendingDown className="w-3 h-3" />
          <span>Harder</span>
        </span>
      );
    default:
      return (
        <span className={cn(
          "inline-flex items-center gap-0.5 rounded-full font-medium",
          "bg-muted text-muted-foreground",
          sizeClasses
        )}>
          <Minus className="w-3 h-3" />
          <span>Steady</span>
        </span>
      );
  }
}

const moodIcons: Record<Mood, React.ReactNode> = {
  happy: <Smile className="w-4 h-4 text-primary dark:text-primary" />,
  neutral: <Meh className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />,
  sad: <Frown className="w-4 h-4 text-red-600 dark:text-red-400" />,
};

// Generate support suggestions based on check-in data
interface SupportSuggestion {
  icon: React.ReactNode;
  text: string;
  priority: number; // Lower = higher priority
}

// ============================================
// SYMPTOM SEVERITY WEIGHTING
// ============================================
// Weights are for UX prioritization only — NOT medical guidance.
// Higher weight = more impact on partner suggestions ordering.

type SymptomSeverity = 1 | 2 | 3;

const SYMPTOM_WEIGHTS: Record<string, SymptomSeverity> = {
  // Mild (1) - Common discomforts
  "cravings": 1,
  "food cravings": 1,
  "bloating": 1,
  "gas": 1,
  "mild headache": 1,
  "mood swings": 1,
  "frequent urination": 1,
  "constipation": 1,
  "acne": 1,
  "dry skin": 1,
  "runny nose": 1,
  "congestion": 1,
  "low energy": 1,
  
  // Moderate (2) - Notable symptoms requiring attention
  "nausea": 2,
  "morning sickness": 2,
  "heartburn": 2,
  "acid reflux": 2,
  "insomnia": 2,
  "sleep issues": 2,
  "sleep deprivation": 2,
  "back pain": 2,
  "backache": 2,
  "headache": 2,
  "headaches": 2,
  "fatigue": 2,
  "tired": 2,
  "exhaustion": 2,
  "anxiety": 2,
  "hip pain": 2,
  "leg cramps": 2,
  "round ligament pain": 2,
  "breast tenderness": 2,
  "breast pain": 2,
  "shortness of breath": 2,
  "cramping": 2, // Postpartum cramping is normal
  
  // Higher-impact (3) - Symptoms needing extra partner support
  "cramps": 3,
  "severe fatigue": 3,
  "swelling": 3,
  "edema": 3,
  "severe nausea": 3,
  "vomiting": 3,
  "dizziness": 3,
  "fainting": 3,
  "pelvic pressure": 3,
  "contractions": 3,
  "braxton hicks": 3,
  "sciatica": 3,
  "migraines": 3,
};

// Red-flag symptoms - special handling, always suggest contacting provider
const RED_FLAG_SYMPTOMS = [
  "bleeding",
  "spotting",
  "vaginal bleeding",
  "vision changes",
  "blurred vision",
  "severe headache",
  "severe abdominal pain",
  "chest pain",
  "difficulty breathing",
  "decreased fetal movement",
  "no fetal movement",
  "fluid leaking",
  "water breaking",
  "high fever",
  "severe swelling",
];

interface WeightedSymptom {
  symptom: string;
  count: number;
  weight: SymptomSeverity;
  score: number; // weight * count
}

interface SymptomAnalysis {
  weightedSymptoms: WeightedSymptom[];
  totalScore: number;
  averageWeight: number;
  hasRedFlags: boolean;
  redFlagSymptoms: string[];
  severityLevel: "light" | "moderate" | "heavy";
}

/**
 * Get weight for a symptom (fuzzy matching)
 */
function getSymptomWeight(symptom: string): SymptomSeverity {
  const lower = symptom.toLowerCase().trim();
  
  // Direct match first
  if (SYMPTOM_WEIGHTS[lower]) {
    return SYMPTOM_WEIGHTS[lower];
  }
  
  // Only check if symptom CONTAINS a known key (not reverse)
  // Require minimum key length to avoid false positives (e.g., "gas" matching "massage")
  for (const [key, weight] of Object.entries(SYMPTOM_WEIGHTS)) {
    if (key.length >= 4 && lower.includes(key)) {
      return weight as SymptomSeverity;
    }
  }
  
  // Default to mild if unknown
  return 1;
}

/**
 * Check if symptom is a red flag
 */
function isRedFlagSymptom(symptom: string): boolean {
  const lower = symptom.toLowerCase().trim();
  // Only check if symptom contains red flag term (not reverse)
  // Require minimum length to avoid false positives
  return RED_FLAG_SYMPTOMS.some(rf => rf.length >= 5 && lower.includes(rf));
}

/**
 * Analyze symptoms with weighting
 */
function analyzeSymptomSeverity(
  topSymptoms: Array<{ symptom: string; count: number }>
): SymptomAnalysis {
  const weightedSymptoms: WeightedSymptom[] = [];
  const redFlagSymptoms: string[] = [];
  
  for (const { symptom, count } of topSymptoms) {
    // Check for red flags first
    if (isRedFlagSymptom(symptom)) {
      redFlagSymptoms.push(symptom);
    }
    
    const weight = getSymptomWeight(symptom);
    weightedSymptoms.push({
      symptom,
      count,
      weight,
      score: weight * count,
    });
  }
  
  // Sort by weighted score (highest first)
  weightedSymptoms.sort((a, b) => b.score - a.score);
  
  const totalScore = weightedSymptoms.reduce((sum, s) => sum + s.score, 0);
  const totalCount = weightedSymptoms.reduce((sum, s) => sum + s.count, 0);
  const averageWeight = totalCount > 0 
    ? weightedSymptoms.reduce((sum, s) => sum + (s.weight * s.count), 0) / totalCount
    : 0;
  
  // Determine severity level based on total weighted score
  let severityLevel: "light" | "moderate" | "heavy";
  if (totalScore <= 5) {
    severityLevel = "light";
  } else if (totalScore <= 12) {
    severityLevel = "moderate";
  } else {
    severityLevel = "heavy";
  }
  
  return {
    weightedSymptoms,
    totalScore,
    averageWeight,
    hasRedFlags: redFlagSymptoms.length > 0,
    redFlagSymptoms,
    severityLevel,
  };
}

// Suggestion pools for variety
const SUGGESTION_POOLS = {
  lowEnergy: [
    "Energy has been running low this week. Taking something off her plate — even a small errand — can make a real difference.",
    "She's been feeling drained lately. Offering to handle dinner or an evening task lets her recharge.",
    "Low energy days are hard. A quiet evening with less on the schedule might be exactly what she needs.",
  ],
  sadMood: [
    "This week has been emotionally heavy. Sometimes the best support is simply being present — no fixing needed.",
    "She may be carrying more than usual right now. A gentle check-in, without pressure, can mean everything.",
    "Tough emotional days are part of the journey. Letting her know you see her effort matters more than solutions.",
  ],
  nausea: [
    "Nausea has been persistent. Keeping simple snacks nearby — crackers, ginger, plain foods — can help her get through.",
    "Morning sickness is no joke. Preparing bland, easy-to-grab foods takes one thing off her mind.",
    "Nausea makes everything harder. Small gestures like bringing her water or a light snack go a long way.",
  ],
  fatigue: [
    "Fatigue has been showing up a lot. Protecting her sleep and keeping evenings low-key helps more than you'd think.",
    "Rest has been tough to come by. Encouraging an early night or handling bedtime duties gives her space to recover.",
    "Sleep deprivation compounds everything. A calm, quiet home in the evenings is a gift right now.",
  ],
  headache: [
    "Headaches have been frequent. Dimming lights, staying hydrated, and keeping noise low can bring some relief.",
    "She's been dealing with headaches. A cool room, plenty of water, and minimal screen time may help.",
  ],
  backPain: [
    "Back pain has been tough this week. A gentle massage or warm compress could offer some comfort.",
    "Aches and tension have been showing up. Running a warm bath or offering to rub her shoulders says a lot.",
  ],
  insomnia: [
    "Sleep has been elusive. Keeping evenings calm — maybe a warm drink, soft lighting — sets the stage for better rest.",
    "Insomnia makes everything harder. A relaxing bedtime routine together might help her unwind.",
  ],
  lowConsistency: [
    "Check-ins have been light this week. A gentle reminder that you're here and curious about how she's feeling can encourage her to share.",
    "She hasn't logged as much lately. Asking how she's doing — without pressure — shows you care about her experience.",
  ],
  trendWorsening: [
    "This week looks a bit tougher than last. Extra patience and presence right now can help her through.",
    "Things seem harder this week compared to last. Being attentive to her needs matters even more right now.",
  ],
  heavySymptomWeek: [
    "This has been a tougher symptom week. Your patience and willingness to step up mean more than you know.",
    "She's dealing with a lot physically right now. Being extra attentive to her comfort can make a real difference.",
    "Multiple symptoms are showing up this week. Small acts of care — without being asked — go a long way.",
  ],
  redFlag: [
    "Some symptoms she's logged may warrant a call to her healthcare provider. Offering to help make that call or go with her shows you're in this together.",
    "There are symptoms that are worth discussing with her provider. Being supportive if she needs to reach out to her care team matters right now.",
  ],
  trimester1: [
    "The first trimester is often the hardest to navigate. Your patience with the exhaustion and mood shifts means everything.",
    "Early pregnancy can be overwhelming. Simply being understanding about the fatigue goes a long way.",
  ],
  trimester2: [
    "Her body is changing in visible ways now. Genuine compliments and reassurance help her feel seen.",
    "The second trimester brings new adjustments. Noticing her strength through all this change matters.",
  ],
  trimester3: [
    "The final stretch can feel endless. Small comforts — a pillow adjustment, a foot rub — make a real difference.",
    "She's in the home stretch now. Anticipating her needs before she asks shows you're paying attention.",
  ],
  // Postpartum-specific pools
  postpartumEarly: [
    "The first weeks postpartum are an adjustment for everyone. Taking night shifts or early mornings lets her recover.",
    "Recovery takes time. Handling household tasks without being asked shows you understand what she's going through.",
    "These early days are intense. Your patience with the sleep deprivation and emotional shifts means everything.",
  ],
  postpartumMid: [
    "As routines settle, she may still need more support than usual. Checking in regularly shows you're still paying attention.",
    "The adjustment continues. Offering to take baby so she can rest or have time alone is a meaningful gift.",
  ],
  postpartumGeneral: [
    "Postpartum recovery is more than physical. Being emotionally present and patient helps her feel supported.",
    "New parenthood is a team effort. Sharing the load equally — or more than equally right now — matters.",
    "Her body and mind are still adjusting. Small gestures of care go further than you might think.",
  ],
  postpartumLowMood: [
    "If she's been feeling down, gently encourage her to talk to her provider. You can offer to go with her or help make the call.",
    "Postpartum mood changes are common but shouldn't be ignored. Suggesting she speak with someone isn't overstepping — it's caring.",
  ],
  appointment: [
    "An appointment is coming up. Planning to be there, or asking how it went, shows you're invested in this together.",
    "There's a check-up soon. Offering to come along or clearing your schedule to hear about it means a lot.",
  ],
  general: [
    "Being present and attentive is the foundation. Small, consistent gestures build trust and comfort.",
    "Your support shapes her experience. Staying curious about how she's feeling keeps you connected.",
  ],
};

// Pick a random item from a pool (deterministic based on day of week for consistency)
function pickFromPool(pool: string[]): string {
  const dayOfWeek = new Date().getDay();
  return pool[dayOfWeek % pool.length];
}

interface SuggestionContext {
  stats: WeekStats;
  trimester: 1 | 2 | 3;
  hasUpcomingAppointment: boolean;
  deltas?: PartnerInsightsDeltas | null;
  daysLogged?: number;
  rawSymptoms?: Array<{ symptom: string; count: number }>; // For weighted analysis
  appMode?: "pregnancy" | "infancy"; // "infancy" = postpartum
  postpartumWeek?: number; // Weeks since birth
}

function getSupportSuggestions(ctx: SuggestionContext): SupportSuggestion[] {
  const { stats, trimester, hasUpcomingAppointment, deltas, daysLogged, rawSymptoms, appMode, postpartumWeek } = ctx;
  const suggestions: SupportSuggestion[] = [];
  const isPostpartum = appMode === "infancy";
  
  // Analyze symptoms with weighting
  const symptomAnalysis = rawSymptoms 
    ? analyzeSymptomSeverity(rawSymptoms)
    : analyzeSymptomSeverity(stats.topSymptoms.map(s => ({ symptom: s, count: 1 })));
  
  // Get top weighted symptom for prioritized suggestions
  const topWeightedSymptom = symptomAnalysis.weightedSymptoms[0];

  // Priority 0: Red flag symptoms (always first if present)
  if (symptomAnalysis.hasRedFlags) {
    suggestions.push({
      icon: <Heart className="w-4 h-4" />,
      text: pickFromPool(SUGGESTION_POOLS.redFlag),
      priority: 0,
    });
  }

  // Priority 0.5: Postpartum mood concerns (special handling)
  if (isPostpartum && stats.dominantMood === "sad" && stats.moodCounts.sad >= 3) {
    suggestions.push({
      icon: <Heart className="w-4 h-4" />,
      text: pickFromPool(SUGGESTION_POOLS.postpartumLowMood),
      priority: 0.5,
    });
  }

  // Priority 1: Trend worsening (if deltas show decline)
  if (deltas) {
    const moodWorsening = (deltas.mood.sad > 0 && deltas.mood.happy < 0);
    const energyWorsening = (deltas.energy.low > 0 && deltas.energy.high < 0);
    if (moodWorsening || energyWorsening) {
      suggestions.push({
        icon: <Heart className="w-4 h-4" />,
        text: pickFromPool(SUGGESTION_POOLS.trendWorsening),
        priority: 1,
      });
    }
  }

  // Priority 1.5: Heavy symptom week (high weighted score)
  if (symptomAnalysis.severityLevel === "heavy") {
    suggestions.push({
      icon: <Heart className="w-4 h-4" />,
      text: pickFromPool(SUGGESTION_POOLS.heavySymptomWeek),
      priority: 1.5,
    });
  }

  // Priority 2: Emotional support (sad mood dominant)
  if (stats.dominantMood === "sad") {
    suggestions.push({
      icon: <MessageCircle className="w-4 h-4" />,
      text: pickFromPool(SUGGESTION_POOLS.sadMood),
      priority: 2,
    });
  }

  // Priority 3: Low energy support
  if (stats.dominantEnergy === "low") {
    suggestions.push({
      icon: <Coffee className="w-4 h-4" />,
      text: pickFromPool(SUGGESTION_POOLS.lowEnergy),
      priority: 3,
    });
  }

  // Priority 4-5: Symptom-specific suggestions (ordered by weight)
  // Process symptoms by their weighted score (highest first)
  const processedCategories = new Set<string>();
  
  for (const ws of symptomAnalysis.weightedSymptoms) {
    const symptomLower = ws.symptom.toLowerCase();
    // Calculate dynamic priority: higher weight = lower priority number = shown first
    const dynamicPriority = 4 + (3 - ws.weight) * 0.5; // weight 3 → 4, weight 2 → 4.5, weight 1 → 5
    
    if (!processedCategories.has("nausea") && 
        (symptomLower.includes("nausea") || symptomLower.includes("morning sickness") || symptomLower.includes("vomiting"))) {
      suggestions.push({
        icon: <Utensils className="w-4 h-4" />,
        text: pickFromPool(SUGGESTION_POOLS.nausea),
        priority: dynamicPriority,
      });
      processedCategories.add("nausea");
    }

    if (!processedCategories.has("fatigue") && 
        (symptomLower.includes("fatigue") || symptomLower.includes("tired") || symptomLower.includes("exhaustion"))) {
      suggestions.push({
        icon: <Moon className="w-4 h-4" />,
        text: pickFromPool(SUGGESTION_POOLS.fatigue),
        priority: dynamicPriority,
      });
      processedCategories.add("fatigue");
    }

    if (!processedCategories.has("headache") && symptomLower.includes("headache")) {
      suggestions.push({
        icon: <Moon className="w-4 h-4" />,
        text: pickFromPool(SUGGESTION_POOLS.headache),
        priority: dynamicPriority,
      });
      processedCategories.add("headache");
    }

    if (!processedCategories.has("backPain") && 
        (symptomLower.includes("back pain") || symptomLower.includes("backache") || 
         symptomLower.includes("cramps") || symptomLower.includes("aches") || symptomLower.includes("sciatica"))) {
      suggestions.push({
        icon: <Bath className="w-4 h-4" />,
        text: pickFromPool(SUGGESTION_POOLS.backPain),
        priority: dynamicPriority,
      });
      processedCategories.add("backPain");
    }

    if (!processedCategories.has("insomnia") && 
        (symptomLower.includes("insomnia") || symptomLower.includes("sleep") || symptomLower.includes("restless"))) {
      suggestions.push({
        icon: <Moon className="w-4 h-4" />,
        text: pickFromPool(SUGGESTION_POOLS.insomnia),
        priority: dynamicPriority,
      });
      processedCategories.add("insomnia");
    }
  }

  // Priority 6: Low consistency (gentle encouragement)
  if (daysLogged !== undefined && daysLogged <= 2 && stats.totalCheckins > 0) {
    suggestions.push({
      icon: <Heart className="w-4 h-4" />,
      text: pickFromPool(SUGGESTION_POOLS.lowConsistency),
      priority: 6,
    });
  }

  // Priority 7: Upcoming appointment
  if (hasUpcomingAppointment) {
    suggestions.push({
      icon: <Calendar className="w-4 h-4" />,
      text: pickFromPool(SUGGESTION_POOLS.appointment),
      priority: 7,
    });
  }

  // Priority 8: Trimester/Postpartum-based general guidance (fill if needed)
  if (suggestions.length < 2) {
    if (isPostpartum) {
      // Postpartum-specific suggestions based on weeks since birth
      const pool = postpartumWeek && postpartumWeek <= 6
        ? SUGGESTION_POOLS.postpartumEarly
        : postpartumWeek && postpartumWeek <= 12
          ? SUGGESTION_POOLS.postpartumMid
          : SUGGESTION_POOLS.postpartumGeneral;
      suggestions.push({
        icon: <Heart className="w-4 h-4" />,
        text: pickFromPool(pool),
        priority: 8,
      });
    } else {
      // Pregnancy trimester-based suggestions
      const trimesterPools = {
        1: SUGGESTION_POOLS.trimester1,
        2: SUGGESTION_POOLS.trimester2,
        3: SUGGESTION_POOLS.trimester3,
      };
      suggestions.push({
        icon: <Heart className="w-4 h-4" />,
        text: pickFromPool(trimesterPools[trimester]),
        priority: 8,
      });
    }
  }

  // Priority 9: General fallback
  if (suggestions.length < 2) {
    suggestions.push({
      icon: <Sparkles className="w-4 h-4" />,
      text: pickFromPool(SUGGESTION_POOLS.general),
      priority: 9,
    });
  }

  // Sort by priority and return top 3
  return suggestions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
}

export function WeeklySummary({ 
  isPaid = false, 
  checkinContext = null,
  isPartnerView = false,
  currentWeek = 0,
  trimester = 2,
  momName = null,
  hasUpcomingAppointment = false,
  appMode = "pregnancy",
}: WeeklySummaryProps) {
  // Mom view: direct query
  const { data: weekLogs = [], isLoading: momLoading } = useWeekLogs();
  
  // Partner view: RPC-based aggregated data
  const { data: partnerInsights, isLoading: partnerLoading } = usePartnerWeeklyInsights();
  
  // Use appropriate data source based on view
  const isLoading = isPartnerView ? partnerLoading : momLoading;
  const stats = useMemo(() => {
    if (isPartnerView) {
      return partnerInsightsToStats(partnerInsights);
    }
    return analyzeWeekLogs(weekLogs);
  }, [isPartnerView, weekLogs, partnerInsights]);

  // Extract deltas for partner trend display
  const deltas = useMemo(() => {
    if (isPartnerView && partnerInsights?.deltas) {
      return partnerInsights.deltas;
    }
    return null;
  }, [isPartnerView, partnerInsights]);

  const [nudgeCompleted, setNudgeCompleted] = useState(false);
  const nudge = getNudgeForCheckin(checkinContext);
  
  // Get "For You" tip for infancy mode
  const forYouTip = appMode === "infancy" ? getInfancyMomTip(currentWeek) : null;

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

  // Compute symptom analysis for partner insights display
  const symptomAnalysis = useMemo(() => {
    if (isPartnerView && partnerInsights?.current?.top_symptoms) {
      return analyzeSymptomSeverity(partnerInsights.current.top_symptoms);
    }
    return null;
  }, [isPartnerView, partnerInsights]);

  // Compute directional weekly trends (no raw values)
  const isPostpartum = appMode === "infancy";
  const weeklyTrends = useMemo(() => {
    if (!isPartnerView || !deltas) return null;
    return computeWeeklyTrends(deltas);
  }, [isPartnerView, deltas]);

  // Get supportive copy for trends
  const trendCopy = useMemo(() => {
    if (!weeklyTrends) return null;
    return {
      mood: getMoodTrendCopy(weeklyTrends.mood, isPostpartum),
      energy: getEnergyTrendCopy(weeklyTrends.energy, isPostpartum),
      symptoms: getSymptomsTrendCopy(weeklyTrends.symptoms, isPostpartum),
      overall: getOverallTrendCopy(weeklyTrends.overallWellbeing, isPostpartum),
    };
  }, [weeklyTrends, isPostpartum]);

  const supportSuggestions = useMemo(() => 
    getSupportSuggestions({
      stats,
      trimester,
      hasUpcomingAppointment,
      deltas,
      daysLogged: partnerInsights?.current?.days_logged,
      rawSymptoms: partnerInsights?.current?.top_symptoms,
      appMode,
      // In infancy mode, currentWeek = babyAgeWeeks + 1 (baby's week of life, always ≥ 1)
      postpartumWeek: appMode === "infancy" ? currentWeek : undefined,
    }),
    [stats, trimester, hasUpcomingAppointment, deltas, partnerInsights, appMode, currentWeek]
  );

  // PARTNER VIEW - Fills height, larger brief, better spacing
  if (isPartnerView) {
    return (
      <section className="bg-card rounded-xl border border-border/60 overflow-hidden h-full flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center">
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

        {/* Stats Section - grows to fill space */}
        <div className="p-6 flex-1 flex flex-col">
          {hasWeekData ? (
            <div className="flex-1 flex flex-col">
              {/* Summary brief - CENTERED, LARGER FONT */}
              <div className="py-8 px-6 flex items-center justify-center">
                <p className="text-xl text-foreground leading-relaxed font-medium text-center">
                  {partnerSummary}
                </p>
              </div>

              {/* Focus areas label (when symptom severity is moderate or heavy) */}
              {symptomAnalysis && symptomAnalysis.severityLevel !== "light" && (
                <div className="mb-4 px-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full font-medium",
                      symptomAnalysis.severityLevel === "heavy" 
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {symptomAnalysis.severityLevel === "heavy" ? "Tougher week" : "Focus areas"}
                    </span>
                    {symptomAnalysis.weightedSymptoms.slice(0, 2).map((ws, i) => (
                      <span key={ws.symptom} className="text-muted-foreground">
                        {i > 0 && "·"} {ws.symptom}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Red flag notice */}
              {symptomAnalysis?.hasRedFlags && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Some logged symptoms may be worth discussing with her healthcare provider.
                  </p>
                </div>
              )}

              {/* Week-Over-Week Trends Summary (privacy-safe: direction only) */}
              {weeklyTrends && trendCopy && (
                <div className="mb-4 p-4 rounded-lg bg-muted/30 border border-border/40">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      This Week vs Last
                    </span>
                    <TrendBadge trend={weeklyTrends.overallWellbeing} size="sm" />
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {trendCopy.overall.supportiveMessage}
                  </p>
                </div>
              )}

              {/* Vertical stacked indicators */}
              <div className="space-y-3">
                {/* Mood Row with Trend Badge */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Mood</span>
                    {weeklyTrends && <TrendBadge trend={weeklyTrends.mood} />}
                  </div>
                  <div className="flex items-center gap-3">
                    {(["happy", "neutral", "sad"] as Mood[]).map((mood) => (
                      <div key={mood} className="flex items-center gap-1">
                        {moodIcons[mood]}
                        <span className="text-sm font-medium">{stats.moodCounts[mood]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Symptom Row with Trend Badge */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Symptoms</span>
                    {weeklyTrends && <TrendBadge trend={weeklyTrends.symptoms} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {stats.topSymptoms[0] || "None"}
                    </span>
                    {deltas?.symptoms?.new && deltas.symptoms.new.length > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        (new)
                      </span>
                    )}
                  </div>
                </div>

                {/* Energy Row with Trend Badge */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Energy</span>
                    {weeklyTrends && <TrendBadge trend={weeklyTrends.energy} />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className={cn(
                      "w-4 h-4",
                      stats.dominantEnergy === "high" ? "text-primary" :
                      stats.dominantEnergy === "medium" ? "text-yellow-500" : "text-red-500"
                    )} />
                    <span className="text-sm font-semibold capitalize">
                      {stats.dominantEnergy || "—"}
                    </span>
                  </div>
                </div>

                {/* Consistency Row */}
                {partnerInsights?.current && (
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border/50">
                    <span className="text-sm text-muted-foreground">Check-ins</span>
                    <span className="text-sm font-semibold">
                      {partnerInsights.current.days_logged || 0} days this week
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 flex-1 flex items-center justify-center">
              <p className="text-base text-muted-foreground">
                {momName 
                  ? `Once ${momName} logs how she's feeling, you'll see a summary here.`
                  : "Once she logs how she's feeling, you'll see a summary here."
                }
              </p>
            </div>
          )}
          
          {/* Spacer to push support section to bottom */}
          <div className="flex-1" />
        </div>

        {/* Support Section - at bottom */}
        <div className="px-6 pb-6">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              How You Can Help
            </span>
          </div>

          {hasWeekData && supportSuggestions.length > 0 ? (
            <div className="space-y-3">
              {supportSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border/50"
                >
                  <div className="w-8 h-8 rounded-full bg-muted/50 border border-border/60 flex items-center justify-center shrink-0 text-muted-foreground">
                    {suggestion.icon}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed pt-1">
                    {suggestion.text}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-3 px-4 rounded-lg bg-muted/50">
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
    <section className="bg-card rounded-xl border border-border/60 overflow-hidden">
      {/* For You tip (infancy) or Gentle Nudge (pregnancy) */}
      {appMode === "infancy" && forYouTip ? (
        /* INFANCY: Show "For You" tip - regular styling */
        <div className="px-6 py-5 border-b border-border/60">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground mb-1">For You</p>
              <p className="text-sm text-foreground leading-relaxed">{forYouTip}</p>
            </div>
          </div>
        </div>
      ) : (
        /* PREGNANCY: Show gentle nudge */
        !nudgeCompleted && nudge && (
          <div className="px-6 py-5 border-b border-border/60">
            <div className="flex items-start gap-3">
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
          </div>
        )
      )}

      {/* BOTTOM HALF - Your Week at a Glance */}
      <div className="p-6">
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

            {/* Detailed stats - Premium feature */}
            <PremiumLock isPaid={isPaid} showBadge={true}>
              <div className="grid grid-cols-3 gap-3">
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
                      stats.dominantEnergy === "high" ? "text-primary" :
                      stats.dominantEnergy === "medium" ? "text-yellow-500" : "text-red-500"
                    )} />
                    <span className="text-sm font-medium capitalize">
                      {stats.dominantEnergy || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </PremiumLock>
          </>
        )}

        {!hasWeekData && !isLoading && (
          <p className="text-sm text-muted-foreground">
            Check in daily to see patterns in your mood, energy, and symptoms.
          </p>
        )}
      </div>
    </section>
  );
}