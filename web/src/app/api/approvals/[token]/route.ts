import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { consumeApprovalToken, markTokenUsed } from "@/lib/approvals/consume";
import { applyDecision } from "@/lib/drafts/actions";

const body = z.object({ action: z.enum(["approve", "reject"]), note: z.string().max(1000).optional() });

/** Login-free decision from an approval link. The token is verified, single-use and bound to the draft version. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (typeof token !== "string" || token.length > 600) return NextResponse.json({ error: "bad token" }, { status: 400 });
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const admin = createAdminSupabase();
  const c = await consumeApprovalToken(admin, token, process.env.APP_SECRET!);
  if (!c.ok) return NextResponse.json({ error: c.reason }, { status: c.status });
  const [{ data: brand }, { data: ws }] = await Promise.all([
    admin.from("brands").select("id, name, voice_profile").eq("id", c.draft.brand_id).single(),
    admin.from("workspaces").select("timezone, cadence_rule").eq("id", c.draft.workspace_id).single(),
  ]);
  if (!brand || !ws) return NextResponse.json({ error: "not found" }, { status: 404 });
  await markTokenUsed(admin, c.tokenRowId);
  try {
    const r = await applyDecision(admin, c.draft, brand, { action: parsed.data.action, note: parsed.data.note }, { timezone: ws.timezone, cadence_rule: ws.cadence_rule });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: (e as { status?: number }).status ?? 500 });
  }
}
