import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { usePregnancyState, type BabySex } from "@/hooks/usePregnancyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { Loader2, Save, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { user, deleteAccount } = useAuth();
  const { toast } = useToast();

  const {
    dueDate,
    setDueDate,
    babyName,
    setBabyName,
    babySex,
    setBabySex,
  } = usePregnancyState();

  // Local state for the form inputs
  const [nameInput, setNameInput] = useState("");
  const [dateInput, setDateInput] = useState(""); // "yyyy-MM-dd" or ""
  const [sexInput, setSexInput] = useState<"boy" | "girl" | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const email = user?.email ?? "Unknown";

  // Sync local state with global state on load
  useEffect(() => {
    setNameInput(babyName ?? "");
    setDateInput(dueDate ? format(new Date(dueDate), "yyyy-MM-dd") : "");

    // Convert global state ("unknown") to local state (null) for the UI
    setSexInput(
      babySex && babySex !== "unknown" ? (babySex as "boy" | "girl") : null,
    );
  }, [babyName, dueDate, babySex]);

  function parseDateInputToDate(value: string): Date | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // 1. SAVE PROFILE CHANGES
  async function handleSaveChanges() {
    if (!user) return;
    setIsSaving(true);

    // Convert local null back to "unknown" for the database/global state
    const sexToSave: BabySex = sexInput ?? "unknown";
    const parsedDueDate = parseDateInputToDate(dateInput);

    // Optional guardrail: sanity check due date window
    // Allows: up to 30 days past (late edits/post-birth) and up to ~44 weeks ahead
    if (parsedDueDate) {
      const daysFromToday = differenceInDays(parsedDueDate, new Date());
      if (daysFromToday < -30 || daysFromToday > 310) {
        setIsSaving(false);
        toast({
          variant: "destructive",
          title: "That date looks unusual",
          description: "Please double-check the due date before saving.",
        });
        return;
      }
    }

    try {
      const { error } = await supabase
        .from("pregnancy_profiles")
        .update({
          baby_name: nameInput.trim() || null,
          due_date: dateInput.trim() ? dateInput.trim() : null,
          baby_sex: sexToSave,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      // Update Global State
      setBabyName(nameInput.trim() || null);
      setDueDate(parsedDueDate); // prevents Invalid Date
      setBabySex(sexToSave);

      toast({
        title: "Settings Saved",
        description: "Your pregnancy details have been updated.",
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save changes. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  // 2. DELETE ACCOUNT (True Deletion)
  async function handleDeleteAccount() {
    if (confirmText !== "DELETE" || !user) return;

    try {
      setDeleting(true);
      await deleteAccount();
    } catch (err) {
      console.error("Delete failed:", err);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "Could not delete account. Check your connection.",
      });
      setDeleting(false);
    }
  }

  return (
    <Layout dueDate={dueDate} setDueDate={setDueDate}>
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
        <header className="space-y-2">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your pregnancy details and account preferences.
          </p>
        </header>

        <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-muted/30 px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Pregnancy Details
            </h2>
            <p className="text-sm text-muted-foreground">
              Update your info to recalculate your timeline.
            </p>
          </div>

          <div className="p-6 grid gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">
                Baby&apos;s Name
              </label>
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Oliver"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Due Date</label>
              <Input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">
                Baby&apos;s Sex
              </label>
              <div className="flex gap-4">
                <label
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 cursor-pointer border rounded-md px-4 py-3 transition-all",
                    sexInput === "boy"
                      ? "bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-200"
                      : "hover:bg-muted",
                  )}
                >
                  <input
                    type="radio"
                    name="sex"
                    checked={sexInput === "boy"}
                    onChange={() => setSexInput("boy")}
                    className="sr-only"
                  />
                  <span>Boy</span>
                </label>

                <label
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 cursor-pointer border rounded-md px-4 py-3 transition-all",
                    sexInput === "girl"
                      ? "bg-pink-50 border-pink-200 text-pink-700 ring-1 ring-pink-200"
                      : "hover:bg-muted",
                  )}
                >
                  <input
                    type="radio"
                    name="sex"
                    checked={sexInput === "girl"}
                    onChange={() => setSexInput("girl")}
                    className="sr-only"
                  />
                  <span>Girl</span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-muted/30 px-6 py-4 border-t border-border flex justify-end">
            <Button onClick={handleSaveChanges} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </section>

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
                You are currently signed in as{" "}
                <span className="font-mono text-foreground font-medium">
                  {email}
                </span>
                .
              </p>
              <p className="text-sm text-muted-foreground">
                To permanently delete your account and all data, type{" "}
                <span className="font-bold text-destructive">DELETE</span> below.
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
              <Button
                variant="destructive"
                disabled={confirmText !== "DELETE" || deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Account
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
