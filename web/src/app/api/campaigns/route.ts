import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createCampaign } from "@/lib/campaigns/create";
import { triggerWorkflow } from "@/lib/n8n/trigger";

export async function POST(req: Request) {
  const { workspace, brand, admin } = await getSession();
  const body = await req.json().catch(() => ({}));
  let created: Awaited<ReturnType<typeof createCampaign>>;
  try {
    created = await createCampaign(admin, { workspaceId: workspace.id, brandId: brand.id, prompt: String(body.prompt ?? ""), references: body.references ?? [], overrides: body.settings ?? {}, defaults: workspace.default_settings });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
  const { id, settings } = created;
  try {
    await triggerWorkflow(process.env.N8N_GENERATE_WEBHOOK_PATH!, { campaignId: id, platforms: settings.platforms, candidatesPerSlot: settings.candidatesPerSlot, postsCount: settings.postsCount });
    await admin.from("campaigns").update({ status: "generating" }).eq("id", id);
  } catch (e) {
    await admin.from("campaigns").update({ status: "failed", error: `trigger: ${e instanceof Error ? e.message : String(e)}` }).eq("id", id);
    return NextResponse.json({ id, error: "Could not reach the generation workflow" }, { status: 502 });
  }
  return NextResponse.json({ id });
}
