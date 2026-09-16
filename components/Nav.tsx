"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Charts", icon: "📈" },
  { href: "/upload", label: "Add", icon: "📷" },
  { href: "/data", label: "Table", icon: "📋" },
  { href: "/photos", label: "Pages", icon: "📄" },
  { href: "/report", label: "Report", icon: "📑" },
];

export default function Nav({ query = "" }: { query?: string }) {
  const pathname = usePathname();
  return (
    <nav
      className="no-print sticky bottom-0 z-20 grid grid-cols-5 border-t"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        // /upload has nothing to filter, so it never carries the query.
        const href = query && tab.href !== "/upload" ? `${tab.href}?${query}` : tab.href;
        return (
          <Link
            key={tab.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="flex flex-col items-center gap-0.5 px-1 py-3 text-[11px]"
            style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}
          >
            <span aria-hidden className="text-lg leading-none">
              {tab.icon}
            </span>
            <span style={{ fontWeight: active ? 600 : 400 }}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
