// client/src/pages/settings.tsx

import { useEffect, useState } from "react";
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
import { 
  Loader2, Save, Trash2, AlertTriangle, Sun, Moon, Monitor, Bell, 
  Users, Copy, Check, Link2, Clock, Calendar, Lightbulb, ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme, type ThemeMode } from "@/theme/theme-provider";
import { PremiumLock } from "@/components/premium-lock";
import { usePremium } from "@/contexts/PremiumContext";
import {
  generateInviteToken,
  hashToken,
  buildInviteUrl,
} from "@/lib/partnerInvite";
import {
  isNotificationsSupported,
  isMorningCheckinEnabled,
  toggleMorningCheckin,
  isEveningCheckinEnabled,
  toggleEveningCheckin,
  isAppointmentRemindersEnabled,
  toggleAppointmentReminders,
  getDefaultReminderTimes,
  setDefaultReminderTimes,
  hasNotificationPermission,
  requestNotificationPermission,
  REMINDER_TIME_OPTIONS,
  type ReminderTimePreference,
} from "@/lib/notifications";
import { rescheduleAllAppointmentReminders } from "@/hooks/useAppointments";

function parseLocalDate(dateString: string): Date | null {
  const trimmed = dateString.trim();
  if (!trimmed) return null;
  const [year, month, day] = trimmed.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export default function SettingsPage() {
  const { user, signOut, deleteAccount } = useAuth();
  const { toast } = useToast();
  const { mode, setMode } = useTheme();
  const { isPartnerView, momName, hasActivePartner, refreshPartnerAccess } = usePartnerAccess();

  const {
    dueDate, setDueDate,
    babyName, setBabyName,
    babySex, setBabySex,
    momName: profileMomName, setMomName,
    partnerName, setPartnerName,
  } = usePregnancyState();

  const [nameInput, setNameInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [sexInput, setSexInput] = useState<"boy" | "girl" | null>(null);
  const [momInput, setMomInput] = useState("");
  const [partnerInput, setPartnerInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Partner invite state
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [hasExistingInvite, setHasExistingInvite] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Notification state
  const [morningCheckinEnabled, setMorningCheckinEnabled] = useState(false);
  const [eveningCheckinEnabled, setEveningCheckinEnabled] = useState(false);
  const [appointmentRemindersEnabled, setAppointmentRemindersEnabled] = useState(false);
  const [reminderTimes, setReminderTimes] = useState<ReminderTimePreference>({
    firstReminder: 1440,
    secondReminder: 60,
  });
  const [notificationsAvailable, setNotificationsAvailable] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [togglingMorning, setTogglingMorning] = useState(false);
  const [togglingEvening, setTogglingEvening] = useState(false);
  const [togglingAppointments, setTogglingAppointments] = useState(false);

  // Task suggestions state
  const [taskSuggestionsEnabled, setTaskSuggestionsEnabled] = useState(() => {
    const stored = localStorage.getItem("bloom_show_task_suggestions");
    return stored !== "false"; // Default: true
  });

  // Premium subscription status
  const { isPremium: isPaid } = usePremium();

  const email = user?.email ?? "Unknown";

  useEffect(() => {
    async function checkNotifications() {
      const supported = isNotificationsSupported();
      setNotificationsAvailable(supported);
      if (supported) {
        const hasPermission = await hasNotificationPermission();
        setPermissionGranted(hasPermission);
        setMorningCheckinEnabled(isMorningCheckinEnabled());
        setEveningCheckinEnabled(isEveningCheckinEnabled());
        setAppointmentRemindersEnabled(isAppointmentRemindersEnabled());
        setReminderTimes(getDefaultReminderTimes());
      }
    }
    checkNotifications();
  }, []);

  useEffect(() => {
    setNameInput(babyName ?? "");
    setDateInput(dueDate ? format(dueDate, "yyyy-MM-dd") : "");
    setSexInput(babySex && babySex !== "unknown" ? (babySex as "boy" | "girl") : null);
    setMomInput(profileMomName ?? "");
    setPartnerInput(partnerName ?? "");
  }, [babyName, dueDate, babySex, profileMomName, partnerName]);

  useEffect(() => {
    if (isPartnerView || !user) return;

    async function checkExistingInvite() {
      const { data } = await supabase
        .from("partner_access")
        .select("id")
        .eq("mom_user_id", user.id)
        .is("revoked_at", null)
        .limit(1)
        .single();

      setHasExistingInvite(!!data);
    }

    checkExistingInvite();
  }, [user, isPartnerView]);

  async function handleMorningCheckinToggle(enabled: boolean) {
    setTogglingMorning(true);
    try {
      if (enabled && !permissionGranted) {
        const granted = await requestNotificationPermission();
        setPermissionGranted(granted);
        if (!granted) {
          toast({
            title: "Notifications disabled",
            description: "Please enable notifications in your device settings.",
            variant: "destructive",
          });
          setTogglingMorning(false);
          return;
        }
      }
      const success = await toggleMorningCheckin(enabled);
      if (success) {
        setMorningCheckinEnabled(enabled);
        toast({
          title: enabled ? "Morning check-in enabled" : "Morning check-in disabled",
          description: enabled
            ? "You'll receive a gentle reminder at 8:30am each morning."
            : "Morning check-in reminders have been turned off.",
        });
      }
    } catch (error) {
      console.error("Failed to toggle morning check-in:", error);
    } finally {
      setTogglingMorning(false);
    }
  }

  async function handleEveningCheckinToggle(enabled: boolean) {
    setTogglingEvening(true);
    try {
      if (enabled && !permissionGranted) {
        const granted = await requestNotificationPermission();
        setPermissionGranted(granted);
        if (!granted) {
          toast({
            title: "Notifications disabled",
            description: "Please enable notifications in your device settings.",
            variant: "destructive",
          });
          setTogglingEvening(false);
          return;
        }
      }
      const success = await toggleEveningCheckin(enabled);
      if (success) {
        setEveningCheckinEnabled(enabled);
        toast({
          title: enabled ? "Evening check-in enabled" : "Evening check-in disabled",
          description: enabled
            ? "You'll receive a gentle reminder at 8:30pm to reflect on your day."
            : "Evening check-in reminders have been turned off.",
        });
      }
    } catch (error) {
      console.error("Failed to toggle evening check-in:", error);
    } finally {
      setTogglingEvening(false);
    }
  }

  async function handleAppointmentRemindersToggle(enabled: boolean) {
    setTogglingAppointments(true);
    try {
      if (enabled && !permissionGranted) {
        const granted = await requestNotificationPermission();
        setPermissionGranted(granted);
        if (!granted) {
          toast({
            title: "Notifications disabled",
            description: "Please enable notifications in your device settings.",
            variant: "destructive",
          });
          setTogglingAppointments(false);
          return;
        }
      }
      const success = await toggleAppointmentReminders(enabled);
      if (success) {
        setAppointmentRemindersEnabled(enabled);
        
        if (enabled && user) {
          await rescheduleAllAppointmentReminders(user.id);
        }
        
        toast({
          title: enabled ? "Appointment reminders enabled" : "Appointment reminders disabled",
          description: enabled
            ? "You'll be reminded before upcoming appointments."
            : "Appointment reminders have been turned off.",
        });
      }
    } catch (error) {
      console.error("Failed to toggle appointment reminders:", error);
    } finally {
      setTogglingAppointments(false);
    }
  }

  function handleReminderTimeChange(which: "first" | "second", value: number) {
    const newTimes = {
      ...reminderTimes,
      [which === "first" ? "firstReminder" : "secondReminder"]: value,
    };
    setReminderTimes(newTimes);
    setDefaultReminderTimes(newTimes);
    toast({
      title: "Reminder time updated",
      description: "New appointments will use this reminder time.",
    });
  }

  function handleTaskSuggestionsToggle(enabled: boolean) {
    setTaskSuggestionsEnabled(enabled);
    localStorage.setItem("bloom_show_task_suggestions", enabled ? "true" : "false");
    // Dispatch custom event for same-tab updates
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
    const sexToSave: BabySex = sexInput ?? "unknown";
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

  async function handleCreateInvite() {
    if (!user || isPartnerView) return;
    setInviteLoading(true);

    try {
      const token = generateInviteToken();
      const tokenHash = await hashToken(token);

      const { error } = await supabase
        .from("partner_access")
        .insert({
          mom_user_id: user.id,
          invite_token_hash: tokenHash,
        });

      if (error) throw error;

      setInviteToken(token);
      setHasExistingInvite(true);
      toast({ title: "Invite created", description: "Share this link with your partner." });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "Couldn't create invite." });
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRevokeAccess() {
    if (!user || isPartnerView) return;
    if (!window.confirm("This will remove your partner's access. Are you sure?")) return;

    setInviteLoading(true);
    try {
      const { error } = await supabase
        .from("partner_access")
        .update({ revoked_at: new Date().toISOString() })
        .eq("mom_user_id", user.id)
        .is("revoked_at", null);

      if (error) throw error;

      setInviteToken(null);
      setHasExistingInvite(false);
      await refreshPartnerAccess();
      toast({ title: "Access revoked", description: "Your partner no longer has access." });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "Couldn't revoke access." });
    } finally {
      setInviteLoading(false);
    }
  }

  function handleCopyInvite() {
    if (!inviteToken) return;
    const inviteUrl = buildInviteUrl(inviteToken);
    navigator.clipboard.writeText(inviteUrl);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
    toast({ title: "Link copied", description: "Share this link with your partner." });
  }

  async function handleDeleteAccount() {
    if (confirmText !== "DELETE" || !user) return;
    try {
      setDeleting(true);
      await deleteAccount();
    } catch (err) {
      console.error("Delete failed:", err);
      toast({ variant: "destructive", title: "Delete Failed", description: "Could not delete account." });
      setDeleting(false);
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

        {/* Notifications */}
        <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-muted/30 px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </h2>
            <p className="text-sm text-muted-foreground">Manage your reminder preferences.</p>
          </div>
          <div className="p-6 space-y-6">
            {/* Morning Check-in */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="text-sm font-medium">Morning check-in</label>
                <p className="text-xs text-muted-foreground">
                  {notificationsAvailable 
                    ? "\"How did you sleep?\" at 8:30am" 
                    : "Available on iOS and Android apps"
                  }
                </p>
              </div>
              <Switch
                checked={morningCheckinEnabled}
                onCheckedChange={handleMorningCheckinToggle}
                disabled={!notificationsAvailable || togglingMorning}
              />
            </div>

            {/* Evening Check-in - only for mom */}
            {!isPartnerView && (
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Evening check-in</label>
                  <p className="text-xs text-muted-foreground">
                    {notificationsAvailable 
                      ? "\"How was your day?\" at 8:30pm" 
                      : "Available on iOS and Android apps"
                    }
                  </p>
                </div>
                <Switch
                  checked={eveningCheckinEnabled}
                  onCheckedChange={handleEveningCheckinToggle}
                  disabled={!notificationsAvailable || togglingEvening}
                />
              </div>
            )}

            {/* Appointment Reminders */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Appointment reminders
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {notificationsAvailable 
                      ? "Get reminded before upcoming appointments" 
                      : "Available on iOS and Android apps"
                    }
                  </p>
                </div>
                <Switch
                  checked={appointmentRemindersEnabled}
                  onCheckedChange={handleAppointmentRemindersToggle}
                  disabled={!notificationsAvailable || togglingAppointments}
                />
              </div>

              {appointmentRemindersEnabled && notificationsAvailable && (
                <div className="space-y-4 pl-6 border-l-2 border-primary/20 ml-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      First reminder
                    </label>
                    <select
                      value={reminderTimes.firstReminder}
                      onChange={(e) => handleReminderTimeChange("first", Number(e.target.value))}
                      className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
                    >
                      {REMINDER_TIME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Second reminder
                    </label>
                    <select
                      value={reminderTimes.secondReminder}
                      onChange={(e) => handleReminderTimeChange("second", Number(e.target.value))}
                      className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
                    >
                      {REMINDER_TIME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    These defaults apply to new appointments. You can customize each appointment individually.
                  </p>
                </div>
              )}
            </div>

            {!permissionGranted && notificationsAvailable && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Notification permission not granted. Enable a toggle above to request permission.
              </p>
            )}
          </div>
        </section>

        {/* To-Do List Settings - Premium feature */}
        {!isPartnerView && (
          <PremiumLock 
            isPaid={isPaid} 
            message="Personalized task suggestions"
          >
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

        {/* Partner Access - only for mom, Premium feature */}
        {!isPartnerView && (
          <PremiumLock 
            isPaid={isPaid} 
            message="Share this experience with your partner"
          >
            <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="bg-muted/30 px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Partner Access
                </h2>
                <p className="text-sm text-muted-foreground">
                  Invite your partner to view your pregnancy journey.
                </p>
              </div>
              <div className="p-6 space-y-4">
                {inviteToken ? (
                  <>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <Link2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">Invite link ready!</p>
                        <p className="text-xs text-green-600 dark:text-green-400 truncate">
                          {buildInviteUrl(inviteToken)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleCopyInvite} className="shrink-0">
                        {copiedInvite ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        <strong>Important:</strong> Copy this link now. For security, you won't be able to see it again.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopyInvite} className="flex-1">
                        {copiedInvite ? "Copied!" : "Copy invite link"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleRevokeAccess} disabled={inviteLoading} className="text-destructive hover:text-destructive">
                        Revoke
                      </Button>
                    </div>
                  </>
                ) : hasExistingInvite || hasActivePartner ? (
                  <>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                      <Users className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {hasActivePartner ? "Partner connected" : "Invite pending"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {hasActivePartner 
                            ? "Your partner can view your pregnancy updates."
                            : "Waiting for your partner to accept the invite."
                          }
                        </p>
                      </div>
                    </div>

                    <Button variant="outline" size="sm" onClick={handleRevokeAccess} disabled={inviteLoading} className="w-full text-destructive hover:text-destructive">
                      {inviteLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Revoking...</> : "Revoke partner access"}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Your partner will be able to see your baby's progress, upcoming appointments, and ways they can support you. They won't see your journal entries, symptoms, or private notes.
                    </p>
                    <Button onClick={handleCreateInvite} disabled={inviteLoading} className="w-full">
                      {inviteLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : <><Users className="w-4 h-4 mr-2" />Create partner invite</>}
                    </Button>
                  </>
                )}
              </div>
            </section>
          </PremiumLock>
        )}

        {/* Pregnancy Details - only for mom */}
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
                <div className="flex gap-4">
                  <label className={cn(
                    "flex-1 flex items-center justify-center gap-2 cursor-pointer border rounded-md px-4 py-3 transition-all",
                    sexInput === "boy" ? "bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300" : "hover:bg-muted"
                  )}>
                    <input type="radio" name="sex" checked={sexInput === "boy"} onChange={() => setSexInput("boy")} className="sr-only" />
                    <span>Boy</span>
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
            </div>
          </section>
        )}

        {/* Parent Names - only for mom */}
        {!isPartnerView && (
          <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-muted/30 px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">Parents</h2>
              <p className="text-sm text-muted-foreground">Optional. Displayed on your home screen.</p>
            </div>
            <div className="p-6 grid gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Mom&apos;s Name</label>
                <Input value={momInput} onChange={(e) => setMomInput(e.target.value)} placeholder="e.g. Sarah" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Partner&apos;s Name</label>
                <Input value={partnerInput} onChange={(e) => setPartnerInput(e.target.value)} placeholder="e.g. Alex" />
              </div>
            </div>
            <div className="bg-muted/30 px-6 py-4 border-t border-border flex justify-end">
              <Button onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
              </Button>
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

        {/* Legal Section */}
        <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              Legal
            </h2>
          </div>
          <div className="divide-y divide-border">
            <button
              type="button"
              onClick={() => window.open('/privacy.html', '_blank')}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors text-left"
            >
              <span className="text-sm">Privacy Policy</span>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => window.open('/terms.html', '_blank')}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors text-left"
            >
              <span className="text-sm">Terms of Service</span>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="border border-destructive/30 rounded-xl overflow-hidden">
          <div className="bg-destructive/5 px-6 py-4 border-b border-destructive/20">
            <h2 className="text-lg font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                You are currently signed in as <span className="font-mono text-foreground font-medium">{email}</span>.
              </p>
              <p className="text-sm text-muted-foreground">
                To permanently delete your account, type <span className="font-bold text-destructive">DELETE</span> below.
              </p>
            </div>
            <div className="flex gap-4">
              <Input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type DELETE to confirm" className="max-w-[200px]" />
              <Button variant="destructive" disabled={confirmText !== "DELETE" || deleting} onClick={handleDeleteAccount}>
                {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : <><Trash2 className="mr-2 h-4 w-4" />Delete Account</>}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}