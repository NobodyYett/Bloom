// client/src/components/shared-tasks-card.tsx

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, CheckCircle2, Circle, ListTodo, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface SharedTask {
  id: string;
  title: string;
  completed: boolean;
  completed_by: string | null;
  created_by: string;
}

interface SharedTasksCardProps {
  momUserId: string;
  trimester: 1 | 2 | 3;
  currentWeek: number;
  isPartnerView?: boolean;
  showSuggestions?: boolean;  // Default: true
}

// Smart task suggestions based on current week
// These are practical, non-medical tasks for both parents
interface TaskSuggestion {
  title: string;
  priority: "high" | "medium" | "low";
  reason?: string;
}

function getSmartSuggestions(
  currentWeek: number,
  existingTasks: SharedTask[]
): TaskSuggestion[] {
  const existingTitles = existingTasks.map(t => t.title.toLowerCase());
  const suggestions: TaskSuggestion[] = [];

  // Helper to check if task already exists
  const hasTask = (keywords: string[]) => 
    existingTitles.some(title => 
      keywords.some(kw => title.includes(kw.toLowerCase()))
    );

  // ========== FIRST TRIMESTER (Weeks 1-13) ==========
  if (currentWeek <= 13) {
    if (currentWeek >= 6 && !hasTask(["registry", "browse", "research", "babylist", "amazon"])) {
      suggestions.push({
        title: "Start browsing registry ideas",
        priority: "medium",
        reason: "No pressure — just get inspired early",
      });
    }
    if (!hasTask(["insurance", "coverage", "maternity", "benefits"])) {
      suggestions.push({
        title: "Review insurance and maternity benefits",
        priority: "medium",
        reason: "Good to understand coverage early",
      });
    }
    if (!hasTask(["budget", "finances", "savings", "baby fund"])) {
      suggestions.push({
        title: "Start a baby savings fund",
        priority: "low",
        reason: "Even small amounts add up",
      });
    }
    if (!hasTask(["announce", "announcement", "tell", "share news"])) {
      suggestions.push({
        title: "Plan pregnancy announcement",
        priority: "low",
        reason: "When you're ready to share the news",
      });
    }
  }

  // ========== SECOND TRIMESTER (Weeks 14-27) ==========
  else if (currentWeek <= 27) {
    // Registry is key in second trimester!
    if (!hasTask(["registry", "create", "babylist", "amazon"])) {
      suggestions.push({
        title: "Create baby registry",
        priority: "high",
        reason: currentWeek < 20 
          ? "Perfect time to start — gives family time to shop"
          : "Baby showers often happen soon!",
      });
    }
    if (currentWeek >= 16 && !hasTask(["nursery", "theme", "room", "decor"])) {
      suggestions.push({
        title: "Start planning nursery",
        priority: "medium",
        reason: "Fun to do while energy is good!",
      });
    }
    if (currentWeek >= 20 && !hasTask(["childbirth", "class", "birthing", "lamaze", "parenting"])) {
      suggestions.push({
        title: "Research childbirth classes",
        priority: "medium",
        reason: "Classes fill up — good to look early",
      });
    }
    if (currentWeek >= 20 && !hasTask(["name", "baby name"])) {
      suggestions.push({
        title: "Discuss baby names",
        priority: "low",
        reason: "A fun one to work on together",
      });
    }
    if (currentWeek >= 24 && !hasTask(["tour", "hospital", "birth center"])) {
      suggestions.push({
        title: "Tour birthing facility",
        priority: "medium",
        reason: "Good to know the space beforehand",
      });
    }
    if (currentWeek >= 20 && !hasTask(["car seat", "carseat"])) {
      suggestions.push({
        title: "Research car seats",
        priority: "low",
        reason: "Many options — start comparing early",
      });
    }
    if (!hasTask(["photo", "maternity", "bump"])) {
      suggestions.push({
        title: "Schedule maternity photos",
        priority: "low",
        reason: "Best around weeks 28-34",
      });
    }
  }

  // ========== THIRD TRIMESTER (Weeks 28-40) ==========
  else {
    if (!hasTask(["hospital bag", "pack", "go bag"])) {
      suggestions.push({
        title: "Pack hospital bag",
        priority: currentWeek >= 36 ? "high" : "medium",
        reason: currentWeek >= 36 
          ? "Baby could come anytime now!"
          : "Good to have ready by week 36",
      });
    }
    if (!hasTask(["car seat", "install"])) {
      suggestions.push({
        title: "Install car seat",
        priority: currentWeek >= 36 ? "high" : "medium",
        reason: "Required to bring baby home",
      });
    }
    if (!hasTask(["pediatrician", "baby doctor", "find doctor"])) {
      suggestions.push({
        title: "Research pediatricians",
        priority: "high",
        reason: "Baby will need a checkup within days",
      });
    }
    if (currentWeek >= 32 && !hasTask(["nursery", "finish", "set up", "ready", "assemble"])) {
      suggestions.push({
        title: "Finish nursery setup",
        priority: "medium",
        reason: "Nice to have done before baby arrives",
      });
    }
    if (!hasTask(["pre-register", "hospital", "paperwork"])) {
      suggestions.push({
        title: "Pre-register at hospital",
        priority: "medium",
        reason: "Less paperwork during labor",
      });
    }
    if (currentWeek >= 34 && !hasTask(["wash", "baby clothes", "laundry"])) {
      suggestions.push({
        title: "Wash baby clothes",
        priority: "low",
        reason: "Use gentle, fragrance-free detergent",
      });
    }
    if (currentWeek >= 35 && !hasTask(["freezer", "meal", "prep", "food"])) {
      suggestions.push({
        title: "Prep freezer meals",
        priority: "low",
        reason: "You'll thank yourselves later!",
      });
    }
    if (!hasTask(["birth plan", "preferences"])) {
      suggestions.push({
        title: "Discuss birth preferences together",
        priority: "medium",
        reason: "Good to be on the same page",
      });
    }
    if (currentWeek >= 36 && !hasTask(["contact", "emergency", "phone", "numbers"])) {
      suggestions.push({
        title: "Gather emergency contacts",
        priority: "low",
        reason: "Have key numbers ready to go",
      });
    }
  }

  // Sort by priority and return top suggestions
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return suggestions
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 3);
}

export function SharedTasksCard({ momUserId, trimester, currentWeek, isPartnerView = false, showSuggestions = true }: SharedTasksCardProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<SharedTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [tableExists, setTableExists] = useState(true);

  // Get smart suggestions based on week and existing tasks (only if enabled)
  const smartSuggestions = useMemo(
    () => showSuggestions ? getSmartSuggestions(currentWeek, tasks) : [],
    [currentWeek, tasks, showSuggestions]
  );

  // Fetch tasks
  useEffect(() => {
    async function loadTasks() {
      if (!momUserId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("shared_tasks")
          .select("id, title, completed, completed_by, created_by")
          .eq("mom_user_id", momUserId)
          .order("created_at", { ascending: true });

        if (error) {
          // Table might not exist yet - hide component silently
          console.error("Failed to load tasks:", error);
          setTableExists(false);
          setTasks([]);
        } else {
          setTasks(data || []);
        }
      } catch (err) {
        console.error("Error loading tasks:", err);
        setTableExists(false);
        setTasks([]);
      }
      setIsLoading(false);
    }

    loadTasks();
  }, [momUserId]);

  // Add task
  async function handleAddTask() {
    if (!newTaskTitle.trim() || !user || !momUserId || !tableExists) return;

    setIsAdding(true);
    try {
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
    } catch (err) {
      console.error("Error adding task:", err);
    }
    setIsAdding(false);
  }

  // Toggle task completion
  async function handleToggleTask(taskId: string, completed: boolean) {
    if (!user) return;

    try {
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
    } catch (err) {
      console.error("Error updating task:", err);
    }
  }

  // Delete task
  async function handleDeleteTask(taskId: string) {
    try {
      const { error } = await supabase
        .from("shared_tasks")
        .delete()
        .eq("id", taskId);

      if (error) {
        console.error("Failed to delete task:", error);
      } else {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  }

  const incompleteTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  // Add a suggested task
  async function handleAddSuggestion(title: string) {
    if (!user || !momUserId || !tableExists) return;

    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from("shared_tasks")
        .insert({
          mom_user_id: momUserId,
          title: title,
          created_by: user.id,
        })
        .select("id, title, completed, completed_by, created_by")
        .single();

      if (error) {
        console.error("Failed to add task:", error);
      } else if (data) {
        setTasks((prev) => [...prev, data]);
      }
    } catch (err) {
      console.error("Error adding task:", err);
    }
    setIsAdding(false);
  }

  // Don't render if table doesn't exist - prevents crashes
  if (!tableExists || isLoading) {
    if (isLoading) {
      return (
        <section className="bg-card rounded-xl border border-border shadow-sm p-6">
          <div className="text-sm text-muted-foreground text-center">
            Loading tasks...
          </div>
        </section>
      );
    }
    return null;
  }

  return (
    <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <ListTodo className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Shared To-Do List</h2>
            <p className="text-xs text-muted-foreground">
              {isPartnerView ? "Tasks you can work on together" : "Collaborate with your partner"}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="space-y-4">
          {/* Add task input */}
          <div className="flex gap-2">
            <Input
              placeholder="Add a task..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
              className="h-10 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddTask}
              disabled={!newTaskTitle.trim() || isAdding}
              className="shrink-0 h-10 w-10 p-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Task list */}
          {tasks.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  No tasks yet. Add your first shared task above.
                </p>
              </div>
              
              {/* Smart suggestions when no tasks */}
              {smartSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Lightbulb className="w-3.5 h-3.5" />
                    Suggested for week {currentWeek}
                  </div>
                  {smartSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleAddSuggestion(suggestion.title)}
                      disabled={isAdding}
                      className="w-full text-left p-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                          suggestion.priority === "high" 
                            ? "border-amber-400 group-hover:border-amber-500" 
                            : "border-border group-hover:border-primary/50"
                        )}>
                          <Plus className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium group-hover:text-primary transition-colors">
                            {suggestion.title}
                          </p>
                          {suggestion.reason && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {suggestion.reason}
                            </p>
                          )}
                        </div>
                        {suggestion.priority === "high" && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            Recommended
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Incomplete tasks */}
              {incompleteTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 group transition-colors"
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
                    className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Completed tasks */}
              {completedTasks.length > 0 && (
                <div className="pt-3 mt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2 px-3">
                    Completed ({completedTasks.length})
                  </p>
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 group transition-colors"
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
                        className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Smart suggestions when there are tasks */}
              {smartSuggestions.length > 0 && (
                <div className="pt-4 mt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2 px-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Suggestions for week {currentWeek}
                  </div>
                  <div className="space-y-1">
                    {smartSuggestions.slice(0, 2).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleAddSuggestion(suggestion.title)}
                        disabled={isAdding}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-muted/50 transition-all group flex items-center gap-3"
                      >
                        <div className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center shrink-0 group-hover:border-primary/50">
                          <Plus className="w-3 h-3 text-muted-foreground/60 group-hover:text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                            {suggestion.title}
                          </span>
                        </div>
                        {suggestion.priority === "high" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100/50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                            Recommended
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}