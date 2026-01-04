// client/src/components/partner-support-card.tsx

import { Heart, Coffee, Car, ShoppingBag, Moon, Utensils, Bath, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PartnerSupportCardProps {
  currentWeek: number;
  trimester: 1 | 2 | 3;
  momName?: string | null;
}

interface SupportTip {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function getTipsForWeek(week: number, trimester: 1 | 2 | 3, momName?: string | null): SupportTip[] {
  const name = momName || "her";
  
  // First trimester tips (weeks 1-13)
  if (trimester === 1) {
    return [
      {
        icon: <Utensils className="w-4 h-4" />,
        title: "Help with meals",
        description: `Nausea can make cooking tough. Offer to prepare bland, easy foods or pick up ${name}'s favorites.`,
      },
      {
        icon: <Coffee className="w-4 h-4" />,
        title: "Be patient with fatigue",
        description: `Growing a baby is exhausting. Let ${name} rest without guilt — even early bedtimes are normal.`,
      },
      {
        icon: <MessageCircle className="w-4 h-4" />,
        title: "Listen without fixing",
        description: `Emotions can be all over the place. Sometimes ${name} just needs you to listen, not solve.`,
      },
    ];
  }
  
  // Second trimester tips (weeks 14-27)
  if (trimester === 2) {
    return [
      {
        icon: <ShoppingBag className="w-4 h-4" />,
        title: "Help prepare the nursery",
        description: `This is a great time to start setting things up together. Offer to assemble furniture or paint.`,
      },
      {
        icon: <Car className="w-4 h-4" />,
        title: "Attend appointments",
        description: `If you can, join prenatal visits. It means a lot and helps you both feel connected to the journey.`,
      },
      {
        icon: <Heart className="w-4 h-4" />,
        title: "Compliment her",
        description: `Body changes can feel strange. Remind ${name} how amazing she looks and what she's accomplishing.`,
      },
    ];
  }
  
  // Third trimester tips (weeks 28-40)
  return [
    {
      icon: <Bath className="w-4 h-4" />,
      title: "Help with comfort",
      description: `Back rubs, foot massages, or running a warm bath can make a big difference right now.`,
      },
    {
      icon: <Moon className="w-4 h-4" />,
      title: "Support sleep",
      description: `Sleep gets harder. Help adjust pillows, keep the room cool, and be understanding of restless nights.`,
    },
    {
      icon: <ShoppingBag className="w-4 h-4" />,
      title: "Pack the hospital bag",
      description: `Make sure the bag is ready and you know the fastest route to the hospital or birth center.`,
    },
  ];
}

export function PartnerSupportCard({ currentWeek, trimester, momName }: PartnerSupportCardProps) {
  const tips = getTipsForWeek(currentWeek, trimester, momName);
  
  return (
    <section className="bg-card rounded-xl p-6 border border-border shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
          <Heart className="w-5 h-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <h2 className="font-serif text-lg font-semibold">How You Can Support This Week</h2>
          <p className="text-xs text-muted-foreground">
            Small gestures make a big difference
          </p>
        </div>
      </div>

      {/* Tips */}
      <div className="space-y-3">
        {tips.map((tip, index) => (
          <div
            key={index}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg",
              "bg-muted/50 border border-border/50"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0 mt-0.5">
              {tip.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{tip.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {tip.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Encouragement footer */}
      <p className="text-xs text-muted-foreground text-center mt-4 pt-4 border-t border-border">
        Being present and supportive is one of the best gifts you can give right now. 💙
      </p>
    </section>
  );
}