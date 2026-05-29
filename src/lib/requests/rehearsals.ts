export type RehearsalDetails = {
  hasRehearsal: boolean;
  rehearsalDate: string;
  rehearsalStartTime: string;
  rehearsalEndTime: string;
  rehearsalNotes: string;
};

export function encodeRehearsalString(
  hasRehearsal: boolean,
  date: string,
  start: string,
  end: string,
  notes: string,
): string {
  if (!hasRehearsal) return "None — show up Sunday morning";
  const parts: string[] = [];
  if (date) parts.push(`REHEARSAL_DATE:${date}`);
  if (start) parts.push(`REHEARSAL_START:${start}`);
  if (end) parts.push(`REHEARSAL_END:${end}`);
  if (notes.trim()) parts.push(`NOTES:${notes.trim()}`);
  return parts.length ? parts.join("|") : "Rehearsal — details TBD";
}

export function decodeRehearsalString(raw: string | null | undefined): RehearsalDetails {
  const value = raw ?? "";
  if (!value || value.startsWith("None")) {
    return { hasRehearsal: false, rehearsalDate: "", rehearsalStartTime: "", rehearsalEndTime: "", rehearsalNotes: "" };
  }
  if (!value.includes("REHEARSAL_DATE:") && !value.includes("REHEARSAL_START:")) {
    return { hasRehearsal: true, rehearsalDate: "", rehearsalStartTime: "", rehearsalEndTime: "", rehearsalNotes: value };
  }
  const get = (key: string) => {
    const match = value.match(new RegExp(`${key}:([^|]*)`));
    return match ? match[1].trim() : "";
  };
  return {
    hasRehearsal: true,
    rehearsalDate: get("REHEARSAL_DATE"),
    rehearsalStartTime: get("REHEARSAL_START"),
    rehearsalEndTime: get("REHEARSAL_END"),
    rehearsalNotes: get("NOTES"),
  };
}

export function formatRehearsalDate(date: string): string {
  if (!date) return "Date TBD";
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function formatRehearsalTime(time: string): string {
  if (!time) return "";
  const [hourValue, minuteValue = "0"] = time.split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function formatRehearsalTimeRange(start: string, end: string): string {
  if (start && end) return `${formatRehearsalTime(start)} – ${formatRehearsalTime(end)}`;
  if (start) return `Starts at ${formatRehearsalTime(start)}`;
  if (end) return `Ends at ${formatRehearsalTime(end)}`;
  return "Time TBD";
}

export function formatRehearsalSummary(raw: string | null | undefined): string {
  const details = decodeRehearsalString(raw);
  if (!details.hasRehearsal) return "None";

  const hasStructuredFields = details.rehearsalDate || details.rehearsalStartTime || details.rehearsalEndTime;
  if (!hasStructuredFields) return details.rehearsalNotes || "Details TBD";

  return [
    formatRehearsalDate(details.rehearsalDate),
    formatRehearsalTimeRange(details.rehearsalStartTime, details.rehearsalEndTime),
    details.rehearsalNotes,
  ].filter(Boolean).join(" · ");
}
