export type RequestQualityInput = {
  title?: string | null;
  serviceType?: string | null;
  serviceDate?: string | null;
  serviceTime?: string | null;
  useChurchLocation?: boolean | null;
  churchLocationVerified?: boolean | null;
  locationVerified?: boolean | null;
  instrumentsNeeded?: string[] | null;
  rehearsals?: string | null;
  setlistUrl?: string | null;
  techSetup?: string[] | null;
  offeredFee?: number | string | null;
  feeType?: string | null;
  notes?: string | null;
};

export type RequestQualityGrade = "Excellent" | "Strong" | "Good" | "Needs work";

export type RequestQualityScore = {
  percent: number;
  grade: RequestQualityGrade;
  summary: string;
  strengths: string[];
  improvements: string[];
};

type Criterion = {
  points: number;
  max: number;
  strength?: string;
  improvement?: string;
};

const TOTAL_POINTS = 100;

function clean(value?: string | null) {
  return value?.trim() ?? "";
}

function hasUsefulUrl(value?: string | null) {
  const url = clean(value);
  return /^https?:\/\/\S+\.\S+/i.test(url) || /^[\w.-]+\.\w{2,}\/?\S*/i.test(url);
}

function hasClearTitle(title?: string | null) {
  const value = clean(title);
  const words = value.split(/\s+/).filter(Boolean);
  return value.length >= 12 && words.length >= 3 && !/^(untitled|new request)$/i.test(value);
}

function hasMeaningfulNotes(notes?: string | null) {
  return clean(notes).length >= 30;
}

function hasPositiveFee(fee?: number | string | null) {
  if (typeof fee === "number") return Number.isFinite(fee) && fee > 0;
  if (typeof fee === "string" && clean(fee)) {
    const parsed = Number.parseFloat(fee);
    return Number.isFinite(parsed) && parsed > 0;
  }
  return false;
}

function gradeFor(percent: number): RequestQualityGrade {
  if (percent >= 90) return "Excellent";
  if (percent >= 75) return "Strong";
  if (percent >= 60) return "Good";
  return "Needs work";
}

function summaryFor(grade: RequestQualityGrade) {
  switch (grade) {
    case "Excellent":
      return "This request is ready for strong musician responses.";
    case "Strong":
      return "This request gives musicians a solid picture of the opportunity.";
    case "Good":
      return "This request is usable, with a few details that could improve response rate.";
    case "Needs work":
      return "Add the basics musicians need before they can confidently respond.";
  }
}

export function scoreRequestQuality(input: RequestQualityInput): RequestQualityScore {
  const locationVerified = input.useChurchLocation
    ? !!input.churchLocationVerified
    : !!input.locationVerified;
  const hasDate = !!clean(input.serviceDate);
  const hasTime = !!clean(input.serviceTime);
  const instruments = input.instrumentsNeeded ?? [];
  const techSetup = input.techSetup ?? [];
  const rehearsals = clean(input.rehearsals);
  const titleClear = hasClearTitle(input.title);
  const setlistUrl = hasUsefulUrl(input.setlistUrl);
  const positiveFee = hasPositiveFee(input.offeredFee);
  const notes = hasMeaningfulNotes(input.notes);

  const criteria: Criterion[] = [
    {
      max: 16,
      points: locationVerified ? 16 : 0,
      strength: locationVerified ? "Service location is verified for distance matching." : undefined,
      improvement: locationVerified ? undefined : "Verify the church or service location so musicians can trust the commute.",
    },
    {
      max: 14,
      points: hasDate && hasTime ? 14 : hasDate || hasTime ? 7 : 0,
      strength: hasDate && hasTime ? "Date and start time are clear." : undefined,
      improvement: hasDate && hasTime ? undefined : "Add both the service date and start time.",
    },
    {
      max: 14,
      points: instruments.length > 0 ? 14 : 0,
      strength: instruments.length > 0 ? "Needed instruments are listed." : undefined,
      improvement: instruments.length > 0 ? undefined : "Choose the instruments or roles you need filled.",
    },
    {
      max: 14,
      points: positiveFee ? 14 : 0,
      strength: positiveFee ? "Offered fee is visible up front." : undefined,
      improvement: positiveFee ? undefined : "Add an offered fee, even if musicians can negotiate later.",
    },
    {
      max: 10,
      points: titleClear ? 10 : 0,
      strength: titleClear ? "Title is specific enough to scan." : undefined,
      improvement: titleClear ? undefined : "Use a plain, specific title like \"Sunday morning pianist needed.\"",
    },
    {
      max: 8,
      points: rehearsals ? 8 : 0,
      strength: rehearsals ? "Rehearsal expectations are stated." : undefined,
      improvement: rehearsals ? undefined : "State whether rehearsals are required.",
    },
    {
      max: 8,
      points: setlistUrl ? 8 : 0,
      strength: setlistUrl ? "Setlist or repertoire link is included." : undefined,
      improvement: setlistUrl ? undefined : "Add a setlist, Planning Center, chart, or playlist link when available.",
    },
    {
      max: 8,
      points: techSetup.length >= 2 ? 8 : techSetup.length === 1 ? 4 : 0,
      strength: techSetup.length > 0 ? "Tech setup details are included." : undefined,
      improvement: techSetup.length >= 2 ? undefined : "Add monitors, charts, house gear, or other tech setup details.",
    },
    {
      max: 8,
      points: notes ? 8 : clean(input.notes) ? 4 : 0,
      strength: notes ? "Notes give extra context about the service." : undefined,
      improvement: notes ? undefined : "Add a short note about service style, congregation, parking, or expectations.",
    },
  ];

  const rawPoints = criteria.reduce((sum, criterion) => sum + criterion.points, 0);
  const maxPoints = criteria.reduce((sum, criterion) => sum + criterion.max, 0);
  const percent = Math.round((rawPoints / maxPoints) * TOTAL_POINTS);
  const grade = gradeFor(percent);

  return {
    percent,
    grade,
    summary: summaryFor(grade),
    strengths: criteria.flatMap(criterion => criterion.strength ? [criterion.strength] : []).slice(0, 4),
    improvements: criteria.flatMap(criterion => criterion.improvement ? [criterion.improvement] : []).slice(0, 4),
  };
}
