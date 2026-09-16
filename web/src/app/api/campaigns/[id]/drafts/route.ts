import { NextResponse } from "next/server";
import { requireSecret, isUuid } from "@/lib/api/guard";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { draftOutputSchema } from "@/lib/generation/schema";
import { PLATFORMS } from "@/lib/platforms/rules";
import { embed } from "@/lib/ai/gemini";

/** Called by n8n once per generated candidate. Validates the model output and inserts a draft. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireSecret(req); if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const parsed = draftOutputSchema.safeParse(body.output);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  if (!(PLATFORMS as readonly string[]).includes(body.platform)) return NextResponse.json({ error: "bad platform" }, { status: 422 });
  const o = parsed.data;
  const db = createAdminSupabase();
  const { data: c } = await db.from("campaigns").select("id, workspace_id, brand_id, settings").eq("id", id).single();
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  let version = 1, parent: string | null = null;
  if (isUuid(body.parentDraftId)) {
    const { data: p } = await db.from("drafts").select("version").eq("id", body.parentDraftId).eq("campaign_id", id).single();
    if (p) { version = p.version + 1; parent = body.parentDraftId; }
  }
  const embedding = await embed(`${o.hook}\n${o.caption}`).catch(() => null);
  const { data: d, error } = await db.from("drafts").insert({
    workspace_id: c.workspace_id, campaign_id: id, brand_id: c.brand_id, platform: body.platform,
    candidate_index: Number.isInteger(body.candidateIndex) ? body.candidateIndex : 0, version, parent_draft_id: parent,
    hook: o.hook, caption: o.caption, hashtags: o.hashtags, first_comment: o.firstComment, alt_text: o.altText,
    media_plan: o.mediaPlan, change_notes: o.changeNotes, embedding,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const expected = (c.settings?.platforms?.length ?? 1) * (c.settings?.candidatesPerSlot ?? 2);
  const { count } = await db.from("drafts").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("version", 1);
  if ((count ?? 0) >= expected) await db.from("campaigns").update({ status: "review" }).eq("id", id);
  return NextResponse.json({ draftId: d.id, received: count ?? 0, expected });
}
