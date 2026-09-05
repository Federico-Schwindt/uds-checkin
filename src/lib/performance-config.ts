/**
 * Scoring rules for the technician performance system. Kept free of database
 * imports so both the DB bootstrap and the UI can read the defaults.
 */

export type ScoringConfig = {
  /** Everyone starts the month here; events move the score up or down. */
  baseScore: number;
  minorMistake: number;
  majorMistake: number;
  criticalMistake: number;
  praise: number;
  /** Applied per late arrival. */
  latePenalty: number;
  /** Applied per scheduled shift with no sign-in at all. */
  absentPenalty: number;
  /** Minutes after the shift start before an arrival counts as late. */
  lateGraceMinutes: number;
  /** Bonus gates. */
  bonusScore: number;
  bonusPunctuality: number;
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
  latePenalty: -2,
  absentPenalty: -5,
  lateGraceMinutes: 5,
  bonusScore: 90,
  bonusPunctuality: 90,
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
    latePenalty: num("latePenalty"),
    absentPenalty: num("absentPenalty"),
    lateGraceMinutes: num("lateGraceMinutes"),
    bonusScore: num("bonusScore"),
    bonusPunctuality: num("bonusPunctuality"),
    bonusBlockOnCritical:
      typeof raw.bonusBlockOnCritical === "boolean" ? raw.bonusBlockOnCritical : DEFAULT_SCORING.bonusBlockOnCritical,
    bonusAmount: num("bonusAmount"),
  };
}

/** Default point value for a manual event, before any admin override. */
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
