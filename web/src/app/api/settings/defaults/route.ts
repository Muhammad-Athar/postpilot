import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { campaignSettingsSchema } from "@/lib/campaigns/settings";

/** Saves campaign defaults for the workspace. Partial input is allowed; platforms may be omitted. */
export async function PATCH(req: Request) {
  const { workspace, admin } = await getSession();
  const parsed = campaignSettingsSchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  await admin.from("workspaces").update({ default_settings: parsed.data }).eq("id", workspace.id);
  return NextResponse.json({ ok: true });
}
