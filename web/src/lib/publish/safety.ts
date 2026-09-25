import * as gemini from "@/lib/ai/gemini";

export type SafetyCheck = (text: string) => Promise<{ issues: string[] }>;

/** Whole-word, case-insensitive matches of the brand's banned words. */
export function findBannedWords(text: string, banned: string[]): string[] {
  const lower = text.toLowerCase();
  return banned.map((b) => b.trim().toLowerCase()).filter(Boolean).filter((b) => new RegExp(`(^|[^\\p{L}\\p{N}])${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u").test(lower));
}

const SCHEMA = { type: "object", properties: { issues: { type: "array", items: { type: "string" } } }, required: ["issues"] };
const SYSTEM = "You review a social post before it is published. List only concrete problems: specific factual claims that cannot be verified from the text itself (numbers, awards, medical or financial promises, 'the best/first/only'), impersonation, and content most platforms' policies forbid. Ordinary enthusiasm is fine. Return JSON {\"issues\": string[]} with at most 3 short items, or an empty array.";

/** Gemini flags unverifiable factual claims and platform-policy problems. Returns [] for ordinary marketing copy. */
export const geminiSafetyCheck: SafetyCheck = (text) => gemini.generateJson<{ issues: string[] }>(SYSTEM, text, SCHEMA, (raw) => {
  const r = raw as { issues?: unknown };
  return { issues: Array.isArray(r.issues) ? r.issues.filter((s): s is string => typeof s === "string").slice(0, 3) : [] };
});

/** Banned words block deterministically; the model check blocks on issues and fails open on errors (an outage must not hold posts). */
export async function prePublishCheck(a: { text: string; bannedWords: string[]; check?: SafetyCheck }): Promise<{ ok: true } | { ok: false; reasons: string[] }> {
  const banned = findBannedWords(a.text, a.bannedWords);
  if (banned.length) return { ok: false, reasons: banned.map((b) => `Contains banned word "${b}".`) };
  try {
    const { issues } = await (a.check ?? geminiSafetyCheck)(a.text);
    return issues.length ? { ok: false, reasons: issues } : { ok: true };
  } catch { return { ok: true }; }
}
