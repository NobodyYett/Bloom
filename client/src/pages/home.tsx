// client/src/pages/home.tsx

import { useEffect, useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { WeekProgress } from "@/components/week-progress";
import { BabySizeDisplay } from "@/components/baby-size-display";
import { DailyCheckIn } from "@/components/daily-checkin";
import { WeeklySummary } from "@/components/weekly-summary";
import { usePregnancyState } from "@/hooks/usePregnancyState";
import { WeeklyWisdom } from "@/components/weekly-wisdom";
import { Registries } from "@/components/registries";
import { SharedTasksCard } from "@/components/shared-tasks-card";
import { useTodayLogs } from "@/hooks/usePregnancyLogs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerAccess } from "@/contexts/PartnerContext";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import generatedBg from "@/asset/soft_pastel_gradient_background_with_organic_shapes.png";

type NextAppt = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
};

export default function Home() {
  const {
    dueDate,
    setDueDate,
    currentWeek,
    daysRemaining,
    trimester,
    babyName,
    babySex,
    setBabyName,
    momName,
    partnerName,
  } = usePregnancyState();

  const { user } = useAuth();
  const { isPartnerView, momName: partnerMomName, momUserId } = usePartnerAccess();
  
  const [nextAppt, setNextAppt] = useState<NextAppt | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(babyName ?? "");
  
  // Task suggestion setting (read from localStorage)
  const [showTaskSuggestions, setShowTaskSuggestions] = useState(() => {
    const stored = localStorage.getItem("bumpplanner_show_task_suggestions");
    return stored !== "false"; // Default: true
  });
  
  // Listen for changes from settings page
  useEffect(() => {
    function handleStorageChange() {
      const stored = localStorage.getItem("bumpplanner_show_task_suggestions");
      setShowTaskSuggestions(stored !== "false");
    }
    window.addEventListener("storage", handleStorageChange);
    // Also listen for custom event (same-tab updates)
    window.addEventListener("taskSuggestionsChanged", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("taskSuggestionsChanged", handleStorageChange);
    };
  }, []);

  // TODO: Replace with actual subscription check
  const isPaid = false;

  // Get today's check-ins for nudge + AI context (only for mom view)
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const { data: todayLogs = [] } = useTodayLogs(todayDate);

  // Extract check-in context for nudge (most recent check-in) - only used in mom view
  const checkinContext = useMemo(() => {
    if (isPartnerView || todayLogs.length === 0) return null;
    
    const mostRecent = todayLogs[todayLogs.length - 1];
    const symptoms = mostRecent?.symptoms
      ? String(mostRecent.symptoms).split(",").map((s: string) => s.trim())
      : [];
    
    return {
      slot: mostRecent?.slot as string | undefined,
      mood: mostRecent?.mood as "happy" | "neutral" | "sad" | null,
      symptoms,
      notes: mostRecent?.notes ? String(mostRecent.notes) : undefined,
    };
  }, [todayLogs, isPartnerView]);

  useEffect(() => {
    setTempName(babyName ?? "");
  }, [babyName]);

  const heroTitle =
    !dueDate || currentWeek <= 0
      ? "Welcome"
      : babyName && babyName.trim().length > 0
      ? babyName.trim()
      : babySex === "boy"
      ? "Baby Boy"
      : babySex === "girl"
      ? "Baby Girl"
      : "Boy or Girl?";

  const heroSubtitle =
    currentWeek > 0 && daysRemaining > 0
      ? `${daysRemaining} days to go! ${isPartnerView ? "You're in this together." : "You're doing amazing."}`
      : currentWeek > 0 && daysRemaining <= 0
      ? "The due date has arrived! Best wishes!"
      : "Let's set your due date to start your journey.";

  // Build parent pills
  const parentPills = useMemo(() => {
    const pills: string[] = [];
    if (momName && momName.trim()) pills.push(momName.trim());
    if (partnerName && partnerName.trim()) pills.push(partnerName.trim());
    return pills;
  }, [momName, partnerName]);

  useEffect(() => {
    if (!user) return;

    async function loadNext() {
      if (!user) return;
      
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("pregnancy_appointments")
        .select("id, title, starts_at, location")
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(1);

      if (error) {
        console.error(error);
        setNextAppt(null);
        return;
      }

      setNextAppt(data?.[0] ?? null);
    }

    loadNext();
  }, [user]);

  function handleSaveName() {
    const cleaned = tempName.trim();
    setBabyName(cleaned.length > 0 ? cleaned : null);
    setEditingName(false);
  }

  function handleCancelEdit() {
    setTempName(babyName ?? "");
    setEditingName(false);
  }

  return (
    <Layout dueDate={dueDate} setDueDate={setDueDate}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Hero Section */}
        <section className="relative rounded-3xl overflow-hidden p-10 md:p-14 text-white">
          <div
            className="absolute inset-0 bg-cover bg-center z-0"
            style={{ backgroundImage: `url(${generatedBg})` }}
          />
          <div className="absolute inset-0 bg-black/10 z-10" />

          <div className="relative z-20 max-w-3xl">
            {dueDate && currentWeek > 0 ? (
              <>
                {/* Name editing - only for mom */}
                {!isPartnerView && editingName ? (
                  <div className="space-y-3 max-w-md mb-4">
                    <label className="text-xs font-medium text-gray-700/80">
                      Baby&apos;s name (optional)
                    </label>
                    <Input
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      placeholder="Type baby's name or leave blank"
                      className="bg-white/80 text-black"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveName}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-2">
                    {/* Clickable for mom, static for partner */}
                    {isPartnerView ? (
                      <h1 className="font-serif text-6xl md:text-7xl font-bold drop-shadow-sm text-gray-800 tracking-tight">
                        {heroTitle}
                      </h1>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingName(true)}
                        className="text-left group"
                      >
                        <h1 className="font-serif text-6xl md:text-7xl font-bold drop-shadow-sm text-gray-800 tracking-tight">
                          {heroTitle}
                        </h1>
                        <p className="text-xs mt-1 text-gray-700/80 group-hover:text-gray-900 transition-colors">
                          Tap to edit baby&apos;s name
                        </p>
                      </button>
                    )}
                  </div>
                )}

                {/* Parent name pills */}
                {parentPills.length > 0 && (
                  <div className="flex gap-2 mt-3 mb-4">
                    {parentPills.map((name, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/30 text-gray-800 backdrop-blur-sm"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-base md:text-lg text-gray-600/90">
                  {heroSubtitle}
                </p>
              </>
            ) : (
              <>
                <h1 className="font-serif text-6xl md:text-7xl font-bold mb-4 drop-shadow-sm text-gray-800 tracking-tight">
                  Welcome
                </h1>
                <p className="text-base md:text-lg text-gray-600/90">
                  {heroSubtitle}
                </p>
              </>
            )}
          </div>
        </section>

        <div className={cn(
          "grid grid-cols-1 md:grid-cols-3 gap-8",
          isPartnerView && "items-stretch"
        )}>
          <div className="md:col-span-2 space-y-8">
            <BabySizeDisplay currentWeek={currentWeek} />

            {/* Current Progress */}
            <div className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
              <WeekProgress currentWeek={currentWeek} />

              <Link href="/appointments">
                <div
                  className={cn(
                    "rounded-xl px-4 py-4 cursor-pointer transition",
                    nextAppt
                      ? "bg-primary/10 border border-primary/20 hover:bg-primary/20"
                      : "bg-muted/40 border border-border hover:bg-muted"
                  )}
                >
                  {nextAppt ? (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-primary tracking-wide uppercase">
                        Next Appointment
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {format(new Date(nextAppt.starts_at), "EEE, MMM d • p")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {nextAppt.title}
                        {nextAppt.location ? ` • ${nextAppt.location}` : ""}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
                        Next Appointment
                      </p>
                      <p className="text-sm text-muted-foreground">
                        No upcoming appointments.
                      </p>
                    </div>
                  )}
                </div>
              </Link>
            </div>

            {/* Weekly Summary - only for mom in left column */}
            {!isPartnerView && (
              <WeeklySummary 
                isPaid={isPaid} 
                checkinContext={checkinContext}
                isPartnerView={false}
              />
            )}

            {/* Registry for Partner - in left column, same width as Current Progress */}
            {isPartnerView && (
              <Registries isReadOnly={true} />
            )}
          </div>

          {/* Right column */}
          <div className={cn(
            "space-y-6",
            isPartnerView && "flex flex-col h-full"
          )}>
            {/* Daily Check-in - only for mom */}
            {!isPartnerView && (
              <DailyCheckIn currentWeek={currentWeek} />
            )}
            
            {/* "How She's Doing" card for partners - fills height */}
            {isPartnerView && (
              <div className="flex-1 flex flex-col">
                <WeeklySummary 
                  isPaid={false} 
                  checkinContext={null}
                  isPartnerView={true}
                  currentWeek={currentWeek}
                  trimester={trimester}
                  momName={partnerMomName}
                  hasUpcomingAppointment={!!nextAppt}
                />
              </div>
            )}
          </div>
        </div>

        {/* Weekly Wisdom - only for mom */}
        {!isPartnerView && (
          <WeeklyWisdom 
            currentWeek={currentWeek} 
            trimester={trimester} 
            checkinContext={checkinContext}
          />
        )}

        {/* Registries - full width for mom only */}
        {!isPartnerView && (
          <Registries isReadOnly={false} />
        )}

        {/* Shared Tasks - separate card for both views (after registries) */}
        {(() => {
          const taskUserId = isPartnerView ? momUserId : user?.id;
          if (!taskUserId) return null;
          return (
            <SharedTasksCard
              momUserId={taskUserId}
              trimester={trimester}
              currentWeek={currentWeek}
              isPartnerView={isPartnerView}
              showSuggestions={showTaskSuggestions}
            />
          );
        })()}
      </div>
    </Layout>
  );
}