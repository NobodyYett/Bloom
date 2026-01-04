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
  Users, Copy, Check, Link2 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme, type ThemeMode } from "@/theme/theme-provider";
import {
  generateInviteToken,
  hashToken,
  buildInviteUrl,
} from "@/lib/partnerInvite";
import {
  isNotificationsSupported,
  isNightReminderEnabled,
  toggleNightReminder,
  isMorningGuidanceEnabled,
  toggleMorningGuidance,
  hasNotificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications";

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
  // We store the RAW token in state (for display) but only the HASH goes to DB
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [hasExistingInvite, setHasExistingInvite] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Notification state
  const [nightReminderEnabled, setNightReminderEnabled] = useState(false);
  const [morningGuidanceEnabled, setMorningGuidanceEnabled] = useState(false);
  const [notificationsAvailable, setNotificationsAvailable] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [togglingNight, setTogglingNight] = useState(false);
  const [togglingMorning, setTogglingMorning] = useState(false);

  const email = user?.email ?? "Unknown";

  useEffect(() => {
    async function checkNotifications() {
      const supported = isNotificationsSupported();
      setNotificationsAvailable(supported);
      if (supported) {
        const hasPermission = await hasNotificationPermission();
        setPermissionGranted(hasPermission);
        setNightReminderEnabled(isNightReminderEnabled());
        setMorningGuidanceEnabled(isMorningGuidanceEnabled());
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

  // Check if mom has an existing (non-revoked) invite
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

  async function handleNightReminderToggle(enabled: boolean) {
    setTogglingNight(true);
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
          setTogglingNight(false);
          return;
        }
      }
      const success = await toggleNightReminder(enabled);
      if (success) {
        setNightReminderEnabled(enabled);
        toast({
          title: enabled ? "Evening reminder enabled" : "Evening reminder disabled",
          description: enabled
            ? "You'll receive a gentle reminder at 8:30pm each evening."
            : "Evening reminders have been turned off.",
        });
      }
    } catch (error) {
      console.error("Failed to toggle night reminder:", error);
    } finally {
      setTogglingNight(false);
    }
  }

  async function handleMorningGuidanceToggle(enabled: boolean) {
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
      const success = await toggleMorningGuidance(enabled);
      if (success) {
        setMorningGuidanceEnabled(enabled);
        toast({
          title: enabled ? "Morning guidance enabled" : "Morning guidance disabled",
          description: enabled
            ? "You'll receive a gentle morning message at 8:30am."
            : "Morning guidance has been turned off.",
        });
      }
    } catch (error) {
      console.error("Failed to toggle morning guidance:", error);
    } finally {
      setTogglingMorning(false);
    }
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
      // Generate a secure random token
      const token = generateInviteToken();
      
      // Hash it - only the hash goes to the database
      const tokenHash = await hashToken(token);

      const { error } = await supabase
        .from("partner_access")
        .insert({
          mom_user_id: user.id,
          invite_token_hash: tokenHash,
        });

      if (error) throw error;

      // Store the raw token in state for display (never saved to DB)
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
      // Revoke ALL active invites for this mom
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
            <p className="text-sm text-muted-foreground">Choose how Bump Planner looks to you.</p>
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

        {/* Notifications - available for both mom and partner */}
        <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-muted/30 px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </h2>
            <p className="text-sm text-muted-foreground">Manage your reminder preferences.</p>
          </div>
          <div className="p-6 space-y-6">
            {/* Morning Guidance */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {isPartnerView ? "Appointment reminders" : "Morning guidance"}
                </label>
                <p className="text-xs text-muted-foreground">
                  {notificationsAvailable 
                    ? isPartnerView 
                      ? "Get reminded about upcoming appointments"
                      : "A gentle message at 8:30am to start your day" 
                    : "Available on iOS and Android apps"
                  }
                </p>
              </div>
              <Switch
                checked={morningGuidanceEnabled}
                onCheckedChange={handleMorningGuidanceToggle}
                disabled={!notificationsAvailable || togglingMorning}
              />
            </div>

            {/* Evening Reminder - only for mom */}
            {!isPartnerView && (
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Evening check-in reminder</label>
                  <p className="text-xs text-muted-foreground">
                    {notificationsAvailable ? "A gentle reminder at 8:30pm to check in" : "Available on iOS and Android apps"}
                  </p>
                </div>
                <Switch
                  checked={nightReminderEnabled}
                  onCheckedChange={handleNightReminderToggle}
                  disabled={!notificationsAvailable || togglingNight}
                />
              </div>
            )}

            {!permissionGranted && notificationsAvailable && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Notification permission not granted. Enable a toggle above to request permission.
              </p>
            )}
          </div>
        </section>

        {/* Partner Access - only for mom */}
        {!isPartnerView && (
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
                // Just created an invite - show the link
                <>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <Link2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">Invite link ready!</p>
                      <p className="text-xs text-green-600 dark:text-green-400 truncate">
                        {buildInviteUrl(inviteToken)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyInvite}
                      className="shrink-0"
                    >
                      {copiedInvite ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>Important:</strong> Copy this link now. For security, you won't be able to see it again.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyInvite}
                      className="flex-1"
                    >
                      {copiedInvite ? "Copied!" : "Copy invite link"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRevokeAccess}
                      disabled={inviteLoading}
                      className="text-destructive hover:text-destructive"
                    >
                      Revoke
                    </Button>
                  </div>
                </>
              ) : hasExistingInvite || hasActivePartner ? (
                // Has an existing invite (but we don't have the token) or active partner
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

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRevokeAccess}
                    disabled={inviteLoading}
                    className="w-full text-destructive hover:text-destructive"
                  >
                    {inviteLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Revoking...</>
                    ) : (
                      "Revoke partner access"
                    )}
                  </Button>
                </>
              ) : (
                // No invite yet
                <>
                  <p className="text-sm text-muted-foreground">
                    Your partner will be able to see your baby's progress, upcoming appointments, and ways they can support you. They won't see your journal entries, symptoms, or private notes.
                  </p>
                  <Button
                    onClick={handleCreateInvite}
                    disabled={inviteLoading}
                    className="w-full"
                  >
                    {inviteLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>
                    ) : (
                      <><Users className="w-4 h-4 mr-2" />Create partner invite</>
                    )}
                  </Button>
                </>
              )}
            </div>
          </section>
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
                  <label
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 cursor-pointer border rounded-md px-4 py-3 transition-all",
                      sexInput === "boy"
                        ? "bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300"
                        : "hover:bg-muted"
                    )}
                  >
                    <input type="radio" name="sex" checked={sexInput === "boy"} onChange={() => setSexInput("boy")} className="sr-only" />
                    <span>Boy</span>
                  </label>
                  <label
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 cursor-pointer border rounded-md px-4 py-3 transition-all",
                      sexInput === "girl"
                        ? "bg-pink-50 border-pink-200 text-pink-700 ring-1 ring-pink-200 dark:bg-pink-950 dark:border-pink-800 dark:text-pink-300"
                        : "hover:bg-muted"
                    )}
                  >
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

        {/* Partner info section - only shown to partners */}
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
              <Input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="max-w-[200px]"
              />
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