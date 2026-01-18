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
import { useRecentJournalEntries } from "@/hooks/useJournalEntries";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerAccess } from "@/contexts/PartnerContext";
import { usePremium } from "@/contexts/PremiumContext";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import generatedBg from "@/asset/soft_pastel_gradient_background_with_organic_shapes.png";
import { FeedingTracker } from "@/components/feeding-tracker";
import { useFeedingNotifications } from "@/hooks/useFeedingNotifications";
import { BookOpen, ChevronRight } from "lucide-react";

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
    appMode,
    babyBirthDate,
    babyAgeWeeks,
    babyAgeDays,
  } = usePregnancyState();

  const { user } = useAuth();
  const { isPartnerView, momName: partnerMomName, momUserId } = usePartnerAccess();
  const [, navigate] = useLocation();
  
  // Recent journal entries for preview (mom-only)
  const { data: recentJournalEntries = [] } = useRecentJournalEntries(2);
  
  const [nextAppt, setNextAppt] = useState<NextAppt | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(babyName ?? "");
  
  // Task suggestion setting (read from localStorage)
  const [showTaskSuggestions, setShowTaskSuggestions] = useState(() => {
    const stored = localStorage.getItem("bloom_show_task_suggestions");
    return stored !== "false"; // Default: true
  });
  
  // Listen for changes from settings page
  useEffect(() => {
    function handleStorageChange() {
      const stored = localStorage.getItem("bloom_show_task_suggestions");
      setShowTaskSuggestions(stored !== "false");
    }
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("taskSuggestionsChanged", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("taskSuggestionsChanged", handleStorageChange);
    };
  }, []);

  // Premium subscription status
  const { isPremium: isPaid } = usePremium();

  // Enable feeding notifications for infancy mode
  useFeedingNotifications({ 
    enabled: appMode === "infancy",
    reminderEnabled: true 
  });

  // Get today's check-ins for nudge + AI context (only for mom view)
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const { data: todayLogs = [] } = useTodayLogs(todayDate);

  // Extract check-in context for nudge
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

  // Hero title - same for both modes, just shows baby name
  const heroTitle =
    !dueDate && appMode === "pregnancy"
      ? "Welcome"
      : babyName && babyName.trim().length > 0
      ? babyName.trim()
      : babySex === "boy"
      ? "Baby Boy"
      : babySex === "girl"
      ? "Baby Girl"
      : appMode === "infancy"
      ? "Baby"
      : "Boy or Girl?";

  // Hero subtitle - different for pregnancy vs infancy
  const heroSubtitle = useMemo(() => {
    if (appMode === "infancy") {
      return isPartnerView 
        ? "You're in this together." 
        : "You're doing amazing.";
    }
    
    // Pregnancy mode
    if (currentWeek > 0 && daysRemaining > 0) {
      return `${daysRemaining} days to go! ${isPartnerView ? "You're in this together." : "You're doing amazing."}`;
    }
    if (currentWeek > 0 && daysRemaining <= 0) {
      return "The due date has arrived! Best wishes!";
    }
    return "Let's set your due date to start your journey.";
  }, [appMode, currentWeek, daysRemaining, isPartnerView]);

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

  // Calculate effective week for components (pregnancy week OR baby age week)
  const effectiveWeek = appMode === "infancy" ? babyAgeWeeks + 1 : currentWeek;

  return (
    <Layout dueDate={dueDate} setDueDate={setDueDate} appMode={appMode} babyBirthDate={babyBirthDate}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Hero Section */}
        <section className="relative rounded-3xl overflow-hidden p-10 md:p-14 text-white">
          {/* Base background image */}
          <div
            className="absolute inset-0 bg-cover bg-center z-0"
            style={{ backgroundImage: `url(${generatedBg})` }}
          />
          
          {/* Theme gradient overlay - changes based on baby_sex */}
          <div className="hero-gradient-overlay absolute inset-0" style={{ zIndex: 5 }} />
          
          {/* Decorative clouds */}
          <div className="hero-cloud" />
          <div className="hero-cloud" />
          <div className="hero-cloud" />
          <div className="hero-cloud" />
          
          {/* Decorative sparkles (girl theme) */}
          <div className="hero-sparkle" />
          <div className="hero-sparkle" />
          <div className="hero-sparkle" />
          <div className="hero-sparkle" />
          <div className="hero-sparkle" />
          
          {/* Wave decoration at bottom */}
          <div className="hero-wave" />
          
          {/* Dark overlay for text readability (hidden when themed) */}
          <div className="hero-neutral-overlay absolute inset-0 bg-black/10 z-10" />

          <div className="relative z-20 max-w-3xl">
            {(dueDate && currentWeek > 0) || appMode === "infancy" ? (
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
                      <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-2">
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
          isPartnerView && "md:items-stretch"
        )}>
          <div className="md:col-span-2 space-y-8 flex flex-col">
            {/* Baby Size/Model - pass appMode so it can show appropriate content */}
            <BabySizeDisplay currentWeek={effectiveWeek} appMode={appMode} />

            {/* Progress (pregnancy) OR Age (infancy) */}
            <div className="bg-card rounded-xl p-6 border border-border/60 space-y-4">
              {appMode === "infancy" ? (
                /* INFANCY: Age display */
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
                    Age
                  </h3>
                  <div className="flex items-baseline gap-2">
                    {babyAgeWeeks === 0 ? (
                      /* First week: show only days */
                      <>
                        <span className="text-4xl font-bold text-foreground">
                          {babyAgeDays || 0}
                        </span>
                        <span className="text-lg text-muted-foreground">
                          {babyAgeDays === 1 ? "day" : "days"}
                        </span>
                      </>
                    ) : (
                      /* After first week: show weeks and days */
                      <>
                        <span className="text-4xl font-bold text-foreground">
                          {babyAgeWeeks}
                        </span>
                        <span className="text-lg text-muted-foreground">
                          {babyAgeWeeks === 1 ? "week" : "weeks"}
                        </span>
                        {babyAgeDays > 0 && (
                          <>
                            <span className="text-2xl font-semibold text-foreground ml-2">
                              {babyAgeDays}
                            </span>
                            <span className="text-base text-muted-foreground">
                              {babyAgeDays === 1 ? "day" : "days"}
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  {babyBirthDate && (
                    <p className="text-xs text-muted-foreground">
                      Born {format(babyBirthDate, "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  )}
                </div>
              ) : (
                /* PREGNANCY: Week progress */
                <WeekProgress 
                  currentWeek={currentWeek}
                  subtextElement={
                    !isPartnerView && dueDate && daysRemaining <= 30 ? (
                      <Link href="/baby-arrived">
                        <p className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer text-center mt-1">
                          Baby arrived early? Tap here
                        </p>
                      </Link>
                    ) : undefined
                  }
                />
              )}

              {/* Appointments - same for both modes */}
              <Link href="/appointments">
                <div
                  className={cn(
                    "rounded-xl px-4 py-4 cursor-pointer transition",
                    nextAppt
                      ? "bg-primary/10 border border-primary/30 hover:bg-primary/15"
                      : "bg-muted/50 border border-border/60 hover:bg-muted"
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
                currentWeek={effectiveWeek}
                appMode={appMode}
              />
            )}

            {/* Registry for Partner - in left column */}
            {isPartnerView && (
              <Registries isReadOnly={true} />
            )}
          </div>

          {/* Right column */}
          <div className={cn(
            "space-y-6",
            isPartnerView && "self-stretch"
          )}>
            {/* Daily Check-in - only for mom */}
            {!isPartnerView && (
              <DailyCheckIn currentWeek={effectiveWeek} appMode={appMode} />
            )}
            
            {/* "How She's Doing" card for partners */}
            {isPartnerView && (
              <div className="h-full">
                <WeeklySummary 
                  isPaid={isPaid} 
                  checkinContext={null}
                  isPartnerView={true}
                  currentWeek={effectiveWeek}
                  trimester={trimester}
                  momName={partnerMomName}
                  hasUpcomingAppointment={!!nextAppt}
                  appMode={appMode}
                />
              </div>
            )}
          </div>
        </div>

        {/* Weekly Wisdom - AI-powered for both modes, mom only in pregnancy */}
        {appMode === "infancy" ? (
          /* INFANCY: Show WeeklyWisdom for both mom and partner */
          <WeeklyWisdom 
            currentWeek={effectiveWeek} 
            trimester={3}
            checkinContext={checkinContext}
            appMode={appMode}
            isPartnerView={isPartnerView}
          />
        ) : (
          /* PREGNANCY: Show WeeklyWisdom for mom only */
          !isPartnerView && (
            <WeeklyWisdom 
              currentWeek={effectiveWeek} 
              trimester={trimester} 
              checkinContext={checkinContext}
              appMode={appMode}
              isPartnerView={false}
            />
          )
        )}

        {/* Shared Tasks */}
        {(() => {
          const taskUserId = isPartnerView ? momUserId : user?.id;
          if (!taskUserId) return null;
          return (
            <SharedTasksCard
              momUserId={taskUserId}
              trimester={trimester}
              currentWeek={effectiveWeek}
              isPartnerView={isPartnerView}
              showSuggestions={showTaskSuggestions}
              isPaid={isPaid}
              appMode={appMode}
            />
          );
        })()}

        {/* Recent Journal Entries - mom only */}
        {!isPartnerView && recentJournalEntries.length > 0 && (
          <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-medium text-sm text-foreground">Recent Journal</h2>
                  <p className="text-xs text-muted-foreground">Your latest entries</p>
                </div>
              </div>
              <Link href="/journal">
                <span className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer flex items-center gap-1">
                  View all
                  <ChevronRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
            <div className="divide-y divide-border/60">
              {recentJournalEntries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => navigate(`/journal?entry=${entry.id}`)}
                  className="px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {entry.title || format(new Date(entry.entry_date + "T00:00:00"), "EEEE, MMM d")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.created_at), "h:mm a")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {entry.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Registries - full width for mom only, at bottom, minimized in infancy mode */}
        {!isPartnerView && (
          <Registries isReadOnly={appMode === "infancy"} />
        )}
      </div>
    </Layout>
  );
}