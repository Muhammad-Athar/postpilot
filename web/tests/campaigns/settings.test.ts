import { describe, it, expect } from "vitest";
import { resolveSettings } from "@/lib/campaigns/settings";
describe("resolveSettings", () => {
  it("applies defaults then overrides", () => {
    const s = resolveSettings({ platforms: ["instagram"], tone: "witty" }, { platforms: ["x", "bluesky"], postsCount: 2 });
    expect(s.platforms).toEqual(["x", "bluesky"]);
    expect(s.tone).toBe("witty");
    expect(s.postsCount).toBe(2);
    expect(s.candidatesPerSlot).toBe(2);
  });
  it("rejects unknown platforms and empty platform lists", () => {
    expect(() => resolveSettings({}, { platforms: ["myspace"] })).toThrow();
    expect(() => resolveSettings({}, { platforms: [] })).toThrow();
  });
  it("ignores undefined override keys", () => {
    const s = resolveSettings({ platforms: ["bluesky"], hashtagCount: 8 }, { hashtagCount: undefined });
    expect(s.hashtagCount).toBe(8);
  });
});
