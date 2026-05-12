export function normalizeServiceTimeForInput(time?: string | null): string {
  const match = time?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";

  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return "";
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatServiceTime(time?: string | null): string {
  const normalized = normalizeServiceTimeForInput(time);
  if (!normalized) return "";

  const [hourPart, minutePart] = normalized.split(":");
  const hour = Number.parseInt(hourPart, 10);
  const minute = Number.parseInt(minutePart, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;

  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export function formatServiceTimeRange(startTime?: string | null, endTime?: string | null): string {
  const start = formatServiceTime(startTime);
  const end = formatServiceTime(endTime);

  if (start && end) return `${start} - ${end}`;
  return start || end;
}

export function getBrowserTimeZone(): string | null {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
}
