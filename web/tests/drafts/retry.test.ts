import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/ai/gemini", () => ({ embed: async () => null, generateJson: async () => { throw new Error("not used"); } }));
const scheduled = vi.fn(async () => new Date("2026-10-01T05:00:00Z"));
vi.mock("@/lib/schedule/schedule", () => ({ scheduleApprovedDraft: (...a: unknown[]) => scheduled(...(a as [])) }));
import { applyDecision, type DraftRecord } from "@/lib/drafts/actions";

const base: DraftRecord = { id: "d1", workspace_id: "w", campaign_id: "c", brand_id: "b", platform: "bluesky", candidate_index: 0, version: 1, hook: "h", caption: "c", hashtags: [], first_comment: null, alt_text: null, status: "failed" };
function admin() {
  const writes: { table: string; data: unknown }[] = [];
  const q = (table: string) => { const c: Record<string, unknown> = { select: () => c, eq: () => c, order: () => c, limit: () => c, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), insert: (d: unknown) => { writes.push({ table, data: d }); return c; }, update: (d: unknown) => { writes.push({ table, data: d }); return c; }, then: (r: (v: unknown) => void) => r({ data: [], count: 0, error: null }) }; return c; };
  return { admin: { from: q } as never, writes };
}
const ws = { timezone: "UTC", cadence_rule: {} };
describe("retry a failed publish", () => {
  it("clears the error and books a fresh slot for a failed draft", async () => {
    const { admin: a, writes } = admin();
    const r = await applyDecision(a, base, { id: "b", name: "B", voice_profile: "" }, { action: "retry" }, ws);
    expect(r.scheduledAt).toBe("2026-10-01T05:00:00.000Z");
    expect(writes.find((w) => w.table === "drafts")?.data).toEqual({ publish_error: null });
    expect(scheduled).toHaveBeenCalledTimes(1);
    expect(writes.some((w) => w.table === "feedback_events")).toBe(false);
  });
  it("refuses to retry a draft that is not failed", async () => {
    const { admin: a } = admin();
    await expect(applyDecision(a, { ...base, status: "draft" }, { id: "b", name: "B", voice_profile: "" }, { action: "retry" }, ws)).rejects.toMatchObject({ status: 409 });
  });
});
