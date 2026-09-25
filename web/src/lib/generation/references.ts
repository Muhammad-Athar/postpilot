import type { Reference } from "@/lib/campaigns/create";
import { safeFetch } from "@/lib/net/safe-fetch";

type Ai = { describeMedia: (url: string) => Promise<string>; summariseText: (t: string) => Promise<string> };

/** Fetches a public page through the SSRF guard (2 MB cap) and strips it to text. */
export async function fetchPageText(url: string): Promise<string> {
  const { bytes, status } = await safeFetch(url, { maxBytes: 2 * 1024 * 1024 });
  if (status >= 400) throw new Error(`Fetch failed with ${status}`);
  const html = bytes.toString("utf8");
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** One line of context per reference, in input order. Never throws: unreadable references become placeholders. */
export async function summariseReferences(refs: Reference[], ai: Ai, fetchText: (u: string) => Promise<string> = fetchPageText): Promise<string[]> {
  return Promise.all(
    refs.map(async (r, i) => {
      const label = r.kind === "url" ? `Link ${i + 1} (${r.url})` : `${r.kind === "image" ? "Image" : "Video"} ${i + 1}`;
      try {
        const body = r.kind === "url" ? await ai.summariseText(await fetchText(r.url)) : await ai.describeMedia(r.url);
        return `${label}: ${body}`;
      } catch {
        return `${label}: (could not be read)`;
      }
    }),
  );
}
