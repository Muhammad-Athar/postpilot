import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { isUuid } from "@/lib/api/guard";
import { applyDecision, type DraftRecord } from "@/lib/drafts/actions";

const bodySchema = z.object({
  action: z.enum(["approve", "edit", "reject", "regenerate", "retry"]),
  note: z.string().max(1000).optional(),
  edits: z.object({ hook: z.string().min(1).max(500), caption: z.string().min(1).max(5000), hashtags: z.array(z.string().max(60)).max(30), firstComment: z.string().max(1000).nullable(), altText: z.string().max(500).nullable() }).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { admin, brand, workspace } = await getSession();
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { data: d } = await admin.from("drafts").select("id, workspace_id, campaign_id, brand_id, platform, candidate_index, version, hook, caption, hashtags, first_comment, alt_text, status").eq("id", id).eq("brand_id", brand.id).single();
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const result = await applyDecision(admin, d as DraftRecord, { id: brand.id, name: brand.name, voice_profile: brand.voice_profile }, parsed.data, { timezone: workspace.timezone, cadence_rule: workspace.cadence_rule });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Action failed" }, { status });
  }
}
