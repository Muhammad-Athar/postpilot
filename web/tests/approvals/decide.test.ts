import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/drafts/actions", () => ({ applyDecision: vi.fn() }));
import { applyDecision } from "@/lib/drafts/actions";
import { decideFromToken } from "@/lib/approvals/decide";
import { issueApprovalToken } from "@/lib/approvals/token";

const SECRET = "s";
const draft = { id: "11111111-1111-4111-8111-111111111111", workspace_id: "w", campaign_id: "c", brand_id: "b", platform: "bluesky", candidate_index: 0, version: 1, hook: "h", caption: "c", hashtags: [], first_comment: null, alt_text: null, status: "draft" };
function admin() {
  const { token, tokenHash, expiresAt } = issueApprovalToken({ draftId: draft.id, draftVersion: 1, channel: "link", secret: SECRET });
  const tokenRow = { id: "t1", draft_id: draft.id, draft_version: 1, token_hash: tokenHash, expires_at: expiresAt.toISOString(), used_at: null as string | null };
  const updates: { table: string; data: Record<string, unknown> }[] = [];
  const rows: Record<string, unknown> = { drafts: draft, brands: { id: "b", name: "B", voice_profile: "" }, workspaces: { timezone: "UTC", cadence_rule: {} } };
  const db = { from: (table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "approval_tokens" ? tokenRow : null }), single: async () => ({ data: rows[table] ?? null }) }) }),
    update: (data: Record<string, unknown>) => { updates.push({ table, data }); if (table === "approval_tokens") tokenRow.used_at = (data.used_at as string | null); return { eq: async () => ({ error: null }) }; },
  }) } as never;
  return { db, token, updates, tokenRow };
}

describe("decideFromToken", () => {
  it("marks the token used and applies the decision", async () => {
    vi.mocked(applyDecision).mockResolvedValueOnce({ scheduledAt: "2026-10-01T05:00:00.000Z" });
    const { db, token, tokenRow } = admin();
    const r = await decideFromToken(db, token, SECRET, { action: "approve" });
    expect(r).toEqual({ ok: true, result: { scheduledAt: "2026-10-01T05:00:00.000Z" } });
    expect(tokenRow.used_at).not.toBeNull();
  });
  it("releases the token again when the decision fails, so the client can retry", async () => {
    vi.mocked(applyDecision).mockRejectedValueOnce(new Error("model unavailable"));
    const { db, token, tokenRow } = admin();
    const r = await decideFromToken(db, token, SECRET, { action: "reject", note: "shorter" });
    expect(r).toMatchObject({ ok: false, status: 500, reason: "model unavailable" });
    expect(tokenRow.used_at).toBeNull();
  });
  it("rejects a used token before touching the draft", async () => {
    const { db, token, tokenRow } = admin();
    tokenRow.used_at = new Date().toISOString();
    const before = vi.mocked(applyDecision).mock.calls.length;
    const r = await decideFromToken(db, token, SECRET, { action: "approve" });
    expect(r).toMatchObject({ ok: false, status: 410 });
    expect(vi.mocked(applyDecision).mock.calls.length).toBe(before);
  });
});
