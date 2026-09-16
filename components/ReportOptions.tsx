"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { serializeFilters, type Filters } from "@/lib/filters";
import { ALL_SECTIONS, REPORT_SECTIONS, serializeSections, type SectionKey } from "@/lib/report";

export default function ReportOptions({
  filters,
  sections,
  photoCount,
}: {
  filters: Filters;
  sections: SectionKey[];
  photoCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function apply(next: SectionKey[]) {
    const params = new URLSearchParams(serializeFilters(filters));
    const s = serializeSections(next);
    if (s) params.set("s", s);
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  const toggle = (key: SectionKey) =>
    apply(sections.includes(key) ? sections.filter((k) => k !== key) : [...sections, key]);

  return (
    <section className="no-print card mb-5 p-4" style={{ opacity: pending ? 0.6 : 1 }}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">What&apos;s in this PDF</h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="text-xs underline"
          style={{ color: "var(--text-secondary)" }}
        >
          {open ? "Done" : "Choose sections"}
        </button>
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        {sections.length} of {ALL_SECTIONS.length} sections included. Printing, or saving as
        PDF, produces exactly what&apos;s shown below.
      </p>

      <ol className="mt-3 grid gap-2">
        {REPORT_SECTIONS.map((section, i) => {
          const on = sections.includes(section.key);
          const empty = section.key === "photos" && photoCount === 0;
          return (
            <li key={section.key} className="flex items-start gap-2.5 text-sm">
              <span
                className="tnum mt-0.5 w-4 shrink-0 text-right text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                {i + 1}
              </span>
              {open ? (
                <label className="flex flex-1 items-start gap-2">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(section.key)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span>
                    <span className="font-medium">{section.label}</span>
                    <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                      {empty ? "No photos saved for the days in this view." : section.blurb}
                    </span>
                  </span>
                </label>
              ) : (
                <span className="flex-1">
                  <span
                    className="font-medium"
                    style={{
                      color: on ? "var(--text-primary)" : "var(--text-muted)",
                      textDecoration: on ? "none" : "line-through",
                    }}
                  >
                    {section.label}
                  </span>
                  <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                    {empty && on ? "No photos saved for the days in this view." : section.blurb}
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
