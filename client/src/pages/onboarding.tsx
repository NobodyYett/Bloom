// client/src/pages/onboarding.tsx

import { useState } from "react";
import { usePregnancyState } from "@/hooks/usePregnancyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase"; 
import { useAuth } from "@/hooks/useAuth"; 

// --- Helper Functions ---
function calculateDueFromLmp(lmp: string): string | null {
  if (!lmp) return null;
  const base = new Date(lmp);
  if (Number.isNaN(base.getTime())) return null;

  const due = new Date(base);
  due.setDate(due.getDate() + 280);

  const year = due.getFullYear();
  const month = String(due.getMonth() + 1).padStart(2, "0");
  const day = String(due.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatForInput(date: Date | null): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Onboarding() {
  const {
    dueDate,
    setDueDate,
    babyName,
    setBabyName,
    babySex,
    setBabySex,
    setIsOnboardingComplete, 
    refetch, 
  } = usePregnancyState(); 

  const { user } = useAuth();
  const { toast } = useToast();

  // Steps: 
  // 1 = Welcome + "Do you know your due date?"
  // 2a = Enter due date (if yes)
  // 2b = Calculate from LMP (if no but wants help)
  // 3 = Baby details (name, sex) - only if they have a due date
  // 4 = Final confirmation
  const [step, setStep] = useState(1);
  const [dueInput, setDueInput] = useState<string>(formatForInput(dueDate)); 
  const [lmpInput, setLmpInput] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmedDueDate, setConfirmedDueDate] = useState<Date | null>(null);

  function goToHome() {
    window.location.href = "/"; 
  }

  async function saveAndComplete(
    finalDate: Date | null,
    currentBabyName: string | null = null, 
    currentBabySex: "boy" | "girl" | "unknown" = "unknown"
  ) {
    if (!user) return;
    setIsSaving(true);
    
    const payload: { 
      due_date?: string | null; 
      onboarding_complete: boolean;
      baby_name: string | null;
      baby_sex: string;
    } = {
        onboarding_complete: true,
        baby_name: currentBabyName, 
        baby_sex: currentBabySex,
    };

    if (finalDate) {
        const year = finalDate.getFullYear();
        const month = String(finalDate.getMonth() + 1).padStart(2, "0");
        const day = String(finalDate.getDate()).padStart(2, "0");
        payload.due_date = `${year}-${month}-${day}`; 
    } else {
        payload.due_date = null;
    }
    
    const { error } = await supabase
      .from("pregnancy_profiles")
      .update(payload)
      .eq("user_id", user.id);
      
    setIsSaving(false);

    if (error) {
      console.error("Failed to complete onboarding:", error);
      toast({
        title: "Error saving profile",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }

    setIsOnboardingComplete(true); 
    
    if (refetch) {
      refetch();
    }
    
    goToHome();
  }

  // Step 1: User knows due date -> go to step 2a
  function handleYesKnowDueDate() {
    setStep(2);
  }

  // Step 1: User doesn't know due date -> ask if they want to calculate
  function handleNoKnowDueDate() {
    setStep(2.5); // Intermediate step: offer calculation
  }

  // Step 2.5: User wants to calculate from LMP
  function handleWantToCalculate() {
    setStep(2.1); // Go to LMP input
  }

  // Step 2.5: User doesn't want to calculate -> skip to home
  async function handleSkipEverything() {
    await saveAndComplete(null, null, "unknown");
  }

  // Step 2a: User entered due date -> validate and go to baby details
  function handleDueDateContinue() {
    if (!dueInput) {
      toast({
        title: "Please enter a due date",
        variant: "destructive",
      });
      return;
    }
    
    const finalDate = new Date(dueInput);
    if (Number.isNaN(finalDate.getTime())) {
      toast({
        title: "Invalid date",
        description: "Please choose a valid due date.",
        variant: "destructive",
      });
      return;
    }
    
    setConfirmedDueDate(finalDate);
    setDueDate(finalDate);
    setStep(3); // Go to baby details
  }

  // Step 2b: User entered LMP -> calculate and go to baby details
  function handleLmpContinue() {
    if (!lmpInput) {
      toast({
        title: "Please enter the date of your last period",
        variant: "destructive",
      });
      return;
    }

    const calculated = calculateDueFromLmp(lmpInput);
    if (!calculated) {
      toast({
        title: "Couldn't calculate due date",
        description: "Please check the date and try again.",
        variant: "destructive",
      });
      return;
    }

    const finalDate = new Date(calculated);
    setConfirmedDueDate(finalDate);
    setDueDate(finalDate);
    setDueInput(calculated);
    setStep(3); // Go to baby details
  }

  // Step 3: Final save with all details
  async function handleFinalContinue() {
    await saveAndComplete(confirmedDueDate, babyName, babySex);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card/80 backdrop-blur p-8 shadow-lg space-y-6">
        
        {/* STEP 1: Welcome + Do you know your due date? */}
        {step === 1 && (
          <>
            <div className="text-center space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Welcome to
              </p>
              <h1 className="text-3xl font-serif font-semibold tracking-tight">
                Bump Planner
              </h1>
              <p className="text-sm text-muted-foreground">
                Thank you for joining! We're excited to be part of your pregnancy journey.
              </p>
            </div>

            <div className="pt-4 space-y-4">
              <p className="text-center font-medium">
                Do you know your due date?
              </p>
              <div className="flex gap-3">
                <Button 
                  className="flex-1" 
                  onClick={handleYesKnowDueDate}
                >
                  Yes, I do
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={handleNoKnowDueDate}
                >
                  Not yet
                </Button>
              </div>
            </div>
          </>
        )}

        {/* STEP 2.5: Offer to calculate */}
        {step === 2.5 && (
          <>
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-serif font-semibold">
                No problem!
              </h2>
              <p className="text-sm text-muted-foreground">
                Would you like us to help estimate your due date based on your last menstrual period?
              </p>
            </div>

            <div className="pt-4 space-y-3">
              <Button 
                className="w-full" 
                onClick={handleWantToCalculate}
              >
                Yes, help me calculate
              </Button>
              <Button 
                variant="ghost" 
                className="w-full text-sm"
                onClick={handleSkipEverything}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Skip for now — I'll add it later"}
              </Button>
            </div>
          </>
        )}

        {/* STEP 2a: Enter due date */}
        {step === 2 && (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-serif font-semibold">
                When is your due date?
              </h2>
              <p className="text-sm text-muted-foreground">
                Don't worry if it's not exact — you can update it anytime.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="due">Expected due date</Label>
                <Input
                  id="due"
                  type="date"
                  value={dueInput}
                  onChange={(e) => setDueInput(e.target.value)}
                />
              </div>
              
              <Button 
                className="w-full" 
                onClick={handleDueDateContinue}
              >
                Continue
              </Button>
              
              <Button 
                variant="ghost" 
                className="w-full text-xs"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
            </div>
          </>
        )}

        {/* STEP 2.1: Calculate from LMP */}
        {step === 2.1 && (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-serif font-semibold">
                Let's calculate it
              </h2>
              <p className="text-sm text-muted-foreground">
                Enter the first day of your last menstrual period and we'll estimate your due date.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lmp">First day of last period</Label>
                <Input
                  id="lmp"
                  type="date"
                  value={lmpInput}
                  onChange={(e) => setLmpInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  We'll add 280 days (40 weeks) to estimate your due date.
                </p>
              </div>
              
              <Button 
                className="w-full" 
                onClick={handleLmpContinue}
              >
                Calculate & Continue
              </Button>
              
              <Button 
                variant="ghost" 
                className="w-full text-xs"
                onClick={() => setStep(2.5)}
              >
                Back
              </Button>
            </div>
          </>
        )}

        {/* STEP 3: Baby details */}
        {step === 3 && (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-serif font-semibold">
                A few more details
              </h2>
              <p className="text-sm text-muted-foreground">
                These are optional — feel free to skip or update later.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="babyName">Baby's nickname (optional)</Label>
                <Input
                  id="babyName"
                  type="text"
                  placeholder="e.g., Peanut, Bean, or a name you're considering"
                  value={babyName ?? ""}
                  onChange={(e) => setBabyName(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label>Do you know the sex? (optional)</Label>
                <div className="flex gap-2">
                  {[
                    { value: "boy", label: "Boy" },
                    { value: "girl", label: "Girl" },
                    { value: "unknown", label: "Don't know yet" },
                  ].map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={babySex === opt.value ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setBabySex(opt.value as "boy" | "girl" | "unknown")}
                      disabled={isSaving}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                💡 You can add appointments later from the Appointments tab.
              </div>
              
              <Button 
                className="w-full" 
                onClick={handleFinalContinue}
                disabled={isSaving}
              >
                {isSaving ? "Finishing up..." : "Let's get started!"}
              </Button>
              
              <Button 
                variant="ghost" 
                className="w-full text-xs"
                onClick={() => setStep(2)}
                disabled={isSaving}
              >
                Back to change due date
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}