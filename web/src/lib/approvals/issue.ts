import type { SupabaseClient } from "@supabase/supabase-js";
import { issueApprovalToken } from "./token";

/** Creates a single-use, 72 h, version-bound approval link and records its hash. */
export async function createApprovalLink(admin: SupabaseClient, a: { draft: { id: string; workspace_id: string; version: number }; channel: "link" | "email"; baseUrl: string }) {
  const t = issueApprovalToken({ draftId: a.draft.id, draftVersion: a.draft.version, channel: a.channel, secret: process.env.APP_SECRET! });
  const { error } = await admin.from("approval_tokens").insert({ workspace_id: a.draft.workspace_id, draft_id: a.draft.id, draft_version: a.draft.version, channel: a.channel, token_hash: t.tokenHash, expires_at: t.expiresAt.toISOString() });
  if (error) throw error;
  return { url: `${a.baseUrl.replace(/\/$/, "")}/a/${t.token}`, expiresAt: t.expiresAt };
}
