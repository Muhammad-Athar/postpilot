import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { isUuid } from "@/lib/api/guard";
import { rescheduleSlot, unscheduleSlot } from "@/lib/schedule/mutate";

const patchBody = z.object({ at: z.string().datetime({ offset: true }) });
type Ctx = { params: Promise<{ slotId: string }> };
const fail = (e: unknown) => NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: (e as { status?: number }).status ?? 500 });

export async function PATCH(req: Request, { params }: Ctx) {
  const { brand, admin } = await getSession();
  const { slotId } = await params;
  if (!isUuid(slotId)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const parsed = patchBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  try { await rescheduleSlot(admin, { slotId, brandId: brand.id, at: new Date(parsed.data.at) }); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
export async function DELETE(_req: Request, { params }: Ctx) {
  const { brand, admin } = await getSession();
  const { slotId } = await params;
  if (!isUuid(slotId)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  try { await unscheduleSlot(admin, { slotId, brandId: brand.id }); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
