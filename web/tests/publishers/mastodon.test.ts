import { describe, it, expect, vi } from "vitest";
import { createMastodonPublisher } from "@/lib/publishers/mastodon";
const calls: { url: string; opts: Record<string, unknown> }[] = [];
vi.mock("@/lib/net/safe-fetch", () => ({
  safeFetch: async (url: string, opts: Record<string, unknown>) => {
    calls.push({ url, opts });
    const ok = (b: unknown, status = 200) => ({ status, contentType: "application/json", bytes: Buffer.from(JSON.stringify(b)) });
    if (url.endsWith("/api/v2/media")) return ok({ id: "m1" }, 202);
    if (url.endsWith("/api/v1/statuses")) return ok({ id: "109", url: "https://mastodon.social/@demo/109" });
    if (url.endsWith("/api/v1/statuses/109")) return ok({ favourites_count: 4, reblogs_count: 1, replies_count: 0 });
    if (url.endsWith("/api/v1/accounts/verify_credentials")) return url.includes("dead.example") ? ok({ error: "invalid" }, 401) : ok({ id: "1", username: "demo", followers_count: 10 });
    return ok({ error: "nope" }, 404);
  },
}));
const creds = { instance: "https://mastodon.social", accessToken: "tok" };
describe("mastodon adapter", () => {
  it("uploads media as multipart, posts a status with media_ids, returns the status url", async () => {
    calls.length = 0;
    const r = await createMastodonPublisher(creds).publish({ draftId: "d", platform: "mastodon", text: "Hi #CoffeeTime", images: [{ bytes: Buffer.from("img"), contentType: "image/png", alt: "cup" }], mediaUrls: [], altText: "cup", firstComment: null });
    expect(r).toEqual({ externalId: "109", permalink: "https://mastodon.social/@demo/109", warnings: [] });
    expect(calls[0].url).toBe("https://mastodon.social/api/v2/media");
    expect((calls[0].opts.headers as Record<string, string>)["content-type"]).toMatch(/multipart\/form-data; boundary=/);
    expect(Buffer.from(calls[0].opts.body as Uint8Array).toString("latin1")).toMatch(/name="description"\r\n\r\ncup/);
    expect(JSON.parse(String(calls[1].opts.body))).toEqual({ status: "Hi #CoffeeTime", media_ids: ["m1"], visibility: "public" });
    expect((calls[1].opts.headers as Record<string, string>).authorization).toBe("Bearer tok");
  });
  it("reads metrics and followers", async () => {
    const p = createMastodonPublisher(creds);
    expect(await p.fetchPostMetrics("109")).toEqual({ likes: 4, reposts: 1, replies: 0 });
    expect(await p.fetchAccountMetrics()).toEqual({ followers: 10 });
  });
  it("maps 401 to an auth error", async () => {
    await expect(createMastodonPublisher({ instance: "https://dead.example", accessToken: "x" }).healthcheck()).rejects.toMatchObject({ kind: "auth" });
  });
});
