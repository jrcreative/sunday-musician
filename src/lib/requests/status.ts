// Single source of truth for "what status does the user see" across both
// request-centric views (church-side: Open/Filled/Cancelled/Expired) and
// booking-centric views (musician-side: Upcoming/Completed/Cancelled).
//
// The DB has two related but distinct lifecycles — service_requests.status
// (open|in_progress|filled|cancelled) and bookings.cancelled_at — and the
// UI should never poke at them directly. Always go through these helpers
// so a cancelled booking can't accidentally render as "Upcoming" on one
// screen while showing "Cancelled" on another.

// ─────────────────────────────────────────────────────────── request status

export type RequestStatusRaw = "open" | "in_progress" | "filled" | "cancelled";
export type RequestDisplayStatus = "open" | "filled" | "cancelled" | "expired";

const todayIso = () => new Date().toISOString().slice(0, 10);

export function requestDisplayStatus(
  status: string,
  serviceDate: string,
  today: string = todayIso(),
): RequestDisplayStatus {
  if (status === "filled") return "filled";
  if (status === "cancelled") return "cancelled";
  // 'open' or legacy 'in_progress' that never auto-flipped — both render as
  // active until the service date passes, then we call them expired.
  if (serviceDate < today) return "expired";
  return "open";
}

export const REQUEST_STATUS_LABEL: Record<RequestDisplayStatus, string> = {
  open: "Open",
  filled: "Filled",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const REQUEST_STATUS_CHIP: Record<RequestDisplayStatus, string> = {
  open: "chip chip--warn",
  filled: "chip chip--success",
  cancelled: "chip",
  expired: "chip",
};

// ─────────────────────────────────────────────────────────── booking status

export type BookingDisplayStatus = "upcoming" | "completed" | "cancelled";

export function bookingDisplayStatus(
  serviceDate: string | null,
  cancelledAt: string | null,
  today: string = todayIso(),
): BookingDisplayStatus {
  // Cancellation wins over date — a booking cancelled the day after the
  // service still reads as cancelled, not completed.
  if (cancelledAt) return "cancelled";
  if (serviceDate && serviceDate < today) return "completed";
  return "upcoming";
}

export const BOOKING_STATUS_LABEL: Record<BookingDisplayStatus, string> = {
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const BOOKING_STATUS_CHIP: Record<BookingDisplayStatus, string> = {
  upcoming: "chip chip--success",
  completed: "chip",
  cancelled: "chip",
};
