import { describe, it, expect } from "vitest";
import { issueApprovalToken } from "@/lib/approvals/token";
import { consumeApprovalToken } from "@/lib/approvals/consume";

const SECRET = "test-secret";
const draft = { id: "11111111-1111-4111-8111-111111111111", workspace_id: "w", campaign_id: "c", brand_id: "b", platform: "bluesky", candidate_index: 0, version: 2, hook: "h", caption: "c", hashtags: [], first_comment: null, alt_text: null, status: "draft" };
function admin(tokenRow: Record<string, unknown> | null, draftRow = draft) {
  return { from: (table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "approval_tokens" ? tokenRow : null }), single: async () => ({ data: table === "drafts" ? draftRow : null }) }) }),
    update: () => ({ eq: async () => ({ error: null }) }),
  }) } as never;
}

describe("consumeApprovalToken", () => {
  const { token, tokenHash, expiresAt } = issueApprovalToken({ draftId: draft.id, draftVersion: 2, channel: "email", secret: SECRET });
  const row = { id: "t1", draft_id: draft.id, draft_version: 2, token_hash: tokenHash, expires_at: expiresAt.toISOString(), used_at: null };
  it("accepts a fresh token bound to the current version", async () => {
    const r = await consumeApprovalToken(admin(row), token, SECRET);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tokenRowId).toBe("t1");
  });
  it("rejects a bad signature", async () => {
    const r = await consumeApprovalToken(admin(row), token.slice(0, -2) + "zz", SECRET);
    expect(r).toMatchObject({ ok: false, status: 404 });
  });
  it("rejects a used token", async () => {
    const r = await consumeApprovalToken(admin({ ...row, used_at: new Date().toISOString() }), token, SECRET);
    expect(r).toMatchObject({ ok: false, status: 410, reason: expect.stringMatching(/already/) });
  });
  it("rejects when the draft moved to a newer version or left review", async () => {
    expect(await consumeApprovalToken(admin(row, { ...draft, version: 3 }), token, SECRET)).toMatchObject({ ok: false, status: 410 });
    expect(await consumeApprovalToken(admin(row, { ...draft, status: "approved" }), token, SECRET)).toMatchObject({ ok: false, status: 410 });
  });
  it("rejects an unknown hash", async () => {
    expect(await consumeApprovalToken(admin(null), token, SECRET)).toMatchObject({ ok: false, status: 404 });
  });
});
