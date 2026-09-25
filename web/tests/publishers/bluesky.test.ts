import { describe, it, expect, afterEach, vi } from "vitest";
import { mockFetch, json } from "../helpers/fetch-mock";
import { createBlueskyPublisher, buildFacets } from "@/lib/publishers/bluesky";
afterEach(() => vi.unstubAllGlobals());
const creds = { handle: "demo.bsky.social", appPassword: "aaaa-bbbb-cccc-dddd" };
const base = { draftId: "d", platform: "bluesky" as const, mediaUrls: [], altText: null, firstComment: null };

describe("bluesky adapter", () => {
  it("creates a session, uploads images, posts with link/tag facets and returns a bsky.app permalink", async () => {
    const m = mockFetch({
      "com.atproto.server.createSession": () => json({ accessJwt: "jwt", did: "did:plc:abc", handle: "demo.bsky.social" }),
      "com.atproto.repo.uploadBlob": () => json({ blob: { $type: "blob", ref: { $link: "bafy" }, mimeType: "image/png", size: 3 } }),
      "com.atproto.repo.createRecord": () => json({ uri: "at://did:plc:abc/app.bsky.feed.post/3kxyz", cid: "bafycid" }),
    });
    const r = await createBlueskyPublisher(creds).publish({ ...base, text: "Hello https://example.com #coffee", images: [{ bytes: Buffer.from("img"), contentType: "image/png", alt: "a cup" }], altText: "a cup" });
    expect(r).toEqual({ externalId: "at://did:plc:abc/app.bsky.feed.post/3kxyz", permalink: "https://bsky.app/profile/demo.bsky.social/post/3kxyz", warnings: [] });
    const rec = m.json(2).record;
    expect(rec.$type).toBe("app.bsky.feed.post");
    expect(rec.embed.images[0].alt).toBe("a cup");
    expect(rec.facets.map((f: { features: { $type: string }[] }) => f.features[0].$type)).toEqual(["app.bsky.richtext.facet#link", "app.bsky.richtext.facet#tag"]);
    expect(m.calls[1].init?.headers).toMatchObject({ "content-type": "image/png", authorization: "Bearer jwt" });
  });
  it("maps a 401 on login to an auth error", async () => {
    mockFetch({ "createSession": () => json({ error: "AuthenticationRequired" }, 401) });
    await expect(createBlueskyPublisher(creds).healthcheck()).rejects.toMatchObject({ kind: "auth" });
  });
  it("maps 5xx and 429 to transient", async () => {
    mockFetch({ "createSession": () => json({ accessJwt: "jwt", did: "did:plc:abc", handle: "demo.bsky.social" }), "createRecord": () => json({ error: "x" }, 502) });
    await expect(createBlueskyPublisher(creds).publish({ ...base, text: "t", images: [] })).rejects.toMatchObject({ kind: "transient" });
  });
  it("reads post metrics from the public API and follower count from the profile", async () => {
    mockFetch({
      "app.bsky.feed.getPosts": () => json({ posts: [{ likeCount: 3, repostCount: 1, replyCount: 2, quoteCount: 1 }] }),
      "createSession": () => json({ accessJwt: "jwt", did: "did:plc:abc", handle: "demo.bsky.social" }),
      "app.bsky.actor.getProfile": () => json({ followersCount: 42 }),
    });
    const p = createBlueskyPublisher(creds);
    expect(await p.fetchPostMetrics("at://did:plc:abc/app.bsky.feed.post/3kxyz")).toEqual({ likes: 3, reposts: 2, replies: 2 });
    expect(await p.fetchAccountMetrics()).toEqual({ followers: 42 });
  });
});
describe("buildFacets", () => {
  it("uses UTF-8 byte offsets", () => {
    const f = buildFacets("héllo #tag");
    expect(f[0].index).toEqual({ byteStart: 7, byteEnd: 11 });
  });
});
