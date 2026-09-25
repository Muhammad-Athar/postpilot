export type SnapshotRow = { account_id: string; platform: string; draft_id: string | null; captured_at: string; metrics: { followers?: number; likes?: number; reposts?: number; replies?: number; views?: number } };
export type Aggregate = {
  tiles: { followers: number; likes: number; reposts: number; replies: number; posts: number };
  byPlatform: Record<string, { followers: number; likes: number; posts: number }>;
  topPost: { draftId: string; score: number } | null;
  lastSync: string | null;
};

/** Latest snapshot per account (followers) and per post (engagement), summed; top post by likes + 2·reposts + 3·replies. */
export function aggregate(rows: SnapshotRow[]): Aggregate {
  const latestAccount = new Map<string, SnapshotRow>(); const latestPost = new Map<string, SnapshotRow>();
  let lastSync: string | null = null;
  for (const r of rows) {
    const map = r.draft_id ? latestPost : latestAccount; const key = r.draft_id ?? r.account_id;
    const cur = map.get(key); if (!cur || cur.captured_at < r.captured_at) map.set(key, r);
    if (!lastSync || r.captured_at > lastSync) lastSync = r.captured_at;
  }
  const tiles = { followers: 0, likes: 0, reposts: 0, replies: 0, posts: latestPost.size };
  const byPlatform: Aggregate["byPlatform"] = {};
  const bp = (p: string) => (byPlatform[p] ??= { followers: 0, likes: 0, posts: 0 });
  for (const r of latestAccount.values()) { tiles.followers += r.metrics.followers ?? 0; bp(r.platform).followers += r.metrics.followers ?? 0; }
  let topPost: Aggregate["topPost"] = null;
  for (const r of latestPost.values()) {
    const m = r.metrics; tiles.likes += m.likes ?? 0; tiles.reposts += m.reposts ?? 0; tiles.replies += m.replies ?? 0;
    bp(r.platform).likes += m.likes ?? 0; bp(r.platform).posts += 1;
    const score = (m.likes ?? 0) + 2 * (m.reposts ?? 0) + 3 * (m.replies ?? 0);
    if (!topPost || score > topPost.score) topPost = { draftId: r.draft_id!, score };
  }
  return { tiles, byPlatform, topPost, lastSync };
}
