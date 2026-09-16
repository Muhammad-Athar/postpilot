import { describe, it, expect } from "vitest";
import { requireSecret } from "@/lib/api/guard";
describe("requireSecret", () => {
  it("rejects a missing or wrong secret and accepts the right one", () => {
    process.env.APP_SECRET = "s3cret";
    expect(requireSecret(new Request("http://x", { headers: {} }))?.status).toBe(401);
    expect(requireSecret(new Request("http://x", { headers: { "x-postpilot-secret": "nope" } }))?.status).toBe(401);
    expect(requireSecret(new Request("http://x", { headers: { "x-postpilot-secret": "s3cret" } }))).toBeUndefined();
  });
  it("fails closed when APP_SECRET is unset", () => {
    delete process.env.APP_SECRET;
    expect(requireSecret(new Request("http://x", { headers: { "x-postpilot-secret": "" } }))?.status).toBe(401);
  });
});
