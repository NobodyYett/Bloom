// client/src/components/weekly-summary.tsx

import { useMemo, useState, useEffect } from "react";
import { useWeekLogs } from "@/hooks/usePregnancyLogs";
import { 
  BarChart3, Smile, Meh, Frown, Zap, Sparkles, Check, Heart,
  Coffee, Moon, Bath, MessageCircle, Utensils, Calendar,
  Plus, Trash2, CheckCircle2, Circle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNudgeForCheckin, isNudgeCompleted, markNudgeCompleted, type CheckinContext } from "@/lib/nudges";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface WeeklySummaryProps {
  isPaid?: boolean;
  checkinContext?: CheckinContext | null;
  isPartnerView?: boolean;
  currentWeek?: number;
  trimester?: 1 | 2 | 3;
  momName?: string | null;
  momUserId?: string | null;
  hasUpcomingAppointment?: boolean;
}

type Mood = "happy" | "neutral" | "sad";
type Energy = "high" | "medium" | "low";
type Slot = "morning" | "evening" | "night";

interface SharedTask {
  id: string;
  title: string;
  completed: boolean;
  completed_by: string | null;
  created_by: string;
}

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

  // Energy-based
  if (stats.dominantEnergy === "low") {
    suggestions.push({
      icon: <Coffee className="w-4 h-4 text-muted-foreground" />,
      text: "Energy has been low — consider taking on an extra task so she can rest.",
    });
  }

  // Symptom-based
  const symptomsLower = stats.topSymptoms.map(s => s.toLowerCase());
  
  if (symptomsLower.includes("headache") || symptomsLower.includes("headaches")) {
    suggestions.push({
      icon: <Moon className="w-4 h-4 text-muted-foreground" />,
      text: "Headaches have been showing up — helping keep lights dim and water nearby may help.",
    });
  }
  
  if (symptomsLower.includes("nausea")) {
    suggestions.push({
      icon: <Utensils className="w-4 h-4 text-muted-foreground" />,
      text: "Nausea has been tough — offering to prepare bland, easy foods could help.",
    });
  }
  
  if (symptomsLower.includes("back pain") || symptomsLower.includes("cramps")) {
    suggestions.push({
      icon: <Bath className="w-4 h-4 text-muted-foreground" />,
      text: "She's been dealing with aches — a gentle back rub or warm bath could help.",
    });
  }
  
  if (symptomsLower.includes("insomnia") || symptomsLower.includes("fatigue")) {
    suggestions.push({
      icon: <Moon className="w-4 h-4 text-muted-foreground" />,
      text: "Sleep has been difficult — helping keep evenings calm may help.",
    });
  }

  // Mood-based
  if (stats.dominantMood === "sad") {
    suggestions.push({
      icon: <MessageCircle className="w-4 h-4 text-muted-foreground" />,
      text: "She may need extra support — sometimes listening without trying to fix things helps most.",
    });
  }

  // Appointment
  if (hasUpcomingAppointment) {
    suggestions.push({
      icon: <Calendar className="w-4 h-4 text-muted-foreground" />,
      text: "An appointment is coming up — planning to attend can mean a lot.",
    });
  }

  // Trimester fallbacks
  if (suggestions.length < 2) {
    if (trimester === 1) {
      suggestions.push({
        icon: <Heart className="w-4 h-4 text-muted-foreground" />,
        text: "First trimester can be exhausting — being patient with fatigue goes a long way.",
      });
    } else if (trimester === 2) {
      suggestions.push({
        icon: <Heart className="w-4 h-4 text-muted-foreground" />,
        text: "Body changes can feel strange — reminding her how amazing she looks helps.",
      });
    } else {
      suggestions.push({
        icon: <Heart className="w-4 h-4 text-muted-foreground" />,
        text: "The final stretch can be uncomfortable — small comforts make a big difference.",
      });
    }
  }

  return suggestions.slice(0, 3);
}

// Default tasks by trimester
function getDefaultTasks(trimester: 1 | 2 | 3): string[] {
  if (trimester === 1) {
    return [
      "Schedule first prenatal appointment",
      "Start prenatal vitamins",
      "Research healthcare providers",
    ];
  } else if (trimester === 2) {
    return [
      "Create baby registry",
      "Start planning nursery",
      "Schedule anatomy scan",
      "Begin researching childcare options",
    ];
  } else {
    return [
      "Pack hospital bag",
      "Install car seat",
      "Finish nursery setup",
      "Pre-register at hospital",
      "Prepare freezer meals",
    ];
  }
}

// Shared Tasks Component
function SharedTasksList({ 
  momUserId, 
  trimester,
  isPartnerView 
}: { 
  momUserId: string; 
  trimester: 1 | 2 | 3;
  isPartnerView: boolean;
}) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<SharedTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Fetch tasks
  useEffect(() => {
    async function loadTasks() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("shared_tasks")
        .select("id, title, completed, completed_by, created_by")
        .eq("mom_user_id", momUserId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to load tasks:", error);
      } else {
        setTasks(data || []);
      }
      setIsLoading(false);
    }

    if (momUserId) {
      loadTasks();
    }
  }, [momUserId]);

  // Add task
  async function handleAddTask() {
    if (!newTaskTitle.trim() || !user) return;

    setIsAdding(true);
    const { data, error } = await supabase
      .from("shared_tasks")
      .insert({
        mom_user_id: momUserId,
        title: newTaskTitle.trim(),
        created_by: user.id,
      })
      .select("id, title, completed, completed_by, created_by")
      .single();

    if (error) {
      console.error("Failed to add task:", error);
    } else if (data) {
      setTasks((prev) => [...prev, data]);
      setNewTaskTitle("");
    }
    setIsAdding(false);
  }

  // Toggle task completion
  async function handleToggleTask(taskId: string, completed: boolean) {
    if (!user) return;

    const { error } = await supabase
      .from("shared_tasks")
      .update({
        completed,
        completed_by: completed ? user.id : null,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", taskId);

    if (error) {
      console.error("Failed to update task:", error);
    } else {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, completed, completed_by: completed ? user.id : null }
            : t
        )
      );
    }
  }

  // Delete task
  async function handleDeleteTask(taskId: string) {
    const { error } = await supabase
      .from("shared_tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      console.error("Failed to delete task:", error);
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  }

  const incompleteTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        Loading tasks...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Add task input */}
      <div className="flex gap-2">
        <Input
          placeholder="Add a task..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
          className="h-9 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddTask}
          disabled={!newTaskTitle.trim() || isAdding}
          className="shrink-0"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">
          <p>No tasks yet. Add your first shared task above.</p>
          <p className="text-xs mt-1">
            Suggestions for Trimester {trimester}: {getDefaultTasks(trimester).slice(0, 2).join(", ")}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Incomplete tasks */}
          {incompleteTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 group"
            >
              <button
                onClick={() => handleToggleTask(task.id, true)}
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
              >
                <Circle className="w-5 h-5" />
              </button>
              <span className="flex-1 text-sm">{task.title}</span>
              <button
                onClick={() => handleDeleteTask(task.id)}
                className="shrink-0 p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Completed tasks */}
          {completedTasks.length > 0 && (
            <div className="pt-2 mt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-1.5">Completed</p>
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 group"
                >
                  <button
                    onClick={() => handleToggleTask(task.id, false)}
                    className="shrink-0 text-primary"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </button>
                  <span className="flex-1 text-sm text-muted-foreground line-through">
                    {task.title}
                  </span>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="shrink-0 p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WeeklySummary({ 
  isPaid = false, 
  checkinContext = null,
  isPartnerView = false,
  currentWeek = 0,
  trimester = 2,
  momName = null,
  momUserId = null,
  hasUpcomingAppointment = false,
}: WeeklySummaryProps) {
  const { user } = useAuth();
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

  const supportSuggestions = useMemo(() => 
    getSupportSuggestions(stats, trimester, hasUpcomingAppointment),
    [stats, trimester, hasUpcomingAppointment]
  );

  // Determine momUserId for tasks
  const tasksMomUserId = isPartnerView ? momUserId : user?.id;

  // ============================================
  // PARTNER VIEW: Split Layout Card
  // ============================================
  if (isPartnerView) {
    return (
      <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* ========== TOP HALF: How She's Feeling ========== */}
        <div className="p-6 border-b border-border">
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

          {hasWeekData ? (
            <>
              {/* Summary sentence */}
              <p className="text-sm text-foreground leading-relaxed mb-4">
                {freeRecap}
              </p>

              {/* Compact indicators */}
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
                      stats.dominantEnergy === "high" ? "text-green-500" :
                      stats.dominantEnergy === "medium" ? "text-yellow-500" : "text-red-500"
                    )} />
                    <span className="text-sm font-medium capitalize">
                      {stats.dominantEnergy || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Once she logs how she's feeling, you'll see a summary here.
            </p>
          )}
        </div>

        {/* ========== BOTTOM HALF: How You Can Help ========== */}
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="w-4 h-4 text-primary" />
            </div>
            <h2 className="font-medium text-sm">How You Can Help</h2>
          </div>

          {/* Section A: Support Based on Check-ins */}
          {hasWeekData && supportSuggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Based on her check-ins</p>
              <div className="space-y-2">
                {supportSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center shrink-0 mt-0.5">
                      {suggestion.icon}
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {suggestion.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section B: Shared To-Do List */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3">Shared pregnancy to-do list</p>
            {tasksMomUserId ? (
              <SharedTasksList 
                momUserId={tasksMomUserId} 
                trimester={trimester}
                isPartnerView={isPartnerView}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load shared tasks.</p>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ============================================
  // MOM VIEW: Original card with nudge + shared tasks
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

          {/* Premium upsell */}
          {!isPaid && (
            <p className="text-xs text-muted-foreground text-center mb-4">
              Upgrade to Premium for deeper insights and personalized suggestions.
            </p>
          )}
        </>
      )}

      {!hasWeekData && !isLoading && (
        <p className="text-sm text-muted-foreground mb-4">
          Check in daily to see patterns in your mood, energy, and symptoms.
        </p>
      )}

      {/* Shared To-Do List for Mom */}
      {tasksMomUserId && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <Check className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground">Shared pregnancy to-do list</p>
          </div>
          <SharedTasksList 
            momUserId={tasksMomUserId} 
            trimester={trimester}
            isPartnerView={false}
          />
        </div>
      )}
    </section>
  );
}