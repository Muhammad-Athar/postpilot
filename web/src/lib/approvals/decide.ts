import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeApprovalToken, markTokenUsed } from "./consume";
import { applyDecision } from "@/lib/drafts/actions";

export type TokenDecision = { action: "approve" | "reject"; note?: string };
export type Decided = { ok: true; result: { newDraftId?: string; scheduledAt?: string } } | { ok: false; status: number; reason: string };

/** Applies an approve/reject from an approval link. The token is leased (marked used) before the decision so two clicks
 *  cannot apply it twice, and released again if the decision fails so the client can retry. */
export async function decideFromToken(admin: SupabaseClient, token: string, secret: string, decision: TokenDecision): Promise<Decided> {
  const c = await consumeApprovalToken(admin, token, secret);
  if (!c.ok) return { ok: false, status: c.status, reason: c.reason };
  const [{ data: brand }, { data: ws }] = await Promise.all([
    admin.from("brands").select("id, name, voice_profile").eq("id", c.draft.brand_id).single(),
    admin.from("workspaces").select("timezone, cadence_rule").eq("id", c.draft.workspace_id).single(),
  ]);
  if (!brand || !ws) return { ok: false, status: 404, reason: "This post no longer exists." };
  await markTokenUsed(admin, c.tokenRowId);
  try {
    const result = await applyDecision(admin, c.draft, brand, { action: decision.action, note: decision.note }, { timezone: ws.timezone, cadence_rule: ws.cadence_rule });
    return { ok: true, result };
  } catch (e) {
    await admin.from("approval_tokens").update({ used_at: null }).eq("id", c.tokenRowId);
    return { ok: false, status: (e as { status?: number }).status ?? 500, reason: e instanceof Error ? e.message : "Failed" };
  }
}
