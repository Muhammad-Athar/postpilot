import { describe, it, expect } from "vitest";
import { PLATFORM_RULES, PLATFORMS } from "@/lib/platforms/rules";
describe("PLATFORM_RULES", () => {
  it("covers all platforms with sane limits", () => {
    for (const p of PLATFORMS) {
      const r = PLATFORM_RULES[p];
      expect(r.captionMax).toBeGreaterThan(0);
      expect(r.hashtagMax).toBeGreaterThanOrEqual(r.hashtagMin);
      expect(["native", "late"]).toContain(r.adapter);
    }
  });
  it("knows X is short and Instagram uses first-comment hashtags", () => {
    expect(PLATFORM_RULES.x.captionMax).toBe(280);
    expect(PLATFORM_RULES.instagram.firstCommentHashtags).toBe(true);
  });
});
