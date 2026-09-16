import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { safeEqual } from "./session";
import { db } from "./supabase";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const PIN_KEY = "pin_hash";
const KEY_LENGTH = 32;

export const PIN_PATTERN = /^\d{4}$/;

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function matchesHash(pin: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(pin, Buffer.from(saltB64, "base64"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function storedHash(): Promise<string | null> {
  const { data } = await db()
    .from("harper_settings")
    .select("value")
    .eq("key", PIN_KEY)
    .maybeSingle();
  return data?.value ?? null;
}

/** True when the PIN has been changed in the app (rather than left at APP_PIN). */
export async function pinIsCustom(): Promise<boolean> {
  return (await storedHash()) !== null;
}

/**
 * Checks a PIN against the one stored in the database, falling back to the
 * APP_PIN environment variable until someone sets one in Settings.
 */
export async function checkPin(pin: string): Promise<boolean> {
  const stored = await storedHash();
  if (stored) return matchesHash(pin, stored);

  const envPin = process.env.APP_PIN;
  return Boolean(envPin) && safeEqual(pin, envPin as string);
}

export async function setPin(pin: string): Promise<void> {
  const { error } = await db()
    .from("harper_settings")
    .upsert(
      { key: PIN_KEY, value: await hashPin(pin), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
}
