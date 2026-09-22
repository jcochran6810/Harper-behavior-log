import type { SearchParams } from "./filters";

/**
 * The sections of the printable report, in the order they appear. Every one is
 * on by default; the report page lists them all with a toggle so you can decide
 * exactly what the PDF contains before printing it.
 */
export const REPORT_SECTIONS = [
  {
    key: "summary",
    label: "Headline findings",
    blurb: "Totals, the hardest day, where incidents concentrate, and how the data was collected.",
  },
  {
    key: "chart",
    label: "Incidents per school day",
    blurb: "Bar chart — total incidents up the side, each school day along the bottom with its total printed underneath.",
  },
  {
    key: "behaviors",
    label: "Breakdown by behavior type",
    blurb: "Each of the eight numbered behaviors with its total, share, and per-day average.",
  },
  {
    key: "periods",
    label: "Breakdown by class period",
    blurb: "Which classes the incidents land in, crossed with behavior type.",
  },
  {
    key: "support",
    label: "Assistance called and removals from class",
    blurb:
      "How often another adult had to come into the room, and how often Harper was taken out of it, by class period. The staffing argument.",
  },
  {
    key: "daily",
    label: "Day-by-day record with teacher's notes",
    blurb: "Every recorded day, period by period, with the teacher's own wording.",
  },
  {
    key: "photos",
    label: "Photographs of the original log pages",
    blurb: "The source documents, as an appendix. Only days that were added by photo.",
  },
] as const;

export type SectionKey = (typeof REPORT_SECTIONS)[number]["key"];

export const ALL_SECTIONS: SectionKey[] = REPORT_SECTIONS.map((s) => s.key);

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Absent parameter means everything; "none" means nothing. */
export function parseSections(params: SearchParams): SectionKey[] {
  const raw = first(params.s);
  if (!raw) return [...ALL_SECTIONS];
  if (raw === "none") return [];
  const wanted = new Set(raw.split(",").map((x) => x.trim()));
  return ALL_SECTIONS.filter((key) => wanted.has(key));
}

export function serializeSections(sections: SectionKey[]): string {
  if (sections.length === ALL_SECTIONS.length) return "";
  if (sections.length === 0) return "none";
  return ALL_SECTIONS.filter((key) => sections.includes(key)).join(",");
}
