import { describe, it, expect } from "vitest";
import { seal, open } from "@/lib/publishers/credentials";
describe("credential sealing", () => {
  it("round-trips and rejects tampering or a wrong secret", () => {
    const s = seal({ handle: "a.bsky.social", appPassword: "xxxx-yyyy" }, "secret-one");
    expect(open(s, "secret-one")).toEqual({ handle: "a.bsky.social", appPassword: "xxxx-yyyy" });
    expect(() => open(s, "secret-two")).toThrow();
    expect(() => open(s.slice(0, -4) + "AAAA", "secret-one")).toThrow();
    expect(s).not.toContain("xxxx-yyyy");
  });
});
