import { describe, it, expect } from "vitest";
import { buildVoiceProfile } from "@/lib/brand/voice-profile";
const kit = { tagline: "Coffee that ships itself", description: "Monthly specialty coffee subscription", audience: "remote workers 25-40", toneWords: ["warm", "witty"], colors: ["#3B2F2F"], fonts: ["Inter"], samplePosts: ["Monday, but make it Ethiopian.", "Your desk deserves better beans."], hashtagSets: ["#specialtycoffee #wfh"] };
describe("buildVoiceProfile", () => {
  it("includes tone, audience, samples and banned words", () => {
    const v = buildVoiceProfile(kit, ["cheap"]);
    expect(v).toContain("warm, witty");
    expect(v).toContain("remote workers 25-40");
    expect(v).toContain("Monday, but make it Ethiopian.");
    expect(v).toContain("Never use: cheap");
  });
  it("handles an empty kit without throwing", () => {
    expect(buildVoiceProfile({ tagline: "", description: "", audience: "", toneWords: [], colors: [], fonts: [], samplePosts: [], hashtagSets: [] }, [])).toContain("Voice:");
  });
});
