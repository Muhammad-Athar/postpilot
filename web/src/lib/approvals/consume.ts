import type { SupabaseClient } from "@supabase/supabase-js";
import { hashToken, verifyApprovalToken } from "./token";
import type { DraftRecord } from "@/lib/drafts/actions";

export type Consumed = { ok: true; draft: DraftRecord; tokenRowId: string } | { ok: false; status: 404 | 410; reason: string };

/** Verifies signature + expiry, then the DB row (single use) and that the draft is still the same version and still in review.
 *  Does NOT mark the token used; the caller does after a successful decision. */
export async function consumeApprovalToken(admin: SupabaseClient, token: string, secret: string): Promise<Consumed> {
  const v = verifyApprovalToken(token, secret);
  if (!v) return { ok: false, status: 404, reason: "This link is invalid or has expired." };
  const { data: row } = await admin.from("approval_tokens").select("id, draft_id, draft_version, used_at").eq("token_hash", hashToken(token)).maybeSingle();
  if (!row || row.draft_id !== v.draftId) return { ok: false, status: 404, reason: "This link is invalid or has expired." };
  if (row.used_at) return { ok: false, status: 410, reason: "This link was already used." };
  const { data: d } = await admin.from("drafts").select("id, workspace_id, campaign_id, brand_id, platform, candidate_index, version, hook, caption, hashtags, first_comment, alt_text, status").eq("id", v.draftId).single();
  if (!d) return { ok: false, status: 404, reason: "This post no longer exists." };
  if (d.version !== v.draftVersion) return { ok: false, status: 410, reason: "This post was revised since the link was sent. Ask for a new link." };
  if (d.status !== "draft") return { ok: false, status: 410, reason: `This post was already ${d.status}.` };
  return { ok: true, draft: d as DraftRecord, tokenRowId: row.id };
}

export async function markTokenUsed(admin: SupabaseClient, tokenRowId: string) {
  await admin.from("approval_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenRowId);
}
