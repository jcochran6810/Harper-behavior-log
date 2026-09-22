/** Single source of truth for the form's behaviors and schedule. */

export type BehaviorCode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Behavior = {
  code: BehaviorCode;
  label: string;
  short: string;
  /** Categorical slot from the validated palette; slot order is the CVD-safety
   *  mechanism, so never re-order or cycle these. */
  color: string;
  colorDark: string;
};

export const BEHAVIORS: Behavior[] = [
  { code: 1, label: "Interrupting", short: "Interrupting", color: "#2a78d6", colorDark: "#3987e5" },
  { code: 2, label: "Shouting", short: "Shouting", color: "#eb6834", colorDark: "#d95926" },
  { code: 3, label: "Inappropriate usage of supplies/breaking materials", short: "Supplies", color: "#1baf7a", colorDark: "#199e70" },
  { code: 4, label: "Throwing/Kicking/hitting", short: "Aggression", color: "#eda100", colorDark: "#c98500" },
  { code: 5, label: "Cutting papers/materials", short: "Cutting", color: "#e87ba4", colorDark: "#d55181" },
  { code: 6, label: "Refusal/work refusal", short: "Refusal", color: "#008300", colorDark: "#008300" },
  { code: 7, label: "Taking shoes & socks off & throwing them", short: "Shoes off", color: "#4a3aa7", colorDark: "#9085e9" },
  { code: 8, label: "Snacking", short: "Snacking", color: "#e34948", colorDark: "#e66767" },
];

export const BEHAVIOR_KEYS = ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"] as const;
export type BehaviorKey = (typeof BEHAVIOR_KEYS)[number];

/**
 * Two things the log records that are NOT behaviors: how often another adult had
 * to be called into the room, and how often Harper was taken out of it.
 *
 * They are kept apart from BEHAVIORS on purpose, and it is not a filing
 * preference:
 *
 *  - The numbers 1-8 are the teacher's, printed on the paper form. Nothing may be
 *    added to them.
 *  - A behavior is something the child did. These two are what the school had to
 *    do about it — which is a different kind of evidence, and the kind an ARD
 *    committee asks for when the question is staffing rather than diagnosis.
 *  - They are deliberately left out of a period's `total`, so every incident
 *    figure stays comparable with every figure recorded before they existed, and
 *    so a removal is never counted as a second incident on top of the behavior
 *    that caused it.
 *
 * They also come from a different place on the page. Tally marks are counted;
 * these are written in prose, so the reader proposes them from the teacher's own
 * wording and a human confirms every non-zero one.
 *
 * No palette slot is assigned. The categorical palette's slot order is the
 * colorblind-safety mechanism, so these are drawn in neutral ink and told apart
 * by fill versus outline — a distinction that survives any kind of color vision.
 */
export type SupportEvent = {
  key: "assistance_count" | "removed_count";
  label: string;
  short: string;
  /** What counts, in the teacher's terms — shown next to the counter. */
  hint: string;
  /** How the charts tell the two apart without using color. */
  mark: "solid" | "outline";
};

export const SUPPORT_EVENTS: SupportEvent[] = [
  {
    key: "assistance_count",
    label: "Assistance called",
    short: "Assistance",
    hint: "Another adult was called into the room — support teacher, aide, administrator.",
    mark: "solid",
  },
  {
    key: "removed_count",
    label: "Removed from class",
    short: "Removed",
    hint: "Harper was taken out of the classroom — office, calm room, sent home. Not scheduled pull-outs like therapy.",
    mark: "outline",
  },
];

export type SupportKey = SupportEvent["key"];

export const SUPPORT_KEYS = SUPPORT_EVENTS.map((e) => e.key) as SupportKey[];

export type Period = { key: string; label: string; timeRange: string; order: number };

export const PERIODS: Period[] = [
  { key: "community_time", label: "Community Time", timeRange: "7:55-8:15", order: 1 },
  { key: "reading", label: "Reading", timeRange: "8:15-9:30", order: 2 },
  { key: "writing", label: "Writing", timeRange: "9:30-10:30", order: 3 },
  { key: "lunch", label: "Lunch", timeRange: "10:30-11:00", order: 4 },
  { key: "recess", label: "Recess", timeRange: "11:00-11:30", order: 5 },
  { key: "math", label: "Math", timeRange: "11:30-12:20", order: 6 },
  { key: "specials", label: "Specials", timeRange: "12:20-1:10", order: 7 },
  { key: "math_continued", label: "Math Continued", timeRange: "1:10-1:30", order: 8 },
  { key: "science", label: "Science", timeRange: "2:05-2:40", order: 9 },
  { key: "social_studies", label: "Social Studies", timeRange: "2:40-3:15", order: 10 },
];

export const PERIOD_KEYS = PERIODS.map((p) => p.key);

export function periodLabel(key: string): string {
  return PERIODS.find((p) => p.key === key)?.label ?? key;
}

/** Sequential blue ramp for magnitude (heatmap cells). Light -> dark. */
export const BLUE_RAMP = [
  "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef",
  "#6da7ec", "#5598e7", "#3987e5", "#2a78d6",
  "#256abf", "#1c5cab", "#184f95", "#104281",
];

export function rampColor(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "transparent";
  const t = Math.min(1, value / max);
  // Start at step 250 so the lightest occupied cell still reads against the surface.
  const idx = 3 + Math.round(t * (BLUE_RAMP.length - 1 - 3));
  return BLUE_RAMP[idx];
}

/** Cell text flips to white once the fill gets dark enough. */
export function rampInk(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "var(--text-muted)";
  return value / max > 0.55 ? "#ffffff" : "var(--text-primary)";
}
