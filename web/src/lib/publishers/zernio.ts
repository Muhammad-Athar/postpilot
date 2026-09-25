import type { Platform } from "@/lib/platforms/rules";
import { PublishError, type MetricSet, type Publisher, type PublishInput, type PublishResult } from "./types";

/** Zernio (formerly Late, getlate.dev) aggregator. Base + auth per docs.zernio.com, verified 2026-09-26. */
const BASE = "https://zernio.com/api/v1";
export const ZERNIO_PLATFORM: Record<Platform, string | null> = { x: "twitter", tiktok: "tiktok", youtube: "youtube", linkedin: "linkedin", threads: "threads", pinterest: "pinterest", bluesky: "bluesky", instagram: null, facebook: null, mastodon: null };
export const zernioApiKey = () => process.env.ZERNIO_API_KEY || process.env.LATE_API_KEY || undefined;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function classify(status: number, body: string): PublishError {
  if (status === 401 || status === 403) return new PublishError("Zernio rejected the API key. Check ZERNIO_API_KEY.", "auth");
  if (status === 429 || status >= 500) return new PublishError(`Zernio is rate-limiting or unavailable (HTTP ${status}). Will retry.`, "transient");
  if (status === 409) return new PublishError("Zernio refused a duplicate: identical content went to this account in the last 24 hours.", "permanent");
  return new PublishError(`Zernio refused the request (HTTP ${status}): ${body.slice(0, 200)}`, "permanent");
}
async function api<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try { r = await fetch(`${BASE}${path}`, { ...init, headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) }, signal: AbortSignal.timeout(25000) }); }
  catch (e) { throw new PublishError(`Zernio unreachable: ${e instanceof Error ? e.message : e}`, "transient"); }
  const text = await r.text();
  if (!r.ok && r.status !== 207) throw classify(r.status, text);
  return JSON.parse(text) as T;
}

export async function listZernioAccounts(apiKey: string) {
  const r = await api<{ accounts?: { _id: string; platform: string; username: string; isActive: boolean }[] }>(apiKey, "/accounts");
  return (r.accounts ?? []).map((x) => ({ id: x._id, platform: x.platform, username: x.username, isActive: x.isActive }));
}

type ZPlatform = { platform: string; accountId?: string; status: string; platformPostUrl?: string; error?: string };
type ZPost = { _id: string; status: string; platforms: ZPlatform[] };
const mediaType = (u: string) => (/\.(mp4|mov|webm|m4v)(\?|$)/i.test(u) ? "video" : "image");

export function createZernioPublisher(a: { apiKey: string; accountId: string; platform: Platform; pollDelayMs?: number }): Publisher {
  const zp = ZERNIO_PLATFORM[a.platform];
  if (!zp) throw new Error(`${a.platform} is not published through Zernio`);
  /** Resolved result, or null while Zernio is still working on it. */
  const settle = (post: ZPost): PublishResult | null => {
    const mine = post.platforms.find((p) => p.platform === zp) ?? post.platforms[0];
    if (!mine) throw new PublishError("Zernio returned no platform result.", "permanent");
    if (mine.status === "published") return { externalId: post._id, permalink: mine.platformPostUrl ?? "", warnings: mine.platformPostUrl ? [] : ["Zernio did not return a post URL yet."] };
    if (mine.status === "failed" || post.status === "failed") throw new PublishError(`Zernio could not publish: ${mine.error ?? "unknown error"}`, /disconnect|reconnect|token|auth/i.test(mine.error ?? "") ? "auth" : "permanent");
    return null;
  };
  return {
    platform: a.platform,
    async healthcheck() {
      const accts = await listZernioAccounts(a.apiKey);
      if (!accts.some((x) => x.id === a.accountId && x.isActive)) throw new PublishError("This account is no longer connected in Zernio.", "auth");
    },
    async publish(input: PublishInput): Promise<PublishResult> {
      const body = { content: input.text, mediaItems: input.mediaUrls.map((url) => ({ type: mediaType(url), url })), platforms: [{ platform: zp, accountId: a.accountId }], publishNow: true };
      const r = await api<{ post: ZPost }>(a.apiKey, "/posts", { method: "POST", headers: { "idempotency-key": input.draftId }, body: JSON.stringify(body) });
      let done = settle(r.post);
      for (let i = 0; !done && i < 8; i++) {
        await sleep(a.pollDelayMs ?? 2500);
        const g = await api<{ post: ZPost }>(a.apiKey, `/posts/${encodeURIComponent(r.post._id)}`);
        done = settle(g.post);
      }
      return done ?? { externalId: r.post._id, permalink: "", warnings: ["Zernio is still publishing; the link will appear after the next analytics sync."] };
    },
    async fetchPostMetrics(postId: string): Promise<MetricSet> {
      try {
        const m = await api<Record<string, number>>(a.apiKey, `/analytics/${zp}/posts/${encodeURIComponent(postId)}`);
        return { likes: m.likes ?? 0, reposts: m.shares ?? m.reposts ?? 0, replies: m.comments ?? 0, views: m.impressions ?? m.views };
      } catch (e) {
        if (e instanceof PublishError && e.kind === "auth") throw e;
        return { likes: 0, reposts: 0, replies: 0 };
      }
    },
    async fetchAccountMetrics() { return { followers: 0 }; },
  };
}
