import { describe, it, expect } from "vitest";
import { publishSlot, type ClaimedSlot, type RunnerDeps } from "@/lib/publish/runner";
import { PublishError } from "@/lib/publishers/types";

const slot: ClaimedSlot = { id: "s1", workspace_id: "w", brand_id: "b", platform: "bluesky", draft_id: "d1", scheduled_at: new Date().toISOString(), attempts: 0 };
function harness(o: { publish?: () => Promise<{ externalId: string; permalink: string; warnings: string[] }>; account?: Record<string, unknown> | null; draft?: Record<string, unknown> }) {
  const writes: { table: string; data: Record<string, unknown> }[] = [];
  const rows: Record<string, unknown> = {
    drafts: o.draft ?? { id: "d1", version: 1, caption: "Hello", hashtags: ["a"], first_comment: null, alt_text: null, media_urls: [], status: "scheduled" },
    brands: { banned_words: [] },
    connected_accounts: o.account === undefined ? { id: "acc", platform: "bluesky", adapter: "native", tokens_encrypted: "sealed", external_id: "demo", status: "ok" } : o.account,
  };
  const admin = { from: (table: string) => {
    const q = { select: () => q, eq: () => q, single: async () => ({ data: rows[table] ?? null }), maybeSingle: async () => ({ data: rows[table] ?? null }),
      update: (data: Record<string, unknown>) => { writes.push({ table, data }); return q; }, insert: (data: Record<string, unknown>) => { writes.push({ table, data }); return q; }, then: (r: (v: unknown) => void) => r({ data: null, error: null }) };
    return q;
  } } as never;
  const deps: RunnerDeps = {
    getPublisher: () => ({ platform: "bluesky", publish: o.publish ?? (async () => ({ externalId: "at://x/3k", permalink: "https://bsky.app/profile/x/post/3k", warnings: [] })), fetchPostMetrics: async () => ({ likes: 0, reposts: 0, replies: 0 }), fetchAccountMetrics: async () => ({ followers: 0 }), healthcheck: async () => {} }),
    loadImages: async () => ({ images: [], warnings: [] }),
    safety: async () => ({ ok: true as const }),
    maxAttempts: 3,
  };
  return { admin, deps, writes };
}
const w = (h: ReturnType<typeof harness>, table: string) => h.writes.filter((x) => x.table === table).map((x) => x.data);

describe("publishSlot", () => {
  it("publishes, records the job, marks the draft published with permalink and the slot done", async () => {
    const h = harness({});
    expect(await publishSlot(h.admin, slot, h.deps)).toBe("published");
    expect(w(h, "publish_jobs").at(-1)).toMatchObject({ status: "published", external_id: "at://x/3k", permalink: "https://bsky.app/profile/x/post/3k" });
    expect(w(h, "drafts").at(-1)).toMatchObject({ status: "published", permalink: "https://bsky.app/profile/x/post/3k" });
    expect(w(h, "schedule_slots").at(-1)).toMatchObject({ status: "done" });
  });
  it("fails without an account and says so", async () => {
    const h = harness({ account: null });
    expect(await publishSlot(h.admin, slot, h.deps)).toBe("failed");
    expect(w(h, "drafts").at(-1)).toMatchObject({ status: "failed", publish_error: expect.stringMatching(/No Bluesky account is connected/) });
  });
  it("auth error → account reconnect, draft failed, no retry", async () => {
    const h = harness({ publish: async () => { throw new PublishError("bad token", "auth"); } });
    expect(await publishSlot(h.admin, slot, h.deps)).toBe("failed");
    expect(w(h, "connected_accounts").at(-1)).toMatchObject({ status: "reconnect" });
    expect(w(h, "drafts").at(-1)).toMatchObject({ status: "failed" });
  });
  it("transient error → retry with backoff until maxAttempts, then failed", async () => {
    const h = harness({ publish: async () => { throw new PublishError("502", "transient"); } });
    expect(await publishSlot(h.admin, slot, h.deps)).toBe("retry");
    const s = w(h, "schedule_slots").at(-1) as { status: string; scheduled_at: string };
    expect(s.status).toBe("filled");
    expect(new Date(s.scheduled_at).getTime()).toBeGreaterThan(Date.now() + 4 * 60e3);
    expect(await publishSlot(h.admin, { ...slot, attempts: 2 }, h.deps)).toBe("failed");
  });
  it("safety block → failed with the reasons, publisher never called", async () => {
    let called = false;
    const h = harness({ publish: async () => { called = true; return { externalId: "", permalink: "", warnings: [] }; } });
    h.deps.safety = async () => ({ ok: false, reasons: ["Unverifiable claim"] });
    expect(await publishSlot(h.admin, slot, h.deps)).toBe("failed");
    expect(called).toBe(false);
    expect(w(h, "drafts").at(-1)).toMatchObject({ publish_error: expect.stringMatching(/Safety check: Unverifiable claim/) });
  });
  it("stops when the draft is no longer scheduled (unscheduled meanwhile)", async () => {
    const h = harness({ draft: { id: "d1", status: "approved", caption: "x", hashtags: [], media_urls: [] } });
    expect(await publishSlot(h.admin, slot, h.deps)).toBe("failed");
    expect(w(h, "drafts")).toHaveLength(0);
  });
});
