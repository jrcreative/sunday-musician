export type CancellationActor = "church" | "musician";

export type CancellationPolicyWindow = "flexible" | "short_notice" | "late";

export type CancellationPolicy = {
  cancelledBy: CancellationActor;
  serviceDate: string;
  cancelledOn: string;
  daysUntilService: number;
  window: CancellationPolicyWindow;
  label: string;
  feeMayApply: boolean;
  adminReviewMayApply: boolean;
  summary: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function utcDateOnly(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function daysUntilService(serviceDate: string, cancelledAt: Date = new Date()) {
  const cancelledOn = cancelledAt.toISOString().slice(0, 10);
  return Math.ceil((utcDateOnly(serviceDate) - utcDateOnly(cancelledOn)) / MS_PER_DAY);
}

export function cancellationPolicyFor({
  cancelledBy,
  serviceDate,
  cancelledAt = new Date(),
}: {
  cancelledBy: CancellationActor;
  serviceDate: string;
  cancelledAt?: Date;
}): CancellationPolicy {
  const days = daysUntilService(serviceDate, cancelledAt);
  const cancelledOn = cancelledAt.toISOString().slice(0, 10);

  if (days >= 14) {
    return {
      cancelledBy,
      serviceDate,
      cancelledOn,
      daysUntilService: days,
      window: "flexible",
      label: "Flexible cancellation",
      feeMayApply: false,
      adminReviewMayApply: false,
      summary: "Cancelled at least 14 days before the service. No cancellation fee is expected.",
    };
  }

  if (days >= 7) {
    return {
      cancelledBy,
      serviceDate,
      cancelledOn,
      daysUntilService: days,
      window: "short_notice",
      label: "Short-notice cancellation",
      feeMayApply: true,
      adminReviewMayApply: true,
      summary: "Cancelled 7 to 13 days before the service. A fee or admin review may apply if either side contests it.",
    };
  }

  return {
    cancelledBy,
    serviceDate,
    cancelledOn,
    daysUntilService: days,
    window: "late",
    label: "Late cancellation",
    feeMayApply: true,
    adminReviewMayApply: true,
    summary: "Cancelled within 7 days of the service. A fee or admin review may apply.",
  };
}

export function cancellationPolicyLine(policy: Pick<CancellationPolicy, "label" | "daysUntilService" | "feeMayApply" | "adminReviewMayApply">) {
  const dayText = policy.daysUntilService === 1
    ? "1 day before service"
    : policy.daysUntilService === 0
      ? "on the service date"
      : policy.daysUntilService < 0
        ? "after the service date"
        : `${policy.daysUntilService} days before service`;
  const reviewText = policy.adminReviewMayApply
    ? "fee/admin review may apply"
    : "no cancellation fee expected";
  return `${policy.label} (${dayText}); ${reviewText}.`;
}
