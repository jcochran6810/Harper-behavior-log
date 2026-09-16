import Link from "next/link";

/** Shared page title row, with settings tucked behind a gear on the right. */
export default function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="no-print flex shrink-0 items-center gap-3">
        {action}
        <Link
          href="/settings"
          aria-label="Settings"
          title="Settings"
          className="text-lg leading-none"
          style={{ color: "var(--text-muted)" }}
        >
          ⚙
        </Link>
      </div>
    </header>
  );
}
