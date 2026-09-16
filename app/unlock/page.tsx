import PinPad from "@/components/PinPad";

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only allow same-site relative redirects back out of the gate.
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <h1 className="mb-1 text-xl font-semibold">Behavior Log</h1>
      <p className="mb-10 text-sm" style={{ color: "var(--text-muted)" }}>
        Private — family and teacher only
      </p>
      <PinPad next={target} />
    </main>
  );
}
