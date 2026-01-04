// client/src/pages/journal.tsx

import { Layout } from "@/components/layout";
import { usePregnancyState } from "@/hooks/usePregnancyState";
import { usePregnancyLogs } from "@/hooks/usePregnancyLogs";
import { usePartnerAccess } from "@/contexts/PartnerContext";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import {
  Smile,
  Meh,
  Frown,
  BookOpen,
  Loader2,
  Calendar,
  Clock,
  Lock,
} from "lucide-react";
import type { PregnancyLog } from "@shared/schema";

function Journal() {
  const { dueDate, setDueDate, momName } = usePregnancyState();
  const { data: logs, isLoading, error } = usePregnancyLogs();
  const { isPartnerView } = usePartnerAccess();

  // Block partner access to journal
  if (isPartnerView) {
    return (
      <Layout dueDate={dueDate} setDueDate={setDueDate}>
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <section className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
              <Lock className="w-10 h-10 text-muted-foreground" />
            </div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold mb-3">
              Journal is Private
            </h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              {momName 
                ? `${momName}'s journal entries are personal and only visible to them.`
                : "Journal entries are personal and only visible to the mom."
              }
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Check out the home page for ways you can support this week.
            </p>
          </section>
        </div>
      </Layout>
    );
  }

  // Group logs by week for better organization
  const groupedByWeek =
    logs?.reduce((acc, log) => {
      const week = log.week;
      if (!acc[week]) {
        acc[week] = [];
      }
      acc[week].push(log);
      return acc;
    }, {} as Record<number, PregnancyLog[]>) ?? {};

  // Sort weeks in descending order (most recent first)
  const sortedWeeks = Object.keys(groupedByWeek)
    .map(Number)
    .sort((a, b) => b - a);

  const moodConfig = {
    happy: {
      icon: Smile,
      label: "Great",
      bg: "bg-green-50 dark:bg-green-950/40",
      border: "border-green-200 dark:border-green-800",
      title: "text-green-800 dark:text-green-200",
      iconColor: "text-green-600 dark:text-green-400",
    },
    neutral: {
      icon: Meh,
      label: "Okay",
      bg: "bg-yellow-50 dark:bg-yellow-950/40",
      border: "border-yellow-200 dark:border-yellow-800",
      title: "text-yellow-800 dark:text-yellow-200",
      iconColor: "text-yellow-600 dark:text-yellow-400",
    },
    sad: {
      icon: Frown,
      label: "Not great",
      bg: "bg-red-50 dark:bg-red-950/40",
      border: "border-red-200 dark:border-red-800",
      title: "text-red-800 dark:text-red-200",
      iconColor: "text-red-600 dark:text-red-400",
    },
  };

  return (
    <Layout dueDate={dueDate} setDueDate={setDueDate}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <section className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2">
            Your Pregnancy Journal
          </h1>
          <p className="text-muted-foreground text-lg">
            A record of your journey, one day at a time
          </p>
        </section>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">
              Loading your journal entries...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700">
              Oops! Something went wrong while loading your journal.
            </p>
            <p className="text-sm text-red-600 mt-1">
              Please try refreshing the page.
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && logs?.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl p-12 border border-border text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
              <BookOpen className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="font-serif text-2xl font-medium mb-2">
              No entries yet
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Start tracking your pregnancy journey by completing your daily
              check-in on the home page. Your entries will appear here.
            </p>
          </motion.div>
        )}

        {/* Journal Entries by Week */}
        {!isLoading && !error && sortedWeeks.length > 0 && (
          <div className="space-y-8">
            {sortedWeeks.map((week) => (
              <motion.section
                key={week}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Week Header */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">
                      {week}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-serif text-xl font-semibold">
                      Week {week}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {groupedByWeek[week].length}{" "}
                      {groupedByWeek[week].length === 1 ? "entry" : "entries"}
                    </p>
                  </div>
                </div>

                {/* Entries for this week */}
                <div className="grid gap-4 pl-5 border-l-2 border-primary/20 ml-5">
                  {groupedByWeek[week].map((log: PregnancyLog, index: number) => {
                    const mood =
                      moodConfig[log.mood as keyof typeof moodConfig];
                    const MoodIcon = mood.icon;
                    const logDate = parseISO(log.date);

                    return (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          "rounded-xl p-5 border transition-all hover:shadow-md",
                          mood.bg,
                          mood.border
                        )}
                      >
                        {/* Entry Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center",
                                "bg-white dark:bg-white/10 shadow-sm"
                              )}
                            >
                              <MoodIcon
                                className={cn("w-5 h-5", mood.iconColor)}
                              />
                            </div>
                            <div>
                              <div className={cn("font-semibold", mood.title)}>
                                Feeling {mood.label.toLowerCase()}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-foreground/60 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {format(logDate, "EEEE, MMM d")}
                                </span>
                                {log.createdAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(
                                      new Date(log.createdAt),
                                      "h:mm a"
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Symptoms */}
                        {log.symptoms && (
                          <div className="mb-3">
                            <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-1">
                              Symptoms
                            </h4>
                            <p className="text-sm text-foreground font-medium">
                              {log.symptoms}
                            </p>
                          </div>
                        )}

                        {/* Notes */}
                        {log.notes && (
                          <div>
                            <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-1">
                              Notes
                            </h4>
                            <p className="text-sm text-foreground leading-relaxed">
                              {log.notes}
                            </p>
                          </div>
                        )}

                        {/* Empty content indicator */}
                        {!log.symptoms && !log.notes && (
                          <p className="text-sm text-foreground/50 italic">
                            No additional notes for this day
                          </p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.section>
            ))}
          </div>
        )}

        {/* Stats Footer */}
        {!isLoading && !error && logs && logs.length > 0 && (
          <section className="bg-card rounded-xl p-6 border border-border">
            <h3 className="font-serif text-lg font-medium mb-4">
              Journal Stats
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-primary">
                  {logs.length}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total Entries
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/40">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {logs.filter((l) => l.mood === "happy").length}
                </div>
                <div className="text-xs text-muted-foreground">Great Days</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/40">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {logs.filter((l) => l.mood === "neutral").length}
                </div>
                <div className="text-xs text-muted-foreground">Okay Days</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950/40">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {logs.filter((l) => l.mood === "sad").length}
                </div>
                <div className="text-xs text-muted-foreground">Tough Days</div>
              </div>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}

export default Journal;