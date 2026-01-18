// client/src/hooks/useFeedingNotifications.ts
// Real-time notifications for feeding logs and reminders

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerAccess } from "@/contexts/PartnerContext";
import { useToast } from "@/hooks/use-toast";
import { useFeedingInsights, formatMinutesToReadable } from "@/hooks/useFeedingInsights";
import { useQueryClient } from "@tanstack/react-query";
import { getFeedingEmoji } from "@/hooks/useFeedingLogs";

interface FeedingNotificationOptions {
  enabled?: boolean;
  reminderEnabled?: boolean;
}

export function useFeedingNotifications(options: FeedingNotificationOptions = {}) {
  const { enabled = true, reminderEnabled = true } = options;
  
  const { user } = useAuth();
  const { isPartnerView, momUserId } = usePartnerAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: insights, refetch: refetchInsights } = useFeedingInsights();
  
  // The user_id we're watching (mom's ID for both mom and partner)
  const targetUserId = isPartnerView ? momUserId : user?.id;
  
  // Track reminder timeout
  const reminderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastReminderRef = useRef<number>(0);
  
  // Request browser notification permission
  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    
    const result = await Notification.requestPermission();
    return result === "granted";
  }, []);
  
  // Send browser notification (only if tab not focused)
  const sendBrowserNotification = useCallback((title: string, body: string) => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (document.hasFocus()) return; // Don't notify if app is focused
    
    try {
      new Notification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "bloom-feeding",
      });
    } catch (e) {
      console.warn("Browser notification failed:", e);
    }
  }, []);
  
  // Schedule feeding reminder
  const scheduleReminder = useCallback(() => {
    if (!reminderEnabled) return;
    if (!insights?.lastFeedingAt || insights?.suggestedNextFeedingIn === null) return;
    
    // Clear existing reminder
    if (reminderTimeoutRef.current) {
      clearTimeout(reminderTimeoutRef.current);
      reminderTimeoutRef.current = null;
    }
    
    // Don't remind more than once per hour for the same feeding
    const now = Date.now();
    if (now - lastReminderRef.current < 60 * 60 * 1000) return;
    
    // Schedule reminder for 5 minutes before suggested feeding time
    const reminderInMinutes = insights.suggestedNextFeedingIn - 5;
    
    if (reminderInMinutes > 0 && reminderInMinutes < 180) {
      // Schedule reminder (convert to ms)
      reminderTimeoutRef.current = setTimeout(() => {
        lastReminderRef.current = Date.now();
        
        toast({
          title: "🍼 Feeding time approaching",
          description: "Baby's next feeding may be due soon",
        });
        
        sendBrowserNotification(
          "Feeding time approaching",
          "Baby's next feeding may be due in about 5 minutes"
        );
      }, reminderInMinutes * 60 * 1000);
    } else if (reminderInMinutes <= 0 && reminderInMinutes > -10) {
      // Already due - remind now
      if (now - lastReminderRef.current > 30 * 60 * 1000) {
        lastReminderRef.current = now;
        
        toast({
          title: "🍼 Feeding may be due",
          description: `It's been ${formatMinutesToReadable(insights.minutesSinceLastFeeding || 0)} since the last feeding`,
        });
        
        sendBrowserNotification(
          "Feeding may be due",
          `It's been ${formatMinutesToReadable(insights.minutesSinceLastFeeding || 0)} since the last feeding`
        );
      }
    }
  }, [insights, reminderEnabled, toast, sendBrowserNotification]);
  
  // Set up real-time subscription for feeding logs
  useEffect(() => {
    if (!enabled || !targetUserId) return;
    
    // Request notification permission
    requestPermission();
    
    // Subscribe to new feeding logs
    const feedingChannel = supabase
      .channel(`feeding-notifications-${targetUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "feeding_logs",
          filter: `user_id=eq.${targetUserId}`,
        },
        (payload) => {
          // Refresh queries
          queryClient.invalidateQueries({ queryKey: ["feedings"] });
          queryClient.invalidateQueries({ queryKey: ["feedingInsights"] });
          refetchInsights();
          
          // Check if it was logged by someone else
          // Note: We can't easily tell who logged it without adding a logged_by field
          // For now, we show notification to both and let them see the update
          const feedingType = payload.new.type as string;
          const emoji = getFeedingEmoji(feedingType as any);
          const side = payload.new.side;
          const sideText = side ? ` (${side})` : "";
          
          toast({
            title: `${emoji} Feeding logged`,
            description: `${feedingType}${sideText} feeding recorded`,
          });
          
          // Also send browser notification
          sendBrowserNotification(
            "Feeding logged",
            `${feedingType}${sideText} feeding recorded`
          );
          
          // Reschedule the reminder based on new data
          setTimeout(scheduleReminder, 1000);
        }
      )
      .subscribe();
    
    // Subscribe to new nap logs
    const napChannel = supabase
      .channel(`nap-notifications-${targetUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "nap_logs",
          filter: `user_id=eq.${targetUserId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["naps"] });
          queryClient.invalidateQueries({ queryKey: ["feedingInsights"] });
          refetchInsights();
          
          const duration = payload.new.duration_minutes;
          
          toast({
            title: "😴 Nap logged",
            description: `${duration}m nap recorded`,
          });
          
          sendBrowserNotification(
            "Nap logged",
            `${duration} minute nap recorded`
          );
        }
      )
      .subscribe();
    
    // Schedule initial reminder
    scheduleReminder();
    
    return () => {
      supabase.removeChannel(feedingChannel);
      supabase.removeChannel(napChannel);
      if (reminderTimeoutRef.current) {
        clearTimeout(reminderTimeoutRef.current);
      }
    };
  }, [
    enabled, 
    targetUserId, 
    queryClient, 
    toast, 
    requestPermission, 
    sendBrowserNotification,
    scheduleReminder,
    refetchInsights,
  ]);
  
  // Reschedule reminder when insights change
  useEffect(() => {
    if (enabled && insights?.lastFeedingAt) {
      scheduleReminder();
    }
  }, [enabled, insights?.lastFeedingAt, scheduleReminder]);
  
  return {
    requestPermission,
    notificationsSupported: typeof Notification !== "undefined",
    notificationsEnabled: typeof Notification !== "undefined" && Notification.permission === "granted",
  };
}