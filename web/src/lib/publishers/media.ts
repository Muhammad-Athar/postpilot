import { isOwnStorageUrl, safeFetch } from "@/lib/net/safe-fetch";
import type { LoadedImage } from "./types";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const isVideo = (u: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);

/** Downloads images that live on our own Storage bucket. Skips, with a warning, anything foreign, oversize, non-image or beyond `maxCount`. Video URLs are ignored (they belong to the render pipeline). */
export async function loadImages(urls: string[], o: { maxBytes: number; maxCount: number }): Promise<{ images: LoadedImage[]; warnings: string[] }> {
  const images: LoadedImage[] = []; const warnings: string[] = [];
  const candidates = urls.filter((u) => !isVideo(u));
  if (candidates.length > o.maxCount) warnings.push(`This platform takes ${o.maxCount} images; only the first ${o.maxCount} were attached.`);
  for (const url of candidates.slice(0, o.maxCount)) {
    const name = url.split("/").pop()?.split("?")[0] ?? url;
    let host = url; try { host = new URL(url).host; } catch { /* keep raw */ }
    if (!isOwnStorageUrl(url)) { warnings.push(`${host}/${name} skipped: not on Postpilot storage.`); continue; }
    try {
      const r = await safeFetch(url, { maxBytes: o.maxBytes + 1, timeoutMs: 15000 });
      if (r.status !== 200) { warnings.push(`${name} skipped: HTTP ${r.status}.`); continue; }
      if (r.bytes.length > o.maxBytes) { warnings.push(`${name} skipped: larger than ${Math.round(o.maxBytes / 1000)} KB.`); continue; }
      const ct = r.contentType.split(";")[0].trim();
      if (!IMAGE_TYPES.includes(ct)) { warnings.push(`${name} skipped: ${ct || "unknown type"} is not an image.`); continue; }
      images.push({ bytes: r.bytes, contentType: ct, alt: "" });
    } catch (e) { warnings.push(`${name} skipped: ${e instanceof Error ? e.message : "download failed"}.`); }
  }
  return { images, warnings };
}
