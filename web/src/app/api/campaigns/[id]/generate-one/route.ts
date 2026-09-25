import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSecret, isUuid } from "@/lib/api/guard";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { draftOutputSchema, RESPONSE_JSON_SCHEMA } from "@/lib/generation/schema";
import { PLATFORMS } from "@/lib/platforms/rules";
import * as gemini from "@/lib/ai/gemini";

export const maxDuration = 60;
const bodySchema = z.object({ platform: z.enum(PLATFORMS), candidateIndex: z.number().int().min(0).max(5), system: z.string().min(1).max(20000), user: z.string().min(1).max(40000) });

/** Called by n8n once per prompt bundle. Runs the model with retries + fallback chain, validates, and inserts the draft. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireSecret(req); if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const { platform, candidateIndex, system, user } = parsed.data;
  const db = createAdminSupabase();
  const { data: c } = await db.from("campaigns").select("id, workspace_id, brand_id, settings").eq("id", id).single();
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  let out;
  try { out = await gemini.generateJson(system, user, RESPONSE_JSON_SCHEMA, (raw) => draftOutputSchema.parse(raw)); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "generation failed" }, { status: 503 }); }
  const embedding = await gemini.embed(`${out.hook}\n${out.caption}`).catch(() => null);
  const { data: d, error } = await db.from("drafts").insert({
    workspace_id: c.workspace_id, campaign_id: id, brand_id: c.brand_id, platform, candidate_index: candidateIndex, version: 1,
    hook: out.hook, caption: out.caption, hashtags: out.hashtags, first_comment: out.firstComment, alt_text: out.altText, media_plan: out.mediaPlan, change_notes: out.changeNotes, embedding,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const expected = (c.settings?.platforms?.length ?? 1) * (c.settings?.candidatesPerSlot ?? 2);
  const { count } = await db.from("drafts").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("version", 1);
  if ((count ?? 0) >= expected) await db.from("campaigns").update({ status: "review" }).eq("id", id);
  return NextResponse.json({ draftId: d.id, received: count ?? 0, expected });
}
