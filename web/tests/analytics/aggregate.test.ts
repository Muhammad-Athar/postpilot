import { describe, it, expect } from "vitest";
import { aggregate, type SnapshotRow } from "@/lib/analytics/aggregate";
const rows: SnapshotRow[] = [
  { account_id: "a1", platform: "bluesky", draft_id: null, captured_at: "2026-09-26T00:00:00Z", metrics: { followers: 40 } },
  { account_id: "a1", platform: "bluesky", draft_id: null, captured_at: "2026-09-27T00:00:00Z", metrics: { followers: 42 } },
  { account_id: "a1", platform: "bluesky", draft_id: "d1", captured_at: "2026-09-26T00:00:00Z", metrics: { likes: 1, reposts: 0, replies: 0 } },
  { account_id: "a1", platform: "bluesky", draft_id: "d1", captured_at: "2026-09-27T00:00:00Z", metrics: { likes: 5, reposts: 1, replies: 2 } },
  { account_id: "a2", platform: "mastodon", draft_id: "d2", captured_at: "2026-09-27T00:00:00Z", metrics: { likes: 2, reposts: 0, replies: 0 } },
  { account_id: "a2", platform: "mastodon", draft_id: null, captured_at: "2026-09-27T00:00:00Z", metrics: { followers: 10 } },
];
describe("aggregate", () => {
  it("uses the latest snapshot per account and per post, sums across platforms, ranks the top post", () => {
    const r = aggregate(rows);
    expect(r.tiles).toEqual({ followers: 52, likes: 7, reposts: 1, replies: 2, posts: 2 });
    expect(r.byPlatform.bluesky).toEqual({ followers: 42, likes: 5, posts: 1 });
    expect(r.topPost).toEqual({ draftId: "d1", score: 5 + 2 * 1 + 3 * 2 });
    expect(r.lastSync).toBe("2026-09-27T00:00:00Z");
  });
  it("handles no data", () => { const r = aggregate([]); expect(r.topPost).toBeNull(); expect(r.lastSync).toBeNull(); });
});
