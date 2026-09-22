/** Browser-side image prep. Runs before upload so a 5MB phone photo doesn't
 *  have to travel, and so the model gets the resolution it reads best at. */

const MAX_EDGE = 1568; // Claude's sweet spot for detailed images
const QUALITY = 0.85;

/**
 * A second, larger copy is kept in memory purely to cut row crops out of.
 *
 * The page the model reads is 1568px on its long edge, which puts a row of the
 * ten-row table at about a hundred pixels tall — not enough to tell seven marks
 * from eight. Crops are cut from this larger copy instead, so each row arrives
 * at the reader as big as the API will take it. It never leaves the browser.
 */
const DETAIL_EDGE = 3000;
const CROP_MAX_EDGE = 1568;
const CROP_QUALITY = 0.92;

/** How much of a row's own height to include above and below it, so a glyph
 *  sitting on the ruled line isn't sliced in half. The reader is told that
 *  anything cut off at the very edge belongs to the neighbouring row. */
const CROP_PAD = 0.12;

export type DetailSource = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

export type PreparedImage = {
  /** base64 without the data: prefix */
  base64: string;
  mediaType: "image/jpeg";
  /** object URL for the on-screen preview; revoke when done */
  previewUrl: string;
  bytes: number;
  /** Larger in-memory copy for cutting row crops; null if it couldn't be made. */
  detail: DetailSource | null;
};

export type RowCropImage = {
  image: string;
  mediaType: "image/jpeg";
};

function drawScaled(
  bitmap: ImageBitmap | HTMLImageElement,
  maxEdge: number,
): HTMLCanvasElement | null {
  const srcW = "width" in bitmap ? bitmap.width : 0;
  const srcH = "height" in bitmap ? bitmap.height : 0;
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(srcW * scale));
  canvas.height = Math.max(1, Math.round(srcH * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await loadBitmap(file);

  const pageCanvas = drawScaled(bitmap, MAX_EDGE);
  if (!pageCanvas) {
    throw new Error("This browser can't process the photo. Try a different browser.");
  }

  // Only worth keeping a detail copy when it is actually bigger than the page copy.
  const longEdge = Math.max(bitmap.width, bitmap.height);
  let detail: DetailSource | null = null;
  if (longEdge > MAX_EDGE * 1.2) {
    const detailCanvas = drawScaled(bitmap, DETAIL_EDGE);
    if (detailCanvas) {
      detail = {
        canvas: detailCanvas,
        width: detailCanvas.width,
        height: detailCanvas.height,
      };
    }
  }

  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    pageCanvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) throw new Error("Couldn't read that photo. Try taking it again.");

  return {
    base64: await blobToBase64(blob),
    mediaType: "image/jpeg",
    previewUrl: URL.createObjectURL(blob),
    bytes: blob.size,
    detail,
  };
}

/**
 * Cut one row out of the detail copy, as a fraction-addressed band.
 *
 * All coordinates are fractions of the whole image, which is how the row grid is
 * stored, so this works the same on any size of original.
 */
export function cropRow(
  detail: DetailSource,
  band: { top: number; bottom: number },
  left: number,
  right: number,
): RowCropImage | null {
  const pad = (band.bottom - band.top) * CROP_PAD;
  const top = Math.max(0, band.top - pad);
  const bottom = Math.min(1, band.bottom + pad);

  const sx = Math.max(0, Math.round(left * detail.width));
  const sw = Math.min(detail.width - sx, Math.round((right - left) * detail.width));
  const sy = Math.round(top * detail.height);
  const sh = Math.min(detail.height - sy, Math.round((bottom - top) * detail.height));
  if (sw < 8 || sh < 8) return null;

  const scale = Math.min(1, CROP_MAX_EDGE / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // White behind the crop: a JPEG has no alpha, and grey fringes read as marks.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(detail.canvas, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const url = canvas.toDataURL("image/jpeg", CROP_QUALITY);
  const comma = url.indexOf(",");
  if (comma < 0) return null;
  return { image: url.slice(comma + 1), mediaType: "image/jpeg" };
}

/** Let go of the detail copy once the review is finished with it. */
export function releaseDetail(detail: DetailSource | null): void {
  if (!detail) return;
  detail.canvas.width = 0;
  detail.canvas.height = 0;
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
