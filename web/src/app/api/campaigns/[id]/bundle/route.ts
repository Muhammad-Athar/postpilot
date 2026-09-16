import { NextResponse } from "next/server";
import { requireSecret, isUuid } from "@/lib/api/guard";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildGenerationPrompts } from "@/lib/generation/prompt";
import { RESPONSE_JSON_SCHEMA } from "@/lib/generation/schema";
import { summariseReferences } from "@/lib/generation/references";
import { resolveSettings } from "@/lib/campaigns/settings";
import * as gemini from "@/lib/ai/gemini";

/** Called by the n8n `generate` workflow. Returns one prompt bundle per platform × candidate. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireSecret(req); if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const db = createAdminSupabase();
  const { data: c } = await db.from("campaigns").select("id, brand_id, prompt, references, settings").eq("id", id).single();
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [{ data: brand }, { data: pref }] = await Promise.all([
    db.from("brands").select("name, voice_profile").eq("id", c.brand_id).single(),
    db.from("preference_summaries").select("summary").eq("brand_id", c.brand_id).maybeSingle(),
  ]);
  if (!brand) return NextResponse.json({ error: "brand missing" }, { status: 404 });
  const settings = resolveSettings({}, c.settings);
  const references = await summariseReferences(c.references ?? [], gemini);
  const bundles = buildGenerationPrompts({ brand: { name: brand.name, voiceProfile: brand.voice_profile }, settings, prompt: c.prompt, references, preferenceSummary: pref?.summary || null, feedback: null });
  return NextResponse.json({ campaignId: id, model: gemini.TEXT_MODEL, responseSchema: RESPONSE_JSON_SCHEMA, bundles });
}
