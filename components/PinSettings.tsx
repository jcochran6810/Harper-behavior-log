"use client";

import { useState } from "react";
import { BEHAVIORS } from "@/lib/behaviors";

export default function PinSettings({ isCustom }: { isCustom: boolean }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const digits = (value: string) => value.replace(/\D/g, "").slice(0, 4);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (newPin.length !== 4) return setError("The new PIN has to be exactly 4 digits.");
    if (newPin !== confirmPin) return setError("The two new PINs don't match.");

    setBusy(true);
    try {
      const res = await fetch("/api/settings/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Couldn't change the PIN.");
      setDone(true);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the PIN.");
    } finally {
      setBusy(false);
    }
  }

  const field = {
    borderColor: "var(--border)",
    background: "transparent",
    color: "var(--text-primary)",
  };

  return (
    <form onSubmit={submit} className="card p-4">
      <h2 className="text-sm font-semibold">Change the PIN</h2>
      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        {isCustom
          ? "Everyone who uses this site — you, your wife, the teacher — shares one 4-digit PIN."
          : "The PIN is still the one set when the site was deployed. Changing it here stores it in the database, and it takes effect immediately for everyone."}
      </p>

      <div className="mt-4 grid gap-3">
        {[
          { id: "current", label: "Current PIN", value: currentPin, set: setCurrentPin, auto: "current-password" },
          { id: "new", label: "New PIN", value: newPin, set: setNewPin, auto: "new-password" },
          { id: "confirm", label: "New PIN again", value: confirmPin, set: setConfirmPin, auto: "new-password" },
        ].map((f) => (
          <label key={f.id} className="grid gap-1.5">
            <span className="text-xs font-medium">{f.label}</span>
            <input
              id={`pin-${f.id}`}
              type="password"
              inputMode="numeric"
              autoComplete={f.auto}
              value={f.value}
              onChange={(e) => f.set(digits(e.target.value))}
              placeholder="••••"
              className="tnum w-32 rounded-lg border px-3 py-2 tracking-[0.4em]"
              style={field}
            />
          </label>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      )}
      {done && (
        <p className="mt-3 text-sm" style={{ color: "var(--good)" }}>
          PIN changed. Everyone will need the new one next time they unlock.
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-full px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        style={{ background: BEHAVIORS[0].color }}
      >
        {busy ? "Saving…" : "Change PIN"}
      </button>
    </form>
  );
}
