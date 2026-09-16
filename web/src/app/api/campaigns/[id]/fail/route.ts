import { NextResponse } from "next/server";
import { requireSecret, isUuid } from "@/lib/api/guard";
import { createAdminSupabase } from "@/lib/supabase/admin";

/** n8n error-branch callback. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireSecret(req); if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const { stage, error } = await req.json().catch(() => ({}));
  await createAdminSupabase().from("campaigns").update({ status: "failed", error: `${String(stage ?? "unknown").slice(0, 80)}: ${String(error ?? "").slice(0, 500)}` }).eq("id", id);
  return NextResponse.json({ ok: true });
}
