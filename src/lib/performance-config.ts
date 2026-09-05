/**
 * Scoring rules for the technician performance system. Kept free of database
 * imports so both the DB bootstrap and the UI can read the defaults.
 */

/**
 * Nothing here changes a score on its own. The suggested amounts only pre-fill
 * the admin's form — every point that moves is a point an admin decided to move.
 */
export type ScoringConfig = {
  /** Everyone starts the month here; only admin entries move it. */
  baseScore: number;
  /** Suggested deductions by severity, offered in the form and always editable. */
  minorMistake: number;
  majorMistake: number;
  criticalMistake: number;
  praise: number;
  /** Minutes after the shift start before an arrival is shown as late. */
  lateGraceMinutes: number;
  /** Minimum score for the monthly bonus. */
  bonusScore: number;
  /** A single critical mistake disqualifies the month when true. */
  bonusBlockOnCritical: boolean;
  bonusAmount: number;
};

export const DEFAULT_SCORING: ScoringConfig = {
  baseScore: 100,
  minorMistake: -3,
  majorMistake: -8,
  criticalMistake: -15,
  praise: 3,
  lateGraceMinutes: 5,
  bonusScore: 90,
  bonusBlockOnCritical: true,
  bonusAmount: 200,
};

export const SEVERITIES = ["minor", "major", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_LABEL: Record<Severity, string> = {
  minor: "Minor",
  major: "Major",
  critical: "Critical",
};

/** Suggested reasons for flagging a job; the admin can always type their own. */
export const MISTAKE_CATEGORIES = [
  "Wrong measurement",
  "Wrong parts ordered",
  "Rework required",
  "Customer complaint",
  "Damaged component",
  "Incomplete work order",
  "Missed deadline",
  "Safety issue",
  "Other",
];

export const PRAISE_CATEGORIES = [
  "Excellent workmanship",
  "Customer compliment",
  "Fast turnaround",
  "Helped a teammate",
  "Covered an extra shift",
  "Other",
];

export function normalizeScoring(stored: unknown): ScoringConfig {
  const raw = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  const num = (key: keyof ScoringConfig) => {
    const v = Number(raw[key]);
    return isNaN(v) ? (DEFAULT_SCORING[key] as number) : v;
  };
  return {
    baseScore: num("baseScore"),
    minorMistake: num("minorMistake"),
    majorMistake: num("majorMistake"),
    criticalMistake: num("criticalMistake"),
    praise: num("praise"),
    lateGraceMinutes: num("lateGraceMinutes"),
    bonusScore: num("bonusScore"),
    bonusBlockOnCritical:
      typeof raw.bonusBlockOnCritical === "boolean" ? raw.bonusBlockOnCritical : DEFAULT_SCORING.bonusBlockOnCritical,
    bonusAmount: num("bonusAmount"),
  };
}

/** Suggested point value for the form — the admin can change it before saving. */
export function pointsFor(config: ScoringConfig, type: string, severity: string): number {
  if (type === "praise") return Math.abs(config.praise);
  if (type === "mistake") {
    if (severity === "critical") return -Math.abs(config.criticalMistake);
    if (severity === "major") return -Math.abs(config.majorMistake);
    return -Math.abs(config.minorMistake);
  }
  return 0;
}

export function gradeFor(score: number): { letter: string; label: string; tone: "good" | "ok" | "warn" | "bad" } {
  if (score >= 90) return { letter: "A", label: "Excellent", tone: "good" };
  if (score >= 80) return { letter: "B", label: "Good", tone: "ok" };
  if (score >= 70) return { letter: "C", label: "Needs attention", tone: "warn" };
  if (score >= 60) return { letter: "D", label: "At risk", tone: "warn" };
  return { letter: "F", label: "Critical", tone: "bad" };
}
