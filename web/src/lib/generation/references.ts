import type { Reference } from "@/lib/campaigns/create";

type Ai = { describeMedia: (url: string) => Promise<string>; summariseText: (t: string) => Promise<string> };

export async function fetchPageText(url: string): Promise<string> {
  const html = await (await fetch(url, { headers: { "user-agent": "PostpilotBot/1.0" } })).text();
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
