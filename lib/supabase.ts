import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Never import this into a client component — the key
 * bypasses RLS, and RLS is the only thing standing between this data and the
 * public internet.
 */
export function db() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them in Vercel → Settings → Environment Variables.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const PHOTO_BUCKET = "harper-logs";
