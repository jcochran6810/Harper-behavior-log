"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LockButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/lock", { method: "POST" });
        router.replace("/unlock");
        router.refresh();
      }}
      className="rounded-full border px-5 py-2.5 text-sm font-medium disabled:opacity-50"
      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
    >
      {busy ? "Locking…" : "Lock this device"}
    </button>
  );
}
