import { describe, it, expect } from "vitest";
import { prePublishCheck, findBannedWords } from "@/lib/publish/safety";
describe("pre-publish safety", () => {
  it("finds banned words case-insensitively as whole words", () => {
    expect(findBannedWords("Our Cheapest ever deal, cheapskate", ["cheapest", "free"])).toEqual(["cheapest"]);
  });
  it("blocks on banned words without calling the model", async () => {
    let called = false;
    const r = await prePublishCheck({ text: "guaranteed results", bannedWords: ["guaranteed"], check: async () => { called = true; return { issues: [] }; } });
    expect(r).toEqual({ ok: false, reasons: ['Contains banned word "guaranteed".'] });
    expect(called).toBe(false);
  });
  it("blocks on model-flagged issues and passes clean text", async () => {
    expect(await prePublishCheck({ text: "We cured 100% of customers", bannedWords: [], check: async () => ({ issues: ["Unverifiable medical claim: cured 100%"] }) })).toEqual({ ok: false, reasons: ["Unverifiable medical claim: cured 100%"] });
    expect(await prePublishCheck({ text: "New blend this week", bannedWords: [], check: async () => ({ issues: [] }) })).toEqual({ ok: true });
  });
  it("fails open when the model errors, so an outage never blocks a scheduled post", async () => {
    expect(await prePublishCheck({ text: "x", bannedWords: [], check: async () => { throw new Error("503"); } })).toEqual({ ok: true });
  });
});
