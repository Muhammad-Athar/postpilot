import { describe, it, expect } from "vitest";
import { issueApprovalToken, verifyApprovalToken } from "@/lib/approvals/token";
const now = new Date("2026-09-17T00:00:00Z");
describe("approval tokens", () => {
  it("round-trips and expires after 72h", () => {
    const t = issueApprovalToken({ draftId: "d1", draftVersion: 2, channel: "email", secret: "k", now });
    expect(verifyApprovalToken(t.token, "k", now)).toEqual({ draftId: "d1", draftVersion: 2 });
    expect(verifyApprovalToken(t.token, "k", new Date(now.getTime() + 73 * 3600e3))).toBeNull();
    expect(t.expiresAt.toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });
  it("rejects tampering, garbage and wrong secrets", () => {
    const t = issueApprovalToken({ draftId: "d1", draftVersion: 1, channel: "email", secret: "k", now });
    expect(verifyApprovalToken(t.token, "other", now)).toBeNull();
    const [p, sig] = t.token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), d: "d2" })).toString("base64url");
    expect(verifyApprovalToken(`${forged}.${sig}`, "k", now)).toBeNull();
    expect(verifyApprovalToken("not-a-token", "k", now)).toBeNull();
  });
});
