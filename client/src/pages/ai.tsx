// client/src/pages/ai.tsx

import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePregnancyState } from "@/hooks/usePregnancyState";
import { usePartnerAccess } from "@/contexts/PartnerContext";
import { supabase } from "@/lib/supabase";
import { Loader2, Sparkles, Info, Lock } from "lucide-react";
import {
  canAskAi,
  incrementAiCount,
  getRemainingAiQuestions,
  getAiDailyLimit,
} from "@/lib/aiLimits";

export default function AiPage() {
  const { dueDate, setDueDate, currentWeek, momName } = usePregnancyState();
  const { isPartnerView } = usePartnerAccess();
  const searchString = useSearch();
  
  const params = new URLSearchParams(searchString);
  const prefillMood = params.get("mood");
  const prefillSymptoms = params.get("symptoms");
  const prefillSlot = params.get("slot");
  const prefillNotes = params.get("notes");
  const prefillWeek = params.get("week") || String(currentWeek);

  const isPaid = false; // TODO: Replace with actual subscription check

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(() => getRemainingAiQuestions(isPaid));

  useEffect(() => {
    if (isPartnerView) return; // Don't prefill for partners
    
    if (prefillMood || prefillSymptoms) {
      const parts: string[] = [];
      parts.push(`I'm currently in week ${prefillWeek} of my pregnancy.`);
      if (prefillSlot) parts.push(`This is my ${prefillSlot} check-in.`);
      if (prefillMood) {
        const moodText = prefillMood === "happy" ? "great" : prefillMood === "neutral" ? "okay" : "not so good";
        parts.push(`I'm feeling ${moodText} today.`);
      }
      if (prefillSymptoms) parts.push(`I'm experiencing: ${prefillSymptoms}.`);
      if (prefillNotes) parts.push(`Additional notes: ${prefillNotes}`);
      parts.push("\nIs this normal? What can I try today? When should I contact my provider?");
      setQuestion(parts.join(" "));
    }
  }, [prefillMood, prefillSymptoms, prefillSlot, prefillNotes, prefillWeek, isPartnerView]);

  // Block partner access
  if (isPartnerView) {
    return (
      <Layout dueDate={dueDate} setDueDate={setDueDate}>
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <section className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
              <Lock className="w-10 h-10 text-muted-foreground" />
            </div>
            <h1 className="font-serif text-3xl font-bold mb-3">
              FLO is for {momName || "Mom"}
            </h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              FLO provides personalized pregnancy support and is only available to {momName || "the expecting parent"}.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Check out the home page for ways you can support this week.
            </p>
          </section>
        </div>
      </Layout>
    );
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    if (!canAskAi(isPaid)) {
      setErrorMsg("You've reached today's question limit.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setAnswer(null);

    const enhancedPrompt = `
The user is in week ${currentWeek} of their pregnancy and has a question.

User's question: ${question}

Please respond in this exact structure:
1. **What's commonly normal:** Brief reassurance about whether this is typical
2. **What to try today:** 2-3 practical, gentle suggestions
3. **When to contact your provider:** Clear signs that warrant a call
4. **One clarifying question:** (optional) If helpful, ask one follow-up

Keep your tone warm, supportive, and calm. Avoid medical jargon.
`.trim();

    const { data, error } = await supabase.functions.invoke("ask-flo", {
      body: { question: enhancedPrompt },
    });

    setLoading(false);

    if (error) {
      console.error(error);
      setErrorMsg("FLO couldn't answer right now. Please try again in a moment.");
      return;
    }

    incrementAiCount();
    setRemaining(getRemainingAiQuestions(isPaid));
    setAnswer(data?.answer ?? "FLO answered, but something looked empty.");
  }

  const limitReached = !canAskAi(isPaid);
  const dailyLimit = getAiDailyLimit(isPaid);

  return (
    <Layout dueDate={dueDate} setDueDate={setDueDate}>
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold">Ask FLO</h1>
          <p className="text-muted-foreground">Your gentle companion for pregnancy questions</p>
        </header>

        <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
          <form onSubmit={handleAsk} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">What would you like to ask?</label>
              <Textarea
                placeholder="Example: Is it normal to feel more tired this week?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={4}
                className="resize-none"
                disabled={limitReached}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {remaining} of {dailyLimit} question{dailyLimit !== 1 ? "s" : ""} remaining today
              </span>
              {!isPaid && remaining === 0 && (
                <Button variant="link" size="sm" className="text-primary p-0 h-auto">
                  Upgrade for more
                </Button>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading || limitReached || !question.trim()}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />FLO is thinking...</>
              ) : limitReached ? (
                "You've reached today's limit"
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />Ask FLO</>
              )}
            </Button>

            {/* Subtle micro-disclaimer */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <p>FLO is here to support you — not replace medical care. If something feels urgent, contact your provider or emergency services.</p>
            </div>
          </form>

          {limitReached && (
            <div className="text-center py-4 space-y-2">
              <p className="text-sm text-muted-foreground">You've reached today's question limit.</p>
              {!isPaid && (
                <p className="text-sm">
                  <Button variant="link" className="text-primary p-0 h-auto">Upgrade to Premium</Button>
                  {" "}for 5 questions per day.
                </p>
              )}
            </div>
          )}

          {errorMsg && <p className="text-sm text-destructive text-center">{errorMsg}</p>}
        </div>

        {answer && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <span className="font-medium">FLO's Response</span>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</p>
            </div>
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                FLO provides general education and emotional support only. For anything medical or urgent, please contact your healthcare provider.
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}