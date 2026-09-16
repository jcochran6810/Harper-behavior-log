import Link from "next/link";
import LockButton from "@/components/LockButton";
import Nav from "@/components/Nav";
import PinSettings from "@/components/PinSettings";
import { BEHAVIORS, PERIODS } from "@/lib/behaviors";
import { pinIsCustom } from "@/lib/pin";
import { getLogs } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [isCustom, logs] = await Promise.all([pinIsCustom(), getLogs()]);
  const withPhotos = logs.filter((log) => log.image_path).length;
  const parsingReady = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-8 pt-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mb-5 mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
          Who can get in, and what the app knows about itself.
        </p>

        <div className="grid gap-4">
          <PinSettings isCustom={isCustom} />

          <section className="card p-4">
            <h2 className="text-sm font-semibold">This device</h2>
            <p className="mb-4 mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Unlocking lasts 30 days on a phone. Lock it if you&apos;re handing the device to
              someone else.
            </p>
            <LockButton />
          </section>

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">What&apos;s stored</h2>
            <dl className="grid gap-2 text-sm">
              {[
                ["School days recorded", `${logs.length}`],
                ["Original photos saved", `${withPhotos} of ${logs.length}`],
                ["Behaviors tracked", `${BEHAVIORS.length}`],
                ["Class periods per day", `${PERIODS.length}`],
                [
                  "Photo reading",
                  parsingReady ? "Ready" : "Needs an Anthropic API key in Vercel",
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <dt style={{ color: "var(--text-secondary)" }}>{label}</dt>
                  <dd
                    className="tnum text-right font-medium"
                    style={{ color: parsingReady || label !== "Photo reading" ? "var(--text-primary)" : "var(--warning)" }}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
              Photos live in a private bucket and are only ever shown through short-lived
              links. See them on the{" "}
              <Link href="/photos" className="underline">
                Photos
              </Link>{" "}
              page.
            </p>
          </section>

          <section className="card p-4">
            <h2 className="text-sm font-semibold">Privacy</h2>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              The site is hidden from search engines and every page is behind the PIN. A
              4-digit code is real protection against someone stumbling onto the address, but
              not against a determined attacker — so share the link only with the people who
              need it, and change the PIN above if it ever gets passed around.
            </p>
          </section>
        </div>
      </main>
      <Nav />
    </>
  );
}
