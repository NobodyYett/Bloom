// client/src/lib/notifications.ts

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// Notification IDs
const MORNING_CHECKIN_ID = 8831;
const EVENING_CHECKIN_ID = 8830;
const APPOINTMENT_REMINDER_BASE_ID = 9000; // We'll add appointment id hash to this

// Storage keys
const MORNING_STORAGE_KEY = "bump_morning_checkin_enabled";
const EVENING_STORAGE_KEY = "bump_evening_checkin_enabled";
const APPOINTMENT_REMINDERS_KEY = "bump_appointment_reminders_enabled";
const DEFAULT_REMINDER_TIMES_KEY = "bump_default_reminder_times";
const LAST_MORNING_SENT_KEY = "bump_last_morning_sent";
const LAST_EVENING_SENT_KEY = "bump_last_evening_sent";

// Default reminder times (in minutes before appointment)
export const DEFAULT_REMINDER_MINUTES = [1440, 60]; // 24 hours, 1 hour

export interface ReminderTimePreference {
  firstReminder: number; // minutes before (default 1440 = 24 hours)
  secondReminder: number; // minutes before (default 60 = 1 hour)
}

export function isNotificationsSupported(): boolean {
  return Capacitor.isNativePlatform();
}

// ---- Morning Check-in (8:30 AM) ----
// "Good morning! How did you sleep?"

export function isMorningCheckinEnabled(): boolean {
  const stored = localStorage.getItem(MORNING_STORAGE_KEY);
  if (stored === null) return true; // ON by default
  return stored === "true";
}

export function setMorningCheckinEnabled(enabled: boolean): void {
  localStorage.setItem(MORNING_STORAGE_KEY, enabled ? "true" : "false");
}

function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function shouldSendMorningNotification(): boolean {
  const lastSent = localStorage.getItem(LAST_MORNING_SENT_KEY);
  const today = getTodayDateString();
  return lastSent !== today;
}

function markMorningSent(): void {
  localStorage.setItem(LAST_MORNING_SENT_KEY, getTodayDateString());
}

export async function scheduleMorningCheckin(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  
  try {
    const hasPermission = await hasNotificationPermission();
    if (!hasPermission) {
      const granted = await requestNotificationPermission();
      if (!granted) return false;
    }
    
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
          title: "Good morning",
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

// Alias for backwards compatibility
export const isMorningGuidanceEnabled = isMorningCheckinEnabled;
export const setMorningGuidanceEnabled = setMorningCheckinEnabled;
export const scheduleMorningGuidance = scheduleMorningCheckin;
export const cancelMorningGuidance = cancelMorningCheckin;
export const toggleMorningGuidance = toggleMorningCheckin;

// ---- Evening Check-in (8:30 PM) ----
// "How was your day? Take a moment to reflect."

export function isEveningCheckinEnabled(): boolean {
  const stored = localStorage.getItem(EVENING_STORAGE_KEY);
  if (stored === null) return true; // ON by default
  return stored === "true";
}

export function setEveningCheckinEnabled(enabled: boolean): void {
  localStorage.setItem(EVENING_STORAGE_KEY, enabled ? "true" : "false");
}

function shouldSendEveningNotification(): boolean {
  const lastSent = localStorage.getItem(LAST_EVENING_SENT_KEY);
  const today = getTodayDateString();
  return lastSent !== today;
}

function markEveningSent(): void {
  localStorage.setItem(LAST_EVENING_SENT_KEY, getTodayDateString());
}

export async function scheduleEveningCheckin(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  
  try {
    const hasPermission = await hasNotificationPermission();
    if (!hasPermission) {
      const granted = await requestNotificationPermission();
      if (!granted) return false;
    }
    
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
          title: "Evening check-in",
          body: "How was your day? Take a moment to reflect.",
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

// Alias for backwards compatibility
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
        title: "Appointment Reminder",
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
  // Note: This doesn't reschedule existing appointments - that would require
  // fetching all appointments from the database. Individual appointments
  // will respect this setting when created/updated.
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

export async function initializeNotifications(): Promise<void> {
  if (!isNotificationsSupported()) return;
  
  // Initialize morning check-in
  const morningEnabled = isMorningCheckinEnabled();
  if (morningEnabled) {
    await scheduleMorningCheckin();
  }
  
  // Initialize evening check-in
  const eveningEnabled = isEveningCheckinEnabled();
  if (eveningEnabled) {
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