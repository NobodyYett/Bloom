// client/src/lib/notifications.ts

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// Notification IDs
const MORNING_CHECKIN_ID = 8831;
const MIDDAY_WELLNESS_ID = 8832;
const EVENING_CHECKIN_ID = 8830;
const APPOINTMENT_REMINDER_BASE_ID = 9000;

// Storage keys
const MORNING_STORAGE_KEY = "bloom_morning_checkin_enabled";
const MIDDAY_STORAGE_KEY = "bloom_midday_wellness_enabled";
const EVENING_STORAGE_KEY = "bloom_evening_checkin_enabled";
const APPOINTMENT_REMINDERS_KEY = "bloom_appointment_reminders_enabled";
const DEFAULT_REMINDER_TIMES_KEY = "bloom_default_reminder_times";

// Default reminder times (in minutes before appointment)
export const DEFAULT_REMINDER_MINUTES = [1440, 60]; // 24 hours, 1 hour

export interface ReminderTimePreference {
  firstReminder: number;
  secondReminder: number;
}

export function isNotificationsSupported(): boolean {
  return Capacitor.isNativePlatform();
}

// ---- Midday wellness tips (subset of nudges for notifications) ----
const MIDDAY_TIPS = [
  "Stay hydrated! Have you had a glass of water recently?",
  "Time for a stretch break. Your body will thank you.",
  "Take 3 deep breaths. In through your nose, out through your mouth.",
  "A short walk can boost your energy and mood.",
  "Remember to eat something nutritious today.",
  "Step outside for some fresh air and sunlight if you can.",
  "Check your posture and give your shoulders a roll.",
  "You're doing amazing. Take a moment to appreciate yourself.",
  "Keep a water bottle nearby—small sips add up.",
  "If you've been sitting, stand up and stretch your legs.",
];

function getRandomMiddayTip(): string {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  // Use day of year to pick a consistent tip for the day
  return MIDDAY_TIPS[dayOfYear % MIDDAY_TIPS.length];
}

// ---- Morning Check-in (8:30 AM) ----

export function isMorningCheckinEnabled(): boolean {
  const stored = localStorage.getItem(MORNING_STORAGE_KEY);
  if (stored === null) return true; // ON by default
  return stored === "true";
}

export function setMorningCheckinEnabled(enabled: boolean): void {
  localStorage.setItem(MORNING_STORAGE_KEY, enabled ? "true" : "false");
}

export async function scheduleMorningCheckin(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  
  try {
    const hasPermission = await hasNotificationPermission();
    if (!hasPermission) {
      const granted = await requestNotificationPermission();
      if (!granted) return false;
    }
    
    // Always cancel first to prevent duplicates
    await cancelMorningCheckin();
    
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(8, 30, 0, 0);
    
    // If it's past 8:30am today, schedule for tomorrow
    if (now > scheduledTime) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    await LocalNotifications.schedule({
      notifications: [
        {
          id: MORNING_CHECKIN_ID,
          title: "Good morning ☀️",
          body: "How did you sleep? Take a moment to check in.",
          schedule: { at: scheduledTime, repeats: true, every: "day" },
          sound: "default",
          smallIcon: "ic_stat_icon_config_sample",
          iconColor: "#5A8F7B",
        },
      ],
    });
    
    console.log("Morning check-in scheduled for 8:30am daily");
    return true;
  } catch (error) {
    console.error("Failed to schedule morning check-in:", error);
    return false;
  }
}

export async function cancelMorningCheckin(): Promise<void> {
  if (!isNotificationsSupported()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: MORNING_CHECKIN_ID }] });
    console.log("Morning check-in cancelled");
  } catch (error) {
    console.error("Failed to cancel morning check-in:", error);
  }
}

export async function toggleMorningCheckin(enable: boolean): Promise<boolean> {
  setMorningCheckinEnabled(enable);
  if (enable) {
    return await scheduleMorningCheckin();
  } else {
    await cancelMorningCheckin();
    return true;
  }
}

// Aliases for backwards compatibility
export const isMorningGuidanceEnabled = isMorningCheckinEnabled;
export const setMorningGuidanceEnabled = setMorningCheckinEnabled;
export const scheduleMorningGuidance = scheduleMorningCheckin;
export const cancelMorningGuidance = cancelMorningCheckin;
export const toggleMorningGuidance = toggleMorningCheckin;

// ---- Midday Wellness (12:30 PM) ----

export function isMiddayWellnessEnabled(): boolean {
  const stored = localStorage.getItem(MIDDAY_STORAGE_KEY);
  if (stored === null) return false; // OFF by default (less intrusive)
  return stored === "true";
}

export function setMiddayWellnessEnabled(enabled: boolean): void {
  localStorage.setItem(MIDDAY_STORAGE_KEY, enabled ? "true" : "false");
}

export async function scheduleMiddayWellness(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  
  try {
    const hasPermission = await hasNotificationPermission();
    if (!hasPermission) {
      const granted = await requestNotificationPermission();
      if (!granted) return false;
    }
    
    // Always cancel first to prevent duplicates
    await cancelMiddayWellness();
    
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(12, 30, 0, 0);
    
    // If it's past 12:30pm today, schedule for tomorrow
    if (now > scheduledTime) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    await LocalNotifications.schedule({
      notifications: [
        {
          id: MIDDAY_WELLNESS_ID,
          title: "Midday moment 🌿",
          body: getRandomMiddayTip(),
          schedule: { at: scheduledTime, repeats: true, every: "day" },
          sound: "default",
          smallIcon: "ic_stat_icon_config_sample",
          iconColor: "#5A8F7B",
        },
      ],
    });
    
    console.log("Midday wellness scheduled for 12:30pm daily");
    return true;
  } catch (error) {
    console.error("Failed to schedule midday wellness:", error);
    return false;
  }
}

export async function cancelMiddayWellness(): Promise<void> {
  if (!isNotificationsSupported()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: MIDDAY_WELLNESS_ID }] });
    console.log("Midday wellness cancelled");
  } catch (error) {
    console.error("Failed to cancel midday wellness:", error);
  }
}

export async function toggleMiddayWellness(enable: boolean): Promise<boolean> {
  setMiddayWellnessEnabled(enable);
  if (enable) {
    return await scheduleMiddayWellness();
  } else {
    await cancelMiddayWellness();
    return true;
  }
}

// ---- Evening Check-in (8:30 PM) ----

export function isEveningCheckinEnabled(): boolean {
  const stored = localStorage.getItem(EVENING_STORAGE_KEY);
  if (stored === null) return true; // ON by default
  return stored === "true";
}

export function setEveningCheckinEnabled(enabled: boolean): void {
  localStorage.setItem(EVENING_STORAGE_KEY, enabled ? "true" : "false");
}

export async function scheduleEveningCheckin(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  
  try {
    const hasPermission = await hasNotificationPermission();
    if (!hasPermission) {
      const granted = await requestNotificationPermission();
      if (!granted) return false;
    }
    
    // Always cancel first to prevent duplicates
    await cancelEveningCheckin();
    
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(20, 30, 0, 0);
    
    // If it's past 8:30pm today, schedule for tomorrow
    if (now > scheduledTime) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    await LocalNotifications.schedule({
      notifications: [
        {
          id: EVENING_CHECKIN_ID,
          title: "Evening reflection 🌙",
          body: "How was your day? Take a moment to check in.",
          schedule: { at: scheduledTime, repeats: true, every: "day" },
          sound: "default",
          smallIcon: "ic_stat_icon_config_sample",
          iconColor: "#5A8F7B",
        },
      ],
    });
    
    console.log("Evening check-in scheduled for 8:30pm daily");
    return true;
  } catch (error) {
    console.error("Failed to schedule evening check-in:", error);
    return false;
  }
}

export async function cancelEveningCheckin(): Promise<void> {
  if (!isNotificationsSupported()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: EVENING_CHECKIN_ID }] });
    console.log("Evening check-in cancelled");
  } catch (error) {
    console.error("Failed to cancel evening check-in:", error);
  }
}

export async function toggleEveningCheckin(enable: boolean): Promise<boolean> {
  setEveningCheckinEnabled(enable);
  if (enable) {
    return await scheduleEveningCheckin();
  } else {
    await cancelEveningCheckin();
    return true;
  }
}

// Aliases for backwards compatibility
export const isNightReminderEnabled = isEveningCheckinEnabled;
export const setNightReminderEnabled = setEveningCheckinEnabled;
export const scheduleNightReminder = scheduleEveningCheckin;
export const cancelNightReminder = cancelEveningCheckin;
export const toggleNightReminder = toggleEveningCheckin;

// ---- Appointment Reminders ----

export function isAppointmentRemindersEnabled(): boolean {
  const stored = localStorage.getItem(APPOINTMENT_REMINDERS_KEY);
  if (stored === null) return true; // ON by default
  return stored === "true";
}

export function setAppointmentRemindersEnabled(enabled: boolean): void {
  localStorage.setItem(APPOINTMENT_REMINDERS_KEY, enabled ? "true" : "false");
}

export function getDefaultReminderTimes(): ReminderTimePreference {
  const stored = localStorage.getItem(DEFAULT_REMINDER_TIMES_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Fall through to defaults
    }
  }
  return {
    firstReminder: 1440, // 24 hours
    secondReminder: 60,  // 1 hour
  };
}

export function setDefaultReminderTimes(prefs: ReminderTimePreference): void {
  localStorage.setItem(DEFAULT_REMINDER_TIMES_KEY, JSON.stringify(prefs));
}

// Generate a stable notification ID from appointment ID
function getAppointmentNotificationId(appointmentId: string, reminderIndex: number): number {
  let hash = 0;
  for (let i = 0; i < appointmentId.length; i++) {
    const char = appointmentId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return APPOINTMENT_REMINDER_BASE_ID + Math.abs(hash % 1000) + reminderIndex;
}

export interface AppointmentForReminder {
  id: string;
  title: string;
  starts_at: string; // ISO string
  location?: string | null;
}

export async function scheduleAppointmentReminders(
  appointment: AppointmentForReminder,
  reminderMinutes?: number[]
): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  if (!isAppointmentRemindersEnabled()) return false;
  
  try {
    const hasPermission = await hasNotificationPermission();
    if (!hasPermission) {
      const granted = await requestNotificationPermission();
      if (!granted) return false;
    }
    
    const appointmentTime = new Date(appointment.starts_at);
    const now = new Date();
    
    // Use provided reminder times or defaults
    const times = reminderMinutes || [
      getDefaultReminderTimes().firstReminder,
      getDefaultReminderTimes().secondReminder,
    ];
    
    const notifications = [];
    
    for (let i = 0; i < times.length; i++) {
      const minutesBefore = times[i];
      const reminderTime = new Date(appointmentTime.getTime() - minutesBefore * 60 * 1000);
      
      // Skip if reminder time is in the past
      if (reminderTime <= now) continue;
      
      const notificationId = getAppointmentNotificationId(appointment.id, i);
      
      // Format the time difference for the message
      let timeLabel: string;
      if (minutesBefore >= 1440) {
        const days = Math.floor(minutesBefore / 1440);
        timeLabel = days === 1 ? "tomorrow" : `in ${days} days`;
      } else if (minutesBefore >= 60) {
        const hours = Math.floor(minutesBefore / 60);
        timeLabel = hours === 1 ? "in 1 hour" : `in ${hours} hours`;
      } else {
        timeLabel = `in ${minutesBefore} minutes`;
      }
      
      const locationText = appointment.location ? ` at ${appointment.location}` : "";
      
      notifications.push({
        id: notificationId,
        title: "Appointment Reminder 📅",
        body: `${appointment.title}${locationText} is ${timeLabel}.`,
        schedule: { at: reminderTime },
        sound: "default",
        smallIcon: "ic_stat_icon_config_sample",
        iconColor: "#5A8F7B",
      });
    }
    
    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
      console.log(`Scheduled ${notifications.length} reminder(s) for appointment: ${appointment.title}`);
    }
    
    return true;
  } catch (error) {
    console.error("Failed to schedule appointment reminders:", error);
    return false;
  }
}

export async function cancelAppointmentReminders(appointmentId: string): Promise<void> {
  if (!isNotificationsSupported()) return;
  
  try {
    // Cancel both possible reminder notifications
    const ids = [
      getAppointmentNotificationId(appointmentId, 0),
      getAppointmentNotificationId(appointmentId, 1),
    ];
    
    await LocalNotifications.cancel({
      notifications: ids.map(id => ({ id })),
    });
    
    console.log(`Cancelled reminders for appointment: ${appointmentId}`);
  } catch (error) {
    console.error("Failed to cancel appointment reminders:", error);
  }
}

export async function toggleAppointmentReminders(enable: boolean): Promise<boolean> {
  setAppointmentRemindersEnabled(enable);
  return true;
}

// ---- Shared ----

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  try {
    const result = await LocalNotifications.requestPermissions();
    return result.display === "granted";
  } catch (error) {
    console.error("Failed to request notification permission:", error);
    return false;
  }
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  try {
    const result = await LocalNotifications.checkPermissions();
    return result.display === "granted";
  } catch (error) {
    console.error("Failed to check notification permission:", error);
    return false;
  }
}

// Cancel ALL daily notifications to start fresh (useful for debugging/resetting)
export async function cancelAllDailyNotifications(): Promise<void> {
  if (!isNotificationsSupported()) return;
  try {
    await LocalNotifications.cancel({
      notifications: [
        { id: MORNING_CHECKIN_ID },
        { id: MIDDAY_WELLNESS_ID },
        { id: EVENING_CHECKIN_ID },
      ],
    });
    console.log("All daily notifications cancelled");
  } catch (error) {
    console.error("Failed to cancel all daily notifications:", error);
  }
}

export async function initializeNotifications(): Promise<void> {
  if (!isNotificationsSupported()) return;
  
  // Cancel all first to prevent duplicates from accumulating
  await cancelAllDailyNotifications();
  
  // Re-schedule based on current preferences
  if (isMorningCheckinEnabled()) {
    await scheduleMorningCheckin();
  }
  
  if (isMiddayWellnessEnabled()) {
    await scheduleMiddayWellness();
  }
  
  if (isEveningCheckinEnabled()) {
    await scheduleEveningCheckin();
  }
  
  console.log("Notifications initialized");
}

// ---- Utility: Format reminder time for display ----

export function formatReminderTime(minutes: number): string {
  if (minutes >= 1440) {
    const days = Math.floor(minutes / 1440);
    return days === 1 ? "1 day before" : `${days} days before`;
  } else if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? "1 hour before" : `${hours} hours before`;
  } else {
    return `${minutes} minutes before`;
  }
}

// Preset options for reminder time picker
export const REMINDER_TIME_OPTIONS = [
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 1440, label: "1 day before" },
  { value: 2880, label: "2 days before" },
  { value: 10080, label: "1 week before" },
];