import { describe, it, expect } from "vitest";
import { buildFeedbackContext, diffEdits } from "@/lib/preferences/context";
const ev = (action: "approve"|"edit"|"reject"|"regenerate", i: number) => ({ action, note: action === "reject" ? `too long ${i}` : null, edit_diff: null, snapshot: { hook: `h${i}`, caption: `c${i}` }, created_at: new Date(2026, 0, i + 1).toISOString() });
describe("buildFeedbackContext", () => {
  it("keeps only the last 20 events, newest first, and sets flags", () => {
    const events = Array.from({ length: 30 }, (_, i) => ev(i % 2 ? "reject" : "approve", i));
    const ctx = buildFeedbackContext({ events, positives: ["p"], negatives: ["n"], bare: true });
    expect(ctx.recentEvents).toHaveLength(20);
    expect(ctx.recentEvents[0].note).toBe("too long 29");
    expect(ctx.requireChanges).toBe(true);
    expect(ctx.hardInstruction).toBeUndefined();
  });
  it("turns a note into a hard instruction and disables inferred changes", () => {
    const ctx = buildFeedbackContext({ events: [], positives: [], negatives: [], note: "mention free shipping", bare: false });
    expect(ctx.hardInstruction).toBe("mention free shipping");
    expect(ctx.requireChanges).toBe(false);
  });
});
describe("diffEdits", () => {
  it("records only changed fields", () => {
    const d = diffEdits({ hook: "a", caption: "b", hashtags: ["#x"], firstComment: null, altText: null }, { hook: "a", caption: "B!", hashtags: ["#x", "#y"], firstComment: null, altText: null });
    expect(Object.keys(d)).toEqual(["caption", "hashtags"]);
    expect(d.caption).toEqual({ from: "b", to: "B!" });
  });
});
