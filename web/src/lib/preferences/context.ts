import type { FeedbackContext } from "@/lib/generation/prompt";

export type Editable = { hook: string; caption: string; hashtags: string[]; firstComment: string | null; altText: string | null };
export type EditDiff = Partial<Record<keyof Editable, { from: unknown; to: unknown }>>;
export type FeedbackEventRow = {
  action: "approve" | "edit" | "reject" | "regenerate";
  note: string | null;
  edit_diff: EditDiff | null;
  snapshot: { hook: string; caption: string };
  created_at: string;
};

export function diffEdits(before: Editable, after: Editable): EditDiff {
  const out: EditDiff = {};
  for (const k of Object.keys(before) as (keyof Editable)[]) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) out[k] = { from: before[k], to: after[k] };
  }
  return out;
}

/** Last 20 events newest-first; a note becomes a hard instruction; a bare regenerate demands inferred changes. */
export function buildFeedbackContext(a: { events: FeedbackEventRow[]; positives: string[]; negatives: string[]; note?: string; bare: boolean }): FeedbackContext {
  const recentEvents = [...a.events]
    .sort((x, y) => y.created_at.localeCompare(x.created_at))
    .slice(0, 20)
    .map((e) => ({ action: e.action, note: e.note ?? undefined, editDiff: e.edit_diff ?? undefined }));
  const note = a.note?.trim();
  return { recentEvents, positiveExamples: a.positives, negativeExamples: a.negatives, hardInstruction: note || undefined, requireChanges: a.bare && !note };
}
