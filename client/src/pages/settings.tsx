// client/src/pages/settings.tsx

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { usePregnancyState, type BabySex } from "@/hooks/usePregnancyState";
import { usePartnerAccess } from "@/contexts/PartnerContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { Loader2, Save, Sun, Moon, Monitor, Users, Lightbulb, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme, type ThemeMode } from "@/theme/theme-provider";
import { PremiumLock } from "@/components/premium-lock";
import { usePremium } from "@/contexts/PremiumContext";

// Extracted components
import { NotificationSettings } from "@/components/settings/notification-settings";
import { PartnerAccessSection } from "@/components/settings/partner-access-section";
import { DangerZoneSection } from "@/components/settings/danger-zone-section";

function parseLocalDate(dateString: string): Date | null {
  const trimmed = dateString.trim();
  if (!trimmed) return null;
  const [year, month, day] = trimmed.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { mode, setMode } = useTheme();
  const { isPartnerView, momName } = usePartnerAccess();

  const {
    dueDate, setDueDate,
    babyName, setBabyName,
    babySex, setBabySex,
    momName: profileMomName, setMomName,
    partnerName, setPartnerName,
    appMode,
    babyBirthDate,
    refetch,
  } = usePregnancyState();

  const [nameInput, setNameInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [sexInput, setSexInput] = useState<"boy" | "girl" | "unknown">("unknown");
  const [momInput, setMomInput] = useState("");
  const [partnerInput, setPartnerInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Infancy mode state
  const [isReverting, setIsReverting] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

  // Task suggestions state
  const [taskSuggestionsEnabled, setTaskSuggestionsEnabled] = useState(() => {
    const stored = localStorage.getItem("bloom_show_task_suggestions");
    return stored !== "false";
  });

  // Premium subscription status
  const { isPremium: isPaid, canPurchase } = usePremium();

  useEffect(() => {
    setNameInput(babyName ?? "");
    setDateInput(dueDate ? format(dueDate, "yyyy-MM-dd") : "");
    setSexInput(babySex || "unknown");
    setMomInput(profileMomName ?? "");
    setPartnerInput(partnerName ?? "");
  }, [babyName, dueDate, babySex, profileMomName, partnerName]);

  function handleTaskSuggestionsToggle(enabled: boolean) {
    setTaskSuggestionsEnabled(enabled);
    localStorage.setItem("bloom_show_task_suggestions", enabled ? "true" : "false");
    window.dispatchEvent(new Event("taskSuggestionsChanged"));
    toast({
      title: enabled ? "Suggestions enabled" : "Suggestions disabled",
      description: enabled
        ? "You'll see task ideas based on your pregnancy progress."
        : "Task suggestions are now hidden.",
    });
  }

  async function handleSaveChanges() {
    if (!user || isPartnerView) return;
    setIsSaving(true);
    const sexToSave: BabySex = sexInput;
    const parsedDueDate = parseLocalDate(dateInput);

    if (parsedDueDate) {
      const daysFromToday = differenceInDays(parsedDueDate, new Date());
      if (daysFromToday < -30 || daysFromToday > 310) {
        setIsSaving(false);
        toast({ variant: "destructive", title: "That date looks unusual", description: "Please double-check the due date." });
        return;
      }
    }

    try {
      const { error } = await supabase
        .from("pregnancy_profiles")
        .update({
          baby_name: nameInput.trim() || null,
          due_date: dateInput.trim() || null,
          baby_sex: sexToSave,
          mom_name: momInput.trim() || null,
          partner_name: partnerInput.trim() || null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setBabyName(nameInput.trim() || null);
      setDueDate(parsedDueDate);
      setBabySex(sexToSave);
      setMomName(momInput.trim() || null);
      setPartnerName(partnerInput.trim() || null);

      toast({ title: "Settings Saved", description: "Your details have been updated." });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "Failed to save changes." });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRevertToPregnancy() {
    if (!user) return;
    setIsReverting(true);
    
    try {
      const { error } = await supabase
        .from("pregnancy_profiles")
        .update({
          app_mode: "pregnancy",
          baby_birth_date: null,
          infancy_onboarding_complete: false,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      await refetch();
      setShowRevertConfirm(false);
      toast({
        title: "Reverted to pregnancy mode",
        description: "Your timeline has been restored.",
      });
    } catch (err) {
      console.error("Failed to revert:", err);
      toast({
        variant: "destructive",
        title: "Failed to revert",
        description: "Please try again.",
      });
    } finally {
      setIsReverting(false);
    }
  }

  const themeOptions: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: "system", label: "System", icon: <Monitor className="w-4 h-4" /> },
    { value: "light", label: "Light", icon: <Sun className="w-4 h-4" /> },
    { value: "dark", label: "Dark", icon: <Moon className="w-4 h-4" /> },
  ];

  return (
    <Layout dueDate={dueDate} setDueDate={setDueDate}>
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
        <header className="space-y-2">
          <h1 className="font-serif text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            {isPartnerView 
              ? "Manage your account preferences."
              : "Manage your pregnancy details and account preferences."
            }
          </p>
        </header>

        {/* Appearance */}
        <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-muted/30 px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold">Appearance</h2>
            <p className="text-sm text-muted-foreground">Choose how Bloom looks to you.</p>
          </div>
          <div className="p-6 space-y-3">
            <label className="text-sm font-medium">Theme</label>
            <div className="flex gap-3">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 border rounded-lg px-4 py-3 transition-all",
                    mode === opt.value ? "bg-primary/10 border-primary text-primary ring-1 ring-primary/20" : "hover:bg-muted border-border"
                  )}
                >
                  {opt.icon}
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">System matches your device appearance.</p>
          </div>
        </section>

        {/* Notifications - Extracted Component */}
        <NotificationSettings isPartnerView={isPartnerView} />

        {/* To-Do List Settings - Premium feature */}
        {!isPartnerView && (
          <PremiumLock isPaid={isPaid} message="Personalized task suggestions">
            <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="bg-muted/30 px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  To-Do List
                </h2>
                <p className="text-sm text-muted-foreground">
                  Customize your shared to-do list experience.
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Pregnancy task suggestions</label>
                    <p className="text-xs text-muted-foreground">
                      Show suggested to-dos based on pregnancy progress.
                    </p>
                  </div>
                  <Switch
                    checked={taskSuggestionsEnabled}
                    onCheckedChange={handleTaskSuggestionsToggle}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Suggestions are personalized to your current week and won't repeat tasks you've already added.
                </p>
              </div>
            </section>
          </PremiumLock>
        )}

        {/* Partner Access - Extracted Component */}
        {!isPartnerView && <PartnerAccessSection isPaid={isPaid} />}

        {/* Pregnancy Details - only for mom (now includes parent names) */}
        {!isPartnerView && (
          <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-muted/30 px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">Pregnancy Details</h2>
              <p className="text-sm text-muted-foreground">Update your info to recalculate your timeline.</p>
            </div>
            <div className="p-6 grid gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Baby&apos;s Name</label>
                <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="e.g. Oliver" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Due Date</label>
                <Input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Baby&apos;s Sex</label>
                <div className="flex gap-3">
                  <label className={cn(
                    "flex-1 flex items-center justify-center gap-2 cursor-pointer border rounded-md px-4 py-3 transition-all",
                    sexInput === "boy" ? "bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300" : "hover:bg-muted"
                  )}>
                    <input type="radio" name="sex" checked={sexInput === "boy"} onChange={() => setSexInput("boy")} className="sr-only" />
                    <span>Boy</span>
                  </label>
                  <label className={cn(
                    "flex-1 flex items-center justify-center gap-2 cursor-pointer border rounded-md px-4 py-3 transition-all",
                    sexInput === "unknown" ? "bg-muted border-border text-foreground ring-1 ring-border" : "hover:bg-muted"
                  )}>
                    <input type="radio" name="sex" checked={sexInput === "unknown"} onChange={() => setSexInput("unknown")} className="sr-only" />
                    <span>Unknown</span>
                  </label>
                  <label className={cn(
                    "flex-1 flex items-center justify-center gap-2 cursor-pointer border rounded-md px-4 py-3 transition-all",
                    sexInput === "girl" ? "bg-pink-50 border-pink-200 text-pink-700 ring-1 ring-pink-200 dark:bg-pink-950 dark:border-pink-800 dark:text-pink-300" : "hover:bg-muted"
                  )}>
                    <input type="radio" name="sex" checked={sexInput === "girl"} onChange={() => setSexInput("girl")} className="sr-only" />
                    <span>Girl</span>
                  </label>
                </div>
              </div>
              
              {/* Parent Names - merged from separate section */}
              <div className="border-t border-border pt-6 space-y-4">
                <p className="text-xs text-muted-foreground">Optional. Displayed on your home screen.</p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mom&apos;s Name</label>
                  <Input value={momInput} onChange={(e) => setMomInput(e.target.value)} placeholder="e.g. Sarah" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Partner&apos;s Name</label>
                  <Input value={partnerInput} onChange={(e) => setPartnerInput(e.target.value)} placeholder="e.g. Alex" />
                </div>
              </div>
            </div>
            <div className="bg-muted/30 px-6 py-4 border-t border-border flex justify-end">
              <Button onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
              </Button>
            </div>
          </section>
        )}

        {/* Baby Arrived / Infancy Mode - only for mom */}
        {!isPartnerView && (
          <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-muted/30 px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">
                {appMode === "infancy" ? "Infancy Mode" : "Baby Arrived?"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {appMode === "infancy" 
                  ? "You're tracking your baby's early weeks."
                  : "Transition to infancy mode when your baby arrives."}
              </p>
            </div>
            <div className="p-6">
              {appMode === "infancy" ? (
                <div className="space-y-4">
                  {babyBirthDate && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Birth Date</span>
                      <span className="text-sm font-medium">
                        {format(babyBirthDate, "MMMM d, yyyy")}
                      </span>
                    </div>
                  )}
                  
                  <div className="border-t border-border pt-4">
                    {!showRevertConfirm ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowRevertConfirm(true)}
                      >
                        Revert to Pregnancy Mode
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          This will restore your pregnancy timeline and clear the birth date. Are you sure?
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={handleRevertToPregnancy}
                            disabled={isReverting}
                          >
                            {isReverting ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reverting...</>
                            ) : (
                              "Yes, Revert"
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setShowRevertConfirm(false)}
                            disabled={isReverting}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Use this if you accidentally triggered infancy mode.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    When your baby arrives, tap below to celebrate and continue your journey with the Infancy Guide.
                  </p>
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => setLocation("/baby-arrived")}
                  >
                    Baby is Here!
                  </Button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Partner info section */}
        {isPartnerView && (
          <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-muted/30 px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Connected Account
              </h2>
              <p className="text-sm text-muted-foreground">
                You're connected to {momName ? `${momName}'s` : "a"} pregnancy profile.
              </p>
            </div>
            <div className="p-6">
              <p className="text-sm text-muted-foreground">
                You have view-only access to track the pregnancy journey and see ways to help. 
                Journal entries, symptoms, and private notes are not visible to you.
              </p>
            </div>
          </section>
        )}

        {/* Premium Subscription Section */}
        <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Crown className="w-5 h-5" />
              Subscription
            </h2>
          </div>
          <div className="p-6">
            {isPaid ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-sm font-medium">Bloom Premium Active</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You have full access to all premium features including Partner View, detailed insights, and more Ivy questions.
                </p>
                {canPurchase && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation("/subscribe")}
                    className="mt-2"
                  >
                    Manage Subscription
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Unlock Partner View, detailed weekly insights, smart task suggestions, and more.
                </p>
                <Button
                  onClick={() => setLocation("/subscribe")}
                  className="w-full"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  {canPurchase ? "Upgrade to Premium" : "View Premium Features"}
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Danger Zone - Extracted Component */}
        <DangerZoneSection />

        {/* Apple-style Footer Links */}
        <footer className="pt-6 pb-4 text-center space-y-3">
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <a 
              href="mailto:support@zelkz.com?subject=Bloom Support Request" 
              className="hover:text-foreground transition-colors"
            >
              Contact Support
            </a>
            <span className="text-muted-foreground/40">·</span>
            <a 
              href="mailto:support@zelkz.com?subject=Bloom Bug Report" 
              className="hover:text-foreground transition-colors"
            >
              Report a Bug
            </a>
            <span className="text-muted-foreground/40">·</span>
            <a 
              href="/privacy.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </a>
            <span className="text-muted-foreground/40">·</span>
            <a 
              href="/terms.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </a>
          </nav>
          <p className="text-xs text-muted-foreground/60">
            Bloom v1.0.0 · Made with love by Zelkz
          </p>
        </footer>
      </div>
    </Layout>
  );
}