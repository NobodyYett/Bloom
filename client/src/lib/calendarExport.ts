// client/src/lib/calendarExport.ts
//
// ICS Calendar Export Utility
// Generates RFC 5545 compliant .ics files for appointments
// Works on Web (download) and Mobile (share sheet)

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

// ============================================
// Constants
// ============================================

const DEFAULT_DURATION_MINUTES = 60;
const PRODID = "-//Bump Planner//Appointments//EN";
const CALSCALE = "GREGORIAN";
const VERSION = "2.0";

// ============================================
// Types
// ============================================

export interface CalendarAppointment {
  id: string;
  title: string;
  starts_at: string;       // ISO string
  ends_at?: string | null; // ISO string (optional)
  location?: string | null;
  notes?: string | null;
}

// ============================================
// ICS Formatting Helpers
// ============================================

/**
 * Escape special characters per RFC 5545
 * Commas, semicolons, and backslashes must be escaped
 * Newlines become \n
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")      // Backslash first
    .replace(/;/g, "\\;")        // Semicolon
    .replace(/,/g, "\\,")        // Comma
    .replace(/\r?\n/g, "\\n");   // Newlines
}

/**
 * Format date to ICS datetime format (UTC)
 * Format: YYYYMMDDTHHMMSSZ
 */
function formatIcsDateTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Format date for filename (YYYY-MM-DD)
 */
function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Fold long lines per RFC 5545 (max 75 octets per line)
 * Lines are continued with CRLF followed by a space
 */
function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) return line;
  
  const parts: string[] = [];
  let remaining = line;
  
  // First line can be full length
  parts.push(remaining.slice(0, maxLength));
  remaining = remaining.slice(maxLength);
  
  // Continuation lines start with space, so max content is 74
  while (remaining.length > 0) {
    parts.push(" " + remaining.slice(0, maxLength - 1));
    remaining = remaining.slice(maxLength - 1);
  }
  
  return parts.join("\r\n");
}

// ============================================
// ICS Generation
// ============================================

/**
 * Generate ICS file content for an appointment
 */
export function generateIcsContent(appointment: CalendarAppointment): string {
  const startDate = new Date(appointment.starts_at);
  
  // Calculate end date: use provided end time or default duration
  let endDate: Date;
  if (appointment.ends_at) {
    endDate = new Date(appointment.ends_at);
  } else {
    endDate = new Date(startDate.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);
  }
  
  const now = new Date();
  const uid = `${appointment.id}@bump-planner`;
  
  // Build ICS lines
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    `VERSION:${VERSION}`,
    `PRODID:${PRODID}`,
    `CALSCALE:${CALSCALE}`,
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    foldLine(`UID:${uid}`),
    `DTSTAMP:${formatIcsDateTime(now)}`,
    `DTSTART:${formatIcsDateTime(startDate)}`,
    `DTEND:${formatIcsDateTime(endDate)}`,
    foldLine(`SUMMARY:${escapeIcsText(appointment.title)}`),
  ];
  
  // Optional: Location
  if (appointment.location?.trim()) {
    lines.push(foldLine(`LOCATION:${escapeIcsText(appointment.location.trim())}`));
  }
  
  // Description: minimal, no private medical info
  lines.push(foldLine(`DESCRIPTION:${escapeIcsText("Created via Bump Planner")}`));
  
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");
  
  // ICS requires CRLF line endings
  return lines.join("\r\n") + "\r\n";
}

/**
 * Generate a sensible filename for the ICS file
 */
export function generateIcsFilename(appointment: CalendarAppointment): string {
  const date = formatDateForFilename(new Date(appointment.starts_at));
  // Sanitize title for filename (remove special chars, limit length)
  const safeTitle = appointment.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  
  return `appointment-${safeTitle}-${date}.ics`;
}

// ============================================
// Platform-Specific Export
// ============================================

/**
 * Download ICS file on web
 */
function downloadIcsWeb(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up blob URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Share ICS file on mobile via share sheet
 */
async function shareIcsMobile(content: string, filename: string): Promise<void> {
  try {
    // Write to temporary file
    const result = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    
    // Get the file URI
    const fileUri = result.uri;
    
    // Open share sheet
    await Share.share({
      title: "Add to Calendar",
      url: fileUri,
      dialogTitle: "Add appointment to calendar",
    });
    
    // Clean up temp file after a delay
    setTimeout(async () => {
      try {
        await Filesystem.deleteFile({
          path: filename,
          directory: Directory.Cache,
        });
      } catch {
        // Ignore cleanup errors
      }
    }, 60000); // 1 minute delay to allow user to complete action
    
  } catch (error) {
    console.error("Failed to share ICS file:", error);
    // Fallback: try data URI approach (less reliable but works on some devices)
    const dataUri = `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`;
    window.open(dataUri, "_blank");
  }
}

// ============================================
// Main Export Function
// ============================================

/**
 * Add appointment to calendar
 * - Web: Downloads .ics file
 * - Mobile: Opens share sheet with .ics file
 */
export async function addToCalendar(appointment: CalendarAppointment): Promise<void> {
  const content = generateIcsContent(appointment);
  const filename = generateIcsFilename(appointment);
  
  if (Capacitor.isNativePlatform()) {
    await shareIcsMobile(content, filename);
  } else {
    downloadIcsWeb(content, filename);
  }
}