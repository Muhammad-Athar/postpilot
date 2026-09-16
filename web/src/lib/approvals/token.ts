import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Signed, expiring, version-bound token for login-free approval links. Store only tokenHash. */
export function issueApprovalToken(a: { draftId: string; draftVersion: number; channel: string; secret: string; now?: Date; ttlHours?: number }) {
  const now = a.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (a.ttlHours ?? 72) * 3600e3);
  const payload = b64(JSON.stringify({ d: a.draftId, v: a.draftVersion, c: a.channel, e: expiresAt.getTime() }));
  const token = `${payload}.${sign(payload, a.secret)}`;
  return { token, tokenHash: hashToken(token), expiresAt };
}

export function verifyApprovalToken(token: string, secret: string, now = new Date()): { draftId: string; draftVersion: number } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload, secret);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof p.e !== "number" || p.e < now.getTime() || typeof p.d !== "string" || typeof p.v !== "number") return null;
    return { draftId: p.d, draftVersion: p.v };
  } catch {
    return null;
  }
}
