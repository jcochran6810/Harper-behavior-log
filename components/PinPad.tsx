"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

export default function PinPad({ next }: { next: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (value: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: value }),
        });
        if (res.ok) {
          router.replace(next);
          router.refresh();
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Wrong PIN.");
        setPin("");
      } catch {
        setError("Couldn't reach the server. Check your connection.");
        setPin("");
      } finally {
        setBusy(false);
      }
    },
    [next, router],
  );

  useEffect(() => {
    if (pin.length === 4 && !busy) void submit(pin);
  }, [pin, busy, submit]);

  function press(key: string) {
    setError(null);
    if (key === "clear") return setPin("");
    if (key === "back") return setPin((p) => p.slice(0, -1));
    setPin((p) => (p.length >= 4 ? p : p + key));
  }

  return (
    <div className="w-full max-w-xs">
      <div className="mb-8 flex justify-center gap-4" aria-live="polite">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-4 w-4 rounded-full border-2 transition-colors"
            style={{
              borderColor: "var(--axis)",
              background: i < pin.length ? "var(--text-primary)" : "transparent",
            }}
          />
        ))}
      </div>

      <p
        className="mb-4 min-h-6 text-center text-sm"
        role="status"
        style={{ color: error ? "var(--critical)" : "var(--text-muted)" }}
      >
        {error ?? (busy ? "Checking…" : "Enter your 4-digit PIN")}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            disabled={busy}
            aria-label={key === "back" ? "Delete" : key === "clear" ? "Clear" : key}
            className="card flex h-16 items-center justify-center text-2xl font-medium active:scale-95 disabled:opacity-40"
            style={{ color: key.length === 1 ? "var(--text-primary)" : "var(--text-secondary)" }}
          >
            {key === "back" ? "⌫" : key === "clear" ? "✕" : key}
          </button>
        ))}
      </div>
    </div>
  );
}
