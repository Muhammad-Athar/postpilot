import { PublishError, type MetricSet, type Publisher, type PublishInput, type PublishResult } from "./types";

const PDS = "https://bsky.social/xrpc";
const PUBLIC = "https://public.api.bsky.app/xrpc";
type Session = { accessJwt: string; did: string; handle: string };
type Facet = { index: { byteStart: number; byteEnd: number }; features: ({ $type: "app.bsky.richtext.facet#link"; uri: string } | { $type: "app.bsky.richtext.facet#tag"; tag: string })[] };

const enc = new TextEncoder();
const byteLen = (s: string) => enc.encode(s).length;

/** Link and hashtag facets with UTF-8 byte offsets, as the AT Protocol requires. */
export function buildFacets(text: string): Facet[] {
  const out: Facet[] = [];
  for (const m of text.matchAll(/https?:\/\/[^\s)]+/g)) {
    const start = byteLen(text.slice(0, m.index));
    out.push({ index: { byteStart: start, byteEnd: start + byteLen(m[0]) }, features: [{ $type: "app.bsky.richtext.facet#link", uri: m[0] }] });
  }
  for (const m of text.matchAll(/(^|\s)(#[\p{L}\p{N}_]+)/gu)) {
    const tagStart = (m.index ?? 0) + m[1].length; const start = byteLen(text.slice(0, tagStart));
    out.push({ index: { byteStart: start, byteEnd: start + byteLen(m[2]) }, features: [{ $type: "app.bsky.richtext.facet#tag", tag: m[2].slice(1) }] });
  }
  return out.sort((a, b) => a.index.byteStart - b.index.byteStart);
}

function classify(status: number, body: string): PublishError {
  if (status === 401 || status === 403 || /AuthenticationRequired|InvalidToken|ExpiredToken/.test(body)) return new PublishError("Bluesky rejected the app password. Reconnect the account.", "auth");
  if (status === 429 || status >= 500) return new PublishError(`Bluesky is unavailable (HTTP ${status}). Will retry.`, "transient");
  return new PublishError(`Bluesky refused the post (HTTP ${status}): ${body.slice(0, 200)}`, "permanent");
}
async function xrpc<T>(url: string, init: RequestInit): Promise<T> {
  let r: Response;
  try { r = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) }); }
  catch (e) { throw new PublishError(`Bluesky unreachable: ${e instanceof Error ? e.message : e}`, "transient"); }
  const text = await r.text();
  if (!r.ok) throw classify(r.status, text);
  return JSON.parse(text) as T;
}

export function createBlueskyPublisher(creds: { handle: string; appPassword: string }): Publisher {
  let session: Session | null = null;
  const login = async (): Promise<Session> => session ??= await xrpc<Session>(`${PDS}/com.atproto.server.createSession`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: creds.handle, password: creds.appPassword }) });
  return {
    platform: "bluesky",
    async healthcheck() { await login(); },
    async publish(input: PublishInput): Promise<PublishResult> {
      const s = await login();
      const images: { image: unknown; alt: string }[] = [];
      for (const im of input.images.slice(0, 4)) {
        const up = await xrpc<{ blob: unknown }>(`${PDS}/com.atproto.repo.uploadBlob`, { method: "POST", headers: { "content-type": im.contentType, authorization: `Bearer ${s.accessJwt}` }, body: new Uint8Array(im.bytes) });
        images.push({ image: up.blob, alt: im.alt || input.altText || "" });
      }
      const record: Record<string, unknown> = { $type: "app.bsky.feed.post", text: input.text, createdAt: new Date().toISOString(), langs: ["en"] };
      const facets = buildFacets(input.text); if (facets.length) record.facets = facets;
      if (images.length) record.embed = { $type: "app.bsky.embed.images", images };
      const res = await xrpc<{ uri: string; cid: string }>(`${PDS}/com.atproto.repo.createRecord`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${s.accessJwt}` }, body: JSON.stringify({ repo: s.did, collection: "app.bsky.feed.post", record }) });
      const rkey = res.uri.split("/").pop()!;
      return { externalId: res.uri, permalink: `https://bsky.app/profile/${s.handle}/post/${rkey}`, warnings: [] };
    },
    async fetchPostMetrics(uri: string): Promise<MetricSet> {
      const r = await xrpc<{ posts: { likeCount?: number; repostCount?: number; replyCount?: number; quoteCount?: number }[] }>(`${PUBLIC}/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`, { method: "GET" });
      const p = r.posts[0] ?? {};
      return { likes: p.likeCount ?? 0, reposts: (p.repostCount ?? 0) + (p.quoteCount ?? 0), replies: p.replyCount ?? 0 };
    },
    async fetchAccountMetrics() {
      const s = await login();
      const r = await xrpc<{ followersCount?: number }>(`${PUBLIC}/app.bsky.actor.getProfile?actor=${encodeURIComponent(s.did)}`, { method: "GET" });
      return { followers: r.followersCount ?? 0 };
    },
  };
}
