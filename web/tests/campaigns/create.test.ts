import { describe, it, expect } from "vitest";
import { createCampaign } from "@/lib/campaigns/create";
describe("createCampaign", () => {
  it("resolves settings and inserts a queued campaign", async () => {
    const rows: unknown[] = [];
    const db = { from: () => ({ insert: (r: unknown) => { rows.push(r); return { select: () => ({ single: async () => ({ data: { id: "c1", ...(r as object) }, error: null }) }) }; } }) } as never;
    const out = await createCampaign(db, { workspaceId: "w", brandId: "b", prompt: "Launch our coffee subscription", references: [{ kind: "url", url: "https://example.com" }], overrides: { platforms: ["bluesky"], postsCount: 2 }, defaults: { tone: "witty" } });
    expect(out.id).toBe("c1");
    expect(out.settings.platforms).toEqual(["bluesky"]);
    expect(rows[0]).toMatchObject({ workspace_id: "w", brand_id: "b", status: "queued" });
  });
  it("rejects media references outside our storage, javascript: URLs, and oversized prompts", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    const db = { from: () => ({ insert: (r: unknown) => ({ select: () => ({ single: async () => ({ data: { id: "c1", ...(r as object) }, error: null }) }) }) }) } as never;
    const base = { workspaceId: "w", brandId: "b", overrides: { platforms: ["x"] }, defaults: {} };
    await expect(createCampaign(db, { ...base, prompt: "ok", references: [{ kind: "image", url: "https://evil.example/a.png" }] })).rejects.toThrow(/uploaded/);
    await expect(createCampaign(db, { ...base, prompt: "ok", references: [{ kind: "url", url: "javascript:alert(1)" }] })).rejects.toThrow();
    await expect(createCampaign(db, { ...base, prompt: "x".repeat(4001), references: [] })).rejects.toThrow();
    await expect(createCampaign(db, { ...base, prompt: "ok", references: [{ kind: "image", url: "https://abc.supabase.co/storage/v1/object/public/media/w/refs/a.png" }] })).resolves.toMatchObject({ id: "c1" });
  });
  it("rejects an empty prompt", async () => {
    await expect(createCampaign({} as never, { workspaceId: "w", brandId: "b", prompt: "  ", references: [], overrides: { platforms: ["x"] }, defaults: {} })).rejects.toThrow();
  });
});
