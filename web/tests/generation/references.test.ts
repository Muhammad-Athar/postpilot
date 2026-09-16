import { describe, it, expect } from "vitest";
import { summariseReferences } from "@/lib/generation/references";
describe("summariseReferences", () => {
  it("describes images and videos through the vision model and pages through the fetcher", async () => {
    const ai = { describeMedia: async (url: string) => `desc of ${url}`, summariseText: async (t: string) => `sum:${t.slice(0, 5)}` };
    const fetchText = async () => "Hello world page text";
    const out = await summariseReferences([{ kind: "image", url: "https://a/i.png" }, { kind: "url", url: "https://a/page" }], ai, fetchText);
    expect(out).toEqual(["Image 1: desc of https://a/i.png", "Link 2 (https://a/page): sum:Hello"]);
  });
  it("degrades to a placeholder when a reference cannot be read", async () => {
    const ai = { describeMedia: async () => { throw new Error("boom"); }, summariseText: async () => "" };
    const out = await summariseReferences([{ kind: "video", url: "https://a/v.mp4" }], ai, async () => "");
    expect(out[0]).toMatch(/^Video 1: \(could not be read\)/);
  });
});
