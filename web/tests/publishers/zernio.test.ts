import { describe, it, expect, afterEach, vi } from "vitest";
import { mockFetch, json } from "../helpers/fetch-mock";
import { createZernioPublisher, listZernioAccounts, ZERNIO_PLATFORM } from "@/lib/publishers/zernio";
afterEach(() => vi.unstubAllGlobals());
const a = { apiKey: "sk_test", accountId: "66b2e19d8c3f5a7e9d0b1c2e", platform: "x" as const };
const input = { draftId: "d1", platform: "x" as const, text: "Hello", images: [], mediaUrls: ["https://own.supabase.co/storage/v1/object/public/media/a.png"], altText: null, firstComment: null };

describe("zernio adapter", () => {
  it("maps platform names", () => {
    expect(ZERNIO_PLATFORM.x).toBe("twitter"); expect(ZERNIO_PLATFORM.youtube).toBe("youtube"); expect(ZERNIO_PLATFORM.mastodon).toBeNull();
  });
  it("lists accounts with the bearer key", async () => {
    const m = mockFetch({ "/v1/accounts": () => json({ accounts: [{ _id: "1", platform: "twitter", username: "@acme", isActive: true }] }) });
    expect(await listZernioAccounts("sk_test")).toEqual([{ id: "1", platform: "twitter", username: "@acme", isActive: true }]);
    expect((m.calls[0].init?.headers as Record<string, string>).authorization).toBe("Bearer sk_test");
  });
  it("publishes now with media URLs and an idempotency key, returns the platform post url", async () => {
    const m = mockFetch({ "/v1/posts": () => json({ post: { _id: "p1", status: "published", platforms: [{ platform: "twitter", accountId: a.accountId, status: "published", platformPostUrl: "https://x.com/acme/status/1" }] } }, 201) });
    const r = await createZernioPublisher(a).publish(input);
    expect(r).toEqual({ externalId: "p1", permalink: "https://x.com/acme/status/1", warnings: [] });
    expect(m.json(0)).toEqual({ content: "Hello", mediaItems: [{ type: "image", url: input.mediaUrls[0] }], platforms: [{ platform: "twitter", accountId: a.accountId }], publishNow: true });
    expect((m.calls[0].init?.headers as Record<string, string>)["idempotency-key"]).toBe("d1");
  });
  it("polls until the post leaves 'publishing'", async () => {
    let polls = 0;
    mockFetch({
      "/v1/posts/p1": () => { polls++; return json({ post: { _id: "p1", status: polls < 2 ? "publishing" : "published", platforms: [{ platform: "twitter", status: polls < 2 ? "publishing" : "published", platformPostUrl: polls < 2 ? undefined : "https://x.com/acme/status/2" }] } }); },
      "/v1/posts": () => json({ post: { _id: "p1", status: "publishing", platforms: [{ platform: "twitter", status: "publishing" }] } }, 201),
    });
    const r = await createZernioPublisher({ ...a, pollDelayMs: 1 }).publish(input);
    expect(r.permalink).toBe("https://x.com/acme/status/2"); expect(polls).toBe(2);
  });
  it("maps 401 → auth, 429 → transient, failed platform status → permanent with the reason", async () => {
    mockFetch({ "/v1/posts": () => json({ error: "invalid key" }, 401) });
    await expect(createZernioPublisher(a).publish(input)).rejects.toMatchObject({ kind: "auth" });
    mockFetch({ "/v1/posts": () => json({ error: "slow down" }, 429) });
    await expect(createZernioPublisher(a).publish(input)).rejects.toMatchObject({ kind: "transient" });
    mockFetch({ "/v1/posts": () => json({ post: { _id: "p2", status: "failed", platforms: [{ platform: "twitter", status: "failed", error: "Media too large" }] } }, 207) });
    await expect(createZernioPublisher(a).publish(input)).rejects.toMatchObject({ kind: "permanent", message: expect.stringMatching(/Media too large/) });
  });
  it("returns zero metrics when analytics are unavailable instead of throwing", async () => {
    mockFetch({ "/v1/analytics/": () => json({ error: "add-on required" }, 402) });
    expect(await createZernioPublisher(a).fetchPostMetrics("p1")).toEqual({ likes: 0, reposts: 0, replies: 0 });
  });
});
