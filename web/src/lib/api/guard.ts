import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/** Returns a 401 response when the shared n8n secret is missing or wrong; undefined when OK. Fails closed if APP_SECRET is unset. */
export function requireSecret(req: Request): NextResponse | undefined {
  const expected = process.env.APP_SECRET;
  const given = req.headers.get("x-postpilot-secret") ?? "";
  if (!expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}

export const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
