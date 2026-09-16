/** Browser-side image prep. Runs before upload so a 5MB phone photo doesn't
 *  have to travel, and so the model gets the resolution it reads best at. */

const MAX_EDGE = 1568; // Claude's sweet spot for detailed images
const QUALITY = 0.85;

export type PreparedImage = {
  /** base64 without the data: prefix */
  base64: string;
  mediaType: "image/jpeg";
  /** object URL for the on-screen preview; revoke when done */
  previewUrl: string;
  bytes: number;
};

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't process the photo. Try a different browser.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) throw new Error("Couldn't read that photo. Try taking it again.");

  return {
    base64: await blobToBase64(blob),
    mediaType: "image/jpeg",
    previewUrl: URL.createObjectURL(blob),
    bytes: blob.size,
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap applies EXIF orientation on modern browsers; the <img>
  // fallback covers older Safari.
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // The canvas has already read the pixels by the time this resolves.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that photo."));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}
