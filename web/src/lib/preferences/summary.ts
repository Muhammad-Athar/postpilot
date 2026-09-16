import type { FeedbackEventRow } from "./context";

export const shouldResummarise = (eventCount: number): boolean => eventCount > 0 && eventCount % 10 === 0;

export async function summariseFeedback(
  events: FeedbackEventRow[],
  previous: string,
  ai: { generateText: (prompt: string) => Promise<string> },
): Promise<string> {
  const lines = events
    .map((e) => `${e.action}${e.note ? ` ("${e.note}")` : ""}${e.edit_diff ? ` edits=${JSON.stringify(e.edit_diff)}` : ""}: "${e.snapshot.hook}" / "${e.snapshot.caption.slice(0, 120)}"`)
    .join("\n");
  const prompt = `You maintain a short profile of what a brand owner likes and dislikes in social posts.

Previous profile:
${previous || "(none)"}

New feedback events (newest last):
${lines}

Rewrite the profile as one paragraph (max 120 words) of concrete, actionable preferences: hooks, length, emojis, tone, formats, topics, CTAs. Keep still-valid points from the previous profile. Output only the paragraph.`;
  return (await ai.generateText(prompt)).trim();
}
