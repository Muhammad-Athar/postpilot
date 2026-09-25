import { describe, it, expect } from "vitest";
import { validateProfileInput, validatePasswordInput } from "@/lib/auth/validators";
describe("validateProfileInput", () => {
  it("accepts a sane profile and trims", () => {
    expect(validateProfileInput({ displayName: "  Ada  ", email: "ada@example.com" })).toEqual({ ok: true, value: { displayName: "Ada", email: "ada@example.com" } });
  });
  it("rejects short names and bad emails", () => {
    expect(validateProfileInput({ displayName: "A", email: "ada@example.com" }).ok).toBe(false);
    expect(validateProfileInput({ displayName: "Ada", email: "not-an-email" }).ok).toBe(false);
    expect(validateProfileInput({ displayName: "x".repeat(61), email: "a@b.co" }).ok).toBe(false);
  });
});
describe("validatePasswordInput", () => {
  it("requires 8+ chars, a match, and a change", () => {
    expect(validatePasswordInput({ current: "oldpass1", next: "newpass12", confirm: "newpass12" }).ok).toBe(true);
    expect(validatePasswordInput({ current: "oldpass1", next: "short", confirm: "short" }).ok).toBe(false);
    expect(validatePasswordInput({ current: "oldpass1", next: "newpass12", confirm: "different" }).ok).toBe(false);
    expect(validatePasswordInput({ current: "same1234", next: "same1234", confirm: "same1234" }).ok).toBe(false);
  });
});
