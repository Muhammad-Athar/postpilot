import { describe, it, expect } from "vitest";
import { canTransition } from "@/lib/drafts/state";
describe("canTransition", () => {
  it.each([["draft","approved",true],["draft","rejected",true],["approved","scheduled",true],["scheduled","published",true],["scheduled","failed",true],["failed","scheduled",true],["draft","published",false],["published","draft",false],["rejected","approved",false]] as const)("%s → %s = %s", (a, b, ok) => expect(canTransition(a, b)).toBe(ok));
});
