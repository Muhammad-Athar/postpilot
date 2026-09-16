import { describe, it, expect } from "vitest";
import { shouldResummarise, summariseFeedback } from "@/lib/preferences/summary";
describe("preference summary", () => {
  it("resummarises every 10 events", () => {
    expect(shouldResummarise(10)).toBe(true); expect(shouldResummarise(20)).toBe(true); expect(shouldResummarise(13)).toBe(false); expect(shouldResummarise(0)).toBe(false);
  });
  it("feeds previous summary and events to the model and returns its text", async () => {
    let seen = "";
    const ai = { generateText: async (p: string) => { seen = p; return "Prefers short hooks."; } };
    const out = await summariseFeedback([{ action: "reject", note: "too salesy", edit_diff: null, snapshot: { hook: "BUY", caption: "now" }, created_at: "2026-01-01" }], "Old summary.", ai);
    expect(out).toBe("Prefers short hooks.");
    expect(seen).toContain("Old summary."); expect(seen).toContain("too salesy");
  });
});
