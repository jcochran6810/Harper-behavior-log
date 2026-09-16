import "server-only";
import { db, PHOTO_BUCKET } from "./supabase";

/**
 * Batch-signs photo paths for display. The bucket is private, so every image
 * URL is short-lived — long enough to browse a page, short enough that a copied
 * link stops working quickly.
 */
export async function signPhotos(
  paths: string[],
  expiresInSeconds = 600,
): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return signed;

  const { data, error } = await db()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrls(unique, expiresInSeconds);

  if (error || !data) return signed;
  for (const row of data) {
    if (row.signedUrl && row.path) signed.set(row.path, row.signedUrl);
  }
  return signed;
}
