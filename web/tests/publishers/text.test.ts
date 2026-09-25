import { describe, it, expect } from "vitest";
import { composeText, graphemeLength } from "@/lib/publishers/text";
describe("composeText", () => {
  it("appends hashtags with a blank line and a # prefix", () => {
    expect(composeText("Hello world", ["coffee", "#launch"], 300)).toBe("Hello world\n\n#coffee #launch");
  });
  it("trims the caption at a word boundary so the hashtags fit", () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    const out = composeText(long, ["a", "b"], 300);
    expect(graphemeLength(out)).toBeLessThanOrEqual(300);
    expect(out.endsWith("…\n\n#a #b")).toBe(true);
    expect(out).not.toMatch(/word\d*[a-z]…/);   // never mid-word
    expect(out).toMatch(/word\d+…/);            // ends on a whole word
  });
  it("drops hashtags rather than the whole caption when they alone don't fit", () => {
    expect(composeText("Short", Array.from({ length: 50 }, (_, i) => `tag${i}`), 40)).toBe("Short");
  });
  it("counts graphemes, not UTF-16 units", () => {
    expect(graphemeLength("👍🏽a")).toBe(2);
  });
});
