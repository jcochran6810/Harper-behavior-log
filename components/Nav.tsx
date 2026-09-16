"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Charts", icon: "📈" },
  { href: "/upload", label: "Add log", icon: "📷" },
  { href: "/data", label: "Table", icon: "🗂" },
  { href: "/report", label: "Report", icon: "🖨" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav
      className="no-print sticky bottom-0 z-20 grid grid-cols-4 border-t"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="flex flex-col items-center gap-0.5 py-3 text-xs"
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
