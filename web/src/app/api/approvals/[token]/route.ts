import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { decideFromToken } from "@/lib/approvals/decide";

const body = z.object({ action: z.enum(["approve", "reject"]), note: z.string().max(1000).optional() });

/** Login-free decision from an approval link. The token is verified, single-use and bound to the draft version. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (typeof token !== "string" || token.length > 600) return NextResponse.json({ error: "bad token" }, { status: 400 });
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const r = await decideFromToken(createAdminSupabase(), token, process.env.APP_SECRET!, parsed.data);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: r.status });
  return NextResponse.json({ ok: true, ...r.result });
}
