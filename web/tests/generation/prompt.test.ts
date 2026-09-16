import { describe, it, expect } from "vitest";
import { buildGenerationPrompts } from "@/lib/generation/prompt";
import { draftOutputSchema } from "@/lib/generation/schema";
import { resolveSettings } from "@/lib/campaigns/settings";
const base = { brand: { name: "Beanpost", voiceProfile: "Voice: warm, witty." }, settings: resolveSettings({}, { platforms: ["x", "instagram"], candidatesPerSlot: 2 }), prompt: "Launch our coffee subscription", references: ["Image 1: a bag of coffee on a desk"], preferenceSummary: null, feedback: null };
describe("buildGenerationPrompts", () => {
  it("emits platforms × candidates bundles with platform limits in the user prompt", () => {
    const b = buildGenerationPrompts(base);
    expect(b).toHaveLength(4);
    const x = b.find((p) => p.platform === "x")!;
    expect(x.user).toContain("280 characters");
    expect(x.user).toContain("Beanpost");
    expect(x.system).toContain("warm, witty");
  });
  it("makes candidates deliberately different", () => {
    const [a, b] = buildGenerationPrompts(base).filter((p) => p.platform === "x");
    expect(a.user).not.toEqual(b.user);
    expect(b.user).toMatch(/different angle/i);
  });
  it("injects preference summary and hard instruction from feedback", () => {
    const b = buildGenerationPrompts({ ...base, preferenceSummary: "Prefers no emojis.", feedback: { recentEvents: [], positiveExamples: ["Monday, but make it Ethiopian."], negativeExamples: ["BUY NOW!!!"], hardInstruction: "Mention free shipping", requireChanges: false } });
    expect(b[0].system).toContain("Prefers no emojis.");
    expect(b[0].user).toContain("Mention free shipping");
    expect(b[0].user).toContain("Monday, but make it Ethiopian.");
    expect(b[0].user).toContain("BUY NOW!!!");
  });
  it("on bare regenerate demands at least two visible changes and change notes", () => {
    const b = buildGenerationPrompts({ ...base, feedback: { recentEvents: [{ action: "reject", note: "too salesy" }], positiveExamples: [], negativeExamples: [], requireChanges: true } });
    expect(b[0].user).toMatch(/change at least two/i);
    expect(b[0].user).toContain("changeNotes");
  });
  it("puts hashtags in firstComment for Instagram and clamps count to platform limits", () => {
    const b = buildGenerationPrompts({ ...base, settings: resolveSettings({}, { platforms: ["instagram", "x"], hashtagCount: 30 }) });
    expect(b.find((p) => p.platform === "instagram")!.user).toMatch(/Use 15 hashtags placed in firstComment/);
    expect(b.find((p) => p.platform === "x")!.user).toMatch(/Use 2 hashtags\./);
  });
});
describe("draftOutputSchema", () => {
  it("accepts a video media plan and rejects unknown kinds", () => {
    expect(draftOutputSchema.parse({ hook: "h", caption: "c", hashtags: ["#a"], firstComment: null, altText: null, mediaPlan: { kind: "video", scenes: [{ onScreenText: "t", voiceover: "v", visual: "desk" }] }, changeNotes: [] }).mediaPlan.kind).toBe("video");
    expect(() => draftOutputSchema.parse({ hook: "h", caption: "c", hashtags: [], firstComment: null, altText: null, mediaPlan: { kind: "hologram" }, changeNotes: [] })).toThrow();
  });
  it("fills defaults for optional arrays and nullables", () => {
    const d = draftOutputSchema.parse({ hook: "h", caption: "c", mediaPlan: { kind: "none" } });
    expect(d.hashtags).toEqual([]); expect(d.firstComment).toBeNull(); expect(d.changeNotes).toEqual([]);
  });
});
