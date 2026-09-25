import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isUuid } from "@/lib/api/guard";
import { publishSlot, type ClaimedSlot } from "@/lib/publish/runner";

export const maxDuration = 60;

/** "Publish now" from the calendar: claims the slot (only if still waiting) and publishes it in this request. */
export async function POST(_req: Request, { params }: { params: Promise<{ slotId: string }> }) {
  const { brand, admin } = await getSession();
  const { slotId } = await params;
  if (!isUuid(slotId)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const { data } = await admin.from("schedule_slots").update({ status: "claimed" }).eq("id", slotId).eq("brand_id", brand.id).eq("status", "filled").select("id, workspace_id, brand_id, platform, draft_id, scheduled_at, attempts");
  const slot = (data as ClaimedSlot[] | null)?.[0];
  if (!slot) return NextResponse.json({ error: "This post is not waiting to be published." }, { status: 409 });
  const result = await publishSlot(admin, slot);
  const { data: d } = await admin.from("drafts").select("permalink, publish_error").eq("id", slot.draft_id).single();
  return NextResponse.json({ result, permalink: d?.permalink ?? null, error: d?.publish_error ?? null }, { status: result === "published" ? 200 : 409 });
}
