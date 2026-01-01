// client/src/components/weekly-wisdom.tsx

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMomTip } from "@/lib/pregnancy-data";
import { Info, Loader2 } from "lucide-react";
import {
  canAskAi,
  incrementAiCount,
  getRemainingAiQuestions,
  getAiDailyLimit,
} from "@/lib/aiLimits";

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
}

export function WeeklyWisdom({ currentWeek, trimester, checkinContext }: WeeklyWisdomProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AI limits (TODO: replace with actual subscription check)
  const isPaid = false;
  const [remaining, setRemaining] = useState(() => getRemainingAiQuestions(isPaid));

  const momTip = getMomTip(currentWeek);
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

    // Build context-aware prompt (not shown to user)
    const contextParts: string[] = [];
    contextParts.push(`The user is in week ${currentWeek} of their pregnancy (trimester ${trimester}).`);

    if (checkinContext) {
      if (checkinContext.slot) {
        contextParts.push(`Their most recent check-in was for ${checkinContext.slot}.`);
      }
      if (checkinContext.mood) {
        const moodText = checkinContext.mood === "happy" ? "great" : checkinContext.mood === "neutral" ? "okay" : "not so good";
        contextParts.push(`They're feeling ${moodText} today.`);
      }
      if (checkinContext.symptoms && checkinContext.symptoms.length > 0) {
        contextParts.push(`They're experiencing: ${checkinContext.symptoms.join(", ")}.`);
      }
      if (checkinContext.notes) {
        const noteSnippet = checkinContext.notes.length > 100 
          ? checkinContext.notes.substring(0, 100) + "..." 
          : checkinContext.notes;
        contextParts.push(`Additional notes: "${noteSnippet}"`);
      }
    }

    const enhancedPrompt = `
${contextParts.join(" ")}

User's question: ${question}

Please respond in this exact structure:
1. **What's commonly normal:** Brief reassurance about whether this is typical for week ${currentWeek} and the described symptoms/feelings
2. **What to try today:** 2-3 practical, gentle suggestions
3. **When to contact your provider:** Clear signs that warrant a call (non-alarmist)
4. **One clarifying question:** (optional) If helpful, ask one follow-up

Keep your tone warm, supportive, and calm. Avoid medical jargon.
`.trim();

    const { data, error } = await supabase.functions.invoke("ask-flo", {
      body: { question: enhancedPrompt, week: currentWeek, trimester },
    });

    setLoading(false);

    if (error) {
      console.error(error);
      setErrorMsg("FLO couldn't answer right now. Please try again in a moment.");
      return;
    }

    // Increment usage count on success
    incrementAiCount();
    setRemaining(getRemainingAiQuestions(isPaid));

    setAnswer(data?.answer ?? "FLO answered, but something looked empty.");
  }

  return (
    <section className="bg-primary/10 rounded-3xl border border-primary/20 px-6 py-6 md:px-10 md:py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="font-serif text-xl md:text-2xl font-semibold text-primary">
            Weekly Wisdom
          </h2>
          <p className="text-[11px] text-primary/70 mt-1">
            A quick check-in just for you this week.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-[10px] font-medium text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Powered by FLO
        </span>
      </div>

      {/* Mom-focused tip text */}
      <p className="text-sm md:text-base text-primary/80 leading-relaxed mb-4">
        {momTip}
      </p>

      {/* Ask FLO input */}
      <form
        onSubmit={handleAsk}
        className="mt-2 flex flex-col gap-3 border-t border-primary/20 pt-4"
      >
        <p className="text-[11px] text-primary/80">
          Questions about this week, how you're feeling, or what to expect? Ask FLO below.
        </p>

        <div className="flex flex-col md:flex-row gap-2">
          <Input
            placeholder="Is this normal? What can I try?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="flex-1 text-sm"
            disabled={limitReached}
          />
          <Button
            type="submit"
            disabled={loading || limitReached || !question.trim()}
            className="md:w-28 shrink-0"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Thinking</>
            ) : (
              "Ask FLO"
            )}
          </Button>
        </div>

        {/* Usage indicator */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-primary/60">
            {remaining} of {dailyLimit} question{dailyLimit !== 1 ? "s" : ""} remaining today
          </span>
          {!isPaid && remaining === 0 && (
            <Button variant="link" size="sm" className="text-primary p-0 h-auto text-[11px]">
              Upgrade for more
            </Button>
          )}
        </div>

        {/* Subtle disclaimer */}
        <div className="flex items-start gap-1.5 text-[10px] text-primary/50">
          <Info className="w-3 h-3 shrink-0 mt-0.5" />
          <p>FLO is here to support you — not replace medical care. If something feels urgent, contact your provider or emergency services.</p>
        </div>
      </form>

      {/* Limit reached message */}
      {limitReached && (
        <div className="mt-3 text-center py-3 rounded-xl bg-primary/5 border border-primary/10">
          <p className="text-sm text-primary/70">You've reached today's question limit.</p>
          {!isPaid && (
            <p className="text-xs text-primary/60 mt-1">
              <Button variant="link" className="text-primary p-0 h-auto text-xs">Upgrade to Premium</Button>
              {" "}for 5 questions per day.
            </p>
          )}
        </div>
      )}

      {errorMsg && (
        <p className="mt-2 text-xs text-destructive">{errorMsg}</p>
      )}

      {answer && (
        <div className="mt-3 rounded-2xl bg-primary/5 border border-primary/20 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-primary/70 mb-1">
            FLO's reply
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {answer}
          </p>
          <p className="mt-2 text-[10px] text-primary/70">
            FLO shares general education & emotional support only. For anything
            medical or urgent, please contact your healthcare provider.
          </p>
        </div>
      )}
    </section>
  );
}