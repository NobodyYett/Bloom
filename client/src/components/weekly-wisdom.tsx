import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMomTip } from "@/lib/pregnancy-data";
import { getInfancyMomTip, getInfancyPartnerTip, getInfantWeekData } from "@/lib/infancy-data";
import { Info, Loader2 } from "lucide-react";
import {
  canAskAi,
  incrementAiCount,
  getRemainingAiQuestions,
  getAiDailyLimit,
} from "@/lib/aiLimits";
import { useFeedingInsights, getFeedingContextForAI } from "@/hooks/useFeedingInsights";
import { usePremium } from "@/contexts/PremiumContext";

export interface CheckinContext {
  slot?: string;
  mood?: "happy" | "neutral" | "sad" | null;
  symptoms?: string[];
  notes?: string;
}

interface WeeklyWisdomProps {
  currentWeek: number;
  trimester: 1 | 2 | 3;
  checkinContext?: CheckinContext | null;
  appMode?: "pregnancy" | "infancy";
  isPartnerView?: boolean;
}

export function WeeklyWisdom({ 
  currentWeek, 
  trimester, 
  checkinContext, 
  appMode = "pregnancy",
  isPartnerView = false 
}: WeeklyWisdomProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Get household-level premium (uses mom's premium in partner view)
  const { effectiveIsPremium } = usePremium();
  const isPaid = effectiveIsPremium;
  const [remaining, setRemaining] = useState(() => getRemainingAiQuestions(isPaid));

  // Sync remaining questions when premium status changes (e.g., after purchase or context loads)
  useEffect(() => {
    setRemaining(getRemainingAiQuestions(isPaid));
  }, [isPaid]);

  // Get baby insights for infancy mode (to include in AI context)
  const { data: feedingInsights } = useFeedingInsights();

  // Get appropriate content based on mode and viewer
  const isInfancy = appMode === "infancy";
  
  // Infant data (shared between both parents)
  const infantWeekData = isInfancy ? getInfantWeekData(currentWeek) : null;
  
  // Personal tip (viewer-specific)
  const personalTip = isInfancy
    ? (isPartnerView ? getInfancyPartnerTip(currentWeek) : getInfancyMomTip(currentWeek))
    : getMomTip(currentWeek);
    
  const limitReached = !canAskAi(isPaid);
  const dailyLimit = getAiDailyLimit(isPaid);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    // Check AI limits
    if (!canAskAi(isPaid)) {
      setErrorMsg("You've reached today's question limit.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setAnswer(null);

    // Build context-aware prompt based on mode
    const contextParts: string[] = [];
    
    if (appMode === "infancy") {
      contextParts.push(`The user has a ${currentWeek}-week-old baby.`);
      
      // Add feeding/nap insights for infancy mode
      if (feedingInsights) {
        const feedingContext = getFeedingContextForAI(feedingInsights);
        if (feedingContext) {
          contextParts.push(feedingContext);
        }
      }
    } else {
      contextParts.push(`The user is in week ${currentWeek} of their pregnancy (trimester ${trimester}).`);
    }

    if (checkinContext) {
      if (checkinContext.slot) {
        contextParts.push(`Their most recent check-in was for ${checkinContext.slot}.`);
      }
      if (checkinContext.mood) {
        const moodText =
          checkinContext.mood === "happy"
            ? "great"
            : checkinContext.mood === "neutral"
              ? "okay"
              : "not so good";
        contextParts.push(`They're feeling ${moodText} today.`);
      }
      if (checkinContext.symptoms && checkinContext.symptoms.length > 0) {
        contextParts.push(`They're experiencing: ${checkinContext.symptoms.join(", ")}.`);
      }
      if (checkinContext.notes) {
        const noteSnippet =
          checkinContext.notes.length > 100
            ? checkinContext.notes.substring(0, 100) + "..."
            : checkinContext.notes;
        contextParts.push(`Additional notes: "${noteSnippet}"`);
      }
    }

    const weekContext = appMode === "infancy" 
      ? `week ${currentWeek} of baby's life`
      : `week ${currentWeek} of pregnancy`;

    const enhancedPrompt = `
${contextParts.join(" ")}

User's question: ${question}

Please respond in this exact structure:
1. **What's commonly normal:** Brief reassurance about whether this is typical for ${weekContext} and the described symptoms/feelings
2. **What to try today:** 2-3 practical, gentle suggestions
3. **When to contact your provider:** Clear signs that warrant a call (non-alarmist)
4. **One clarifying question:** (optional) If helpful, ask one follow-up

Keep your tone warm, supportive, and calm. Avoid medical jargon.
`.trim();

    const { data, error } = await supabase.functions.invoke("ask-ivy", {
      body: { question: enhancedPrompt, week: currentWeek, trimester },
    });

    setLoading(false);

    if (error) {
      console.error(error);
      setErrorMsg("Ivy couldn't answer right now. Please try again in a moment.");
      return;
    }

    // Increment usage count on success
    incrementAiCount();
    setRemaining(getRemainingAiQuestions(isPaid));

    setAnswer(data?.answer ?? "Ivy answered, but something looked empty.");
  }

  const subtitleText = appMode === "infancy"
    ? "A quick check-in for new parents this week."
    : "A quick check-in just for you this week.";

  const placeholderText = appMode === "infancy"
    ? "Is this normal for my baby? What can I try?"
    : "Is this normal? What can I try?";

  return (
    <section className="bg-secondary/40 rounded-3xl border border-border/60 px-6 py-6 md:px-10 md:py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="font-serif text-xl md:text-2xl font-semibold text-foreground">
            Weekly Wisdom
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            {subtitleText}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-border/50 px-3 py-1 text-[10px] font-medium text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Powered by Ivy
        </span>
      </div>

      {/* Content section */}
      {isInfancy && infantWeekData ? (
        <div className="space-y-3 mb-4">
          {/* Baby insight - shared, both parents see this */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Your Baby This Week
            </p>
            <p className="text-sm md:text-base text-foreground leading-relaxed">
              {infantWeekData.babyInsight}
            </p>
          </div>
        </div>
      ) : (
        /* Pregnancy mode - single tip */
        <p className="text-sm md:text-base text-foreground leading-relaxed mb-4">
          {personalTip}
        </p>
      )}

      {/* Ask Ivy input */}
      <form
        onSubmit={handleAsk}
        className="mt-2 flex flex-col gap-3 border-t border-border/60 pt-4"
      >
        <p className="text-[11px] text-muted-foreground">
          {appMode === "infancy" 
            ? "Questions about your baby, how you're adjusting, or what to expect? Ask Ivy below."
            : "Questions about this week, how you're feeling, or what to expect? Ask Ivy below."}
        </p>

        <div className="flex flex-col md:flex-row gap-2">
          <Input
            placeholder={placeholderText}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="flex-1 text-sm text-foreground placeholder:text-muted-foreground"
            disabled={limitReached}
          />
          <Button
            type="submit"
            disabled={loading || limitReached || !question.trim()}
            className="md:w-28 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Thinking
              </>
            ) : (
              "Ask Ivy"
            )}
          </Button>
        </div>

        {/* Usage indicator */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">
            {remaining} of {dailyLimit} question{dailyLimit !== 1 ? "s" : ""} remaining today
          </span>
          {!isPaid && remaining === 0 && (
            <Button variant="link" size="sm" className="text-foreground p-0 h-auto text-[11px]">
              Upgrade for more
            </Button>
          )}
        </div>

        {/* Subtle disclaimer */}
        <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
          <Info className="w-3 h-3 shrink-0 mt-0.5" />
          <p>
            Ivy is here to support you — not replace medical care. If something feels urgent, contact your provider or emergency services.
          </p>
        </div>
      </form>

      {/* Limit reached message */}
      {limitReached && (
        <div className="mt-3 text-center py-3 rounded-xl bg-muted border border-border">
          <p className="text-sm text-foreground">You've reached today's question limit.</p>
          {!isPaid && (
            <p className="text-xs text-muted-foreground mt-1">
              <Button variant="link" className="text-foreground p-0 h-auto text-xs">
                Upgrade to Premium
              </Button>{" "}
              for 5 questions per day.
            </p>
          )}
        </div>
      )}

      {errorMsg && (
        <p className="mt-2 text-xs text-destructive">{errorMsg}</p>
      )}

      {answer && (
        <div className="mt-3 rounded-2xl bg-muted border border-border px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Ivy's reply
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {answer}
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Ivy shares general education & emotional support only. For anything medical or urgent, please contact your healthcare provider.
          </p>
        </div>
      )}
    </section>
  );
}