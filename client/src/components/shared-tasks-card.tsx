// client/src/components/shared-tasks-card.tsx

import { useState, useEffect } from "react";
import { Plus, Trash2, CheckCircle2, Circle, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  isPartnerView?: boolean;
}

// Default task suggestions by trimester
function getDefaultSuggestions(trimester: 1 | 2 | 3): string[] {
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
    ];
  } else {
    return [
      "Pack hospital bag",
      "Install car seat",
      "Finish nursery setup",
    ];
  }
}

export function SharedTasksCard({ momUserId, trimester, isPartnerView = false }: SharedTasksCardProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<SharedTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [tableExists, setTableExists] = useState(true);

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
  const suggestions = getDefaultSuggestions(trimester);

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
            <div className="text-center py-6 px-4 rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground mb-2">
                No tasks yet. Add your first shared task above.
              </p>
              <p className="text-xs text-muted-foreground">
                Try: {suggestions[0]}
              </p>
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
            </div>
          )}
        </div>
      </div>
    </section>
  );
}