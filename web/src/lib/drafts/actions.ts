import type { SupabaseClient } from "@supabase/supabase-js";
import { canTransition, type DraftStatus } from "@/lib/drafts/state";
import { buildFeedbackContext, diffEdits, type Editable, type FeedbackEventRow } from "@/lib/preferences/context";
import { shouldResummarise, summariseFeedback } from "@/lib/preferences/summary";
import { buildGenerationPrompts } from "@/lib/generation/prompt";
import { draftOutputSchema, RESPONSE_JSON_SCHEMA } from "@/lib/generation/schema";
import { resolveSettings } from "@/lib/campaigns/settings";
import * as gemini from "@/lib/ai/gemini";
import type { Platform } from "@/lib/platforms/rules";
import { scheduleApprovedDraft } from "@/lib/schedule/schedule";
import type { CadenceRule } from "@/lib/schedule/slots";

export type DraftRecord = {
  id: string; workspace_id: string; campaign_id: string; brand_id: string; platform: Platform; candidate_index: number; version: number;
  hook: string; caption: string; hashtags: string[]; first_comment: string | null; alt_text: string | null; status: DraftStatus;
};
type BrandCtx = { id: string; name: string; voice_profile: string };
export type Decision = { action: "approve" | "edit" | "reject" | "regenerate"; note?: string; edits?: Editable };

/** Applies a review decision: records the feedback event, moves state, and (for reject/regenerate) produces the next version inline. */
export async function applyDecision(admin: SupabaseClient, d: DraftRecord, brand: BrandCtx, body: Decision, workspace?: { timezone: string; cadence_rule: CadenceRule }): Promise<{ newDraftId?: string; scheduledAt?: string }> {
  const before: Editable = { hook: d.hook, caption: d.caption, hashtags: d.hashtags, firstComment: d.first_comment, altText: d.alt_text };
  const snapshot = { hook: d.hook, caption: d.caption };
  const embedding = await gemini.embed(`${d.hook}\n${d.caption}`).catch(() => null);
  const event = (action: Decision["action"], extra: Record<string, unknown> = {}) =>
    admin.from("feedback_events").insert({ workspace_id: d.workspace_id, brand_id: d.brand_id, draft_id: d.id, action, snapshot, embedding, ...extra });

  if (body.action === "edit") {
    if (!body.edits) throw new Error("edits missing");
    const diff = diffEdits(before, body.edits);
    await admin.from("drafts").update({ hook: body.edits.hook, caption: body.edits.caption, hashtags: body.edits.hashtags, first_comment: body.edits.firstComment, alt_text: body.edits.altText }).eq("id", d.id);
    if (Object.keys(diff).length) await event("edit", { edit_diff: diff });
    await maintainSummary(admin, d);
    return {};
  }

  const to: DraftStatus = body.action === "approve" ? "approved" : "rejected";
  if (!canTransition(d.status, to)) throw Object.assign(new Error(`cannot ${body.action} a ${d.status} draft`), { status: 409 });

  // For reject/regenerate, produce the replacement FIRST so a model failure leaves the original untouched.
  let replacement: { row: Record<string, unknown> } | null = null;
  if (body.action === "reject" || body.action === "regenerate") {
    const { data: events } = await admin.from("feedback_events").select("action, note, edit_diff, snapshot, created_at").eq("brand_id", d.brand_id).order("created_at", { ascending: false }).limit(20);
    const nearest = async (action: "approve" | "reject") => {
      if (!embedding) return [] as string[];
      const { data } = await admin.rpc("nearest_feedback", { p_brand: d.brand_id, p_action: action, p_embedding: embedding, p_limit: 3 });
      return ((data ?? []) as { snapshot: { caption: string } }[]).map((r) => r.snapshot.caption);
    };
    const pending = { action: body.action, note: body.note?.trim() || null, edit_diff: null, snapshot, created_at: new Date().toISOString() } as FeedbackEventRow;
    const ctx = buildFeedbackContext({ events: [pending, ...((events ?? []) as FeedbackEventRow[])], positives: await nearest("approve"), negatives: [snapshot.caption, ...(await nearest("reject"))], note: body.note, bare: body.action === "regenerate" });
    const { data: c } = await admin.from("campaigns").select("prompt, settings").eq("id", d.campaign_id).single();
    const { data: ps } = await admin.from("preference_summaries").select("summary").eq("brand_id", d.brand_id).maybeSingle();
    const [bundle] = buildGenerationPrompts({ brand: { name: brand.name, voiceProfile: brand.voice_profile }, settings: resolveSettings({}, c!.settings), prompt: c!.prompt, references: [], preferenceSummary: ps?.summary || null, feedback: ctx, platforms: [d.platform], candidatesPerSlot: 1 });
    const out = await gemini.generateJson(bundle.system, bundle.user, RESPONSE_JSON_SCHEMA, (raw) => draftOutputSchema.parse(raw));
    const newEmbedding = await gemini.embed(`${out.hook}\n${out.caption}`).catch(() => null);
    replacement = { row: { workspace_id: d.workspace_id, campaign_id: d.campaign_id, brand_id: d.brand_id, platform: d.platform, candidate_index: d.candidate_index, version: d.version + 1, parent_draft_id: d.id, hook: out.hook, caption: out.caption, hashtags: out.hashtags, first_comment: out.firstComment, alt_text: out.altText, media_plan: out.mediaPlan, change_notes: out.changeNotes, embedding: newEmbedding } };
  }

  await admin.from("drafts").update({ status: to }).eq("id", d.id);
  await event(body.action, { note: body.note?.trim() || null });
  let scheduledAt: string | undefined;
  if (body.action === "approve" && workspace) {
    scheduledAt = (await scheduleApprovedDraft(admin, d, workspace)).toISOString();
  }
  let newDraftId: string | undefined;
  if (replacement) {
    const { data: nd, error } = await admin.from("drafts").insert(replacement.row).select("id").single();
    if (error) throw error;
    newDraftId = nd.id;
  }
  await maintainSummary(admin, d);
  return { newDraftId, scheduledAt };
}

/** Every 10 feedback events per brand, rewrite the preference summary from the latest 10. */
async function maintainSummary(admin: SupabaseClient, d: { brand_id: string; workspace_id: string }) {
  const { count } = await admin.from("feedback_events").select("id", { count: "exact", head: true }).eq("brand_id", d.brand_id);
  if (!shouldResummarise(count ?? 0)) return;
  const { data: last } = await admin.from("feedback_events").select("action, note, edit_diff, snapshot, created_at").eq("brand_id", d.brand_id).order("created_at", { ascending: false }).limit(10);
  const { data: ps } = await admin.from("preference_summaries").select("summary").eq("brand_id", d.brand_id).maybeSingle();
  const summary = await summariseFeedback(((last ?? []) as FeedbackEventRow[]).reverse(), ps?.summary ?? "", gemini).catch(() => null);
  if (summary) await admin.from("preference_summaries").upsert({ brand_id: d.brand_id, workspace_id: d.workspace_id, summary, event_count: count ?? 0, updated_at: new Date().toISOString() });
}
