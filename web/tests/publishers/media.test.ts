import { describe, it, expect, vi } from "vitest";
import { loadImages } from "@/lib/publishers/media";
vi.mock("@/lib/net/safe-fetch", () => ({
  isOwnStorageUrl: (u: string) => u.startsWith("https://own.supabase.co/storage/"),
  safeFetch: async (u: string) => u.includes("big") ? { bytes: Buffer.alloc(1_000_001), contentType: "image/jpeg", status: 200 } : { bytes: Buffer.from("img"), contentType: "image/png", status: 200 },
}));
describe("loadImages", () => {
  it("loads own-storage images and skips oversize or foreign ones with warnings", async () => {
    const r = await loadImages(["https://own.supabase.co/storage/a.png", "https://own.supabase.co/storage/big.jpg", "https://evil.example/x.png"], { maxBytes: 1_000_000, maxCount: 4 });
    expect(r.images).toHaveLength(1);
    expect(r.images[0].contentType).toBe("image/png");
    expect(r.warnings).toEqual([expect.stringMatching(/big\.jpg.*1000 KB/), expect.stringMatching(/evil\.example.*not on Postpilot storage/)]);
  });
  it("caps the count", async () => {
    const r = await loadImages(Array.from({ length: 6 }, (_, i) => `https://own.supabase.co/storage/${i}.png`), { maxBytes: 1_000_000, maxCount: 4 });
    expect(r.images).toHaveLength(4);
    expect(r.warnings).toEqual([expect.stringMatching(/only the first 4/)]);
  });
  it("ignores video urls entirely", async () => {
    const r = await loadImages(["https://own.supabase.co/storage/clip.mp4"], { maxBytes: 1_000_000, maxCount: 4 });
    expect(r.images).toHaveLength(0); expect(r.warnings).toEqual([]);
  });
});
