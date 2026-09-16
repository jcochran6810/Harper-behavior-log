"use client";

import { BEHAVIORS } from "@/lib/behaviors";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="shrink-0 rounded-full px-5 py-2.5 text-sm font-medium text-white"
      style={{ background: BEHAVIORS[0].color }}
    >
      Print / Save PDF
    </button>
  );
}
