import { NextResponse } from "next/server";
import { parse, isValid } from "date-fns";
import { getSession } from "@/lib/auth/session";
import { listMonthEvents } from "@/lib/schedule/events";

/** Events for one month, for client-side month navigation. */
export async function GET(req: Request) {
  const { workspace, brand, admin } = await getSession();
  const month = new URL(req.url).searchParams.get("month") ?? "";
  const start = parse(month, "yyyy-MM", new Date());
  if (!/^\d{4}-\d{2}$/.test(month) || !isValid(start)) return NextResponse.json({ error: "bad month" }, { status: 400 });
  const events = await listMonthEvents(admin, brand.id, start, workspace.timezone);
  return NextResponse.json({ month, events }, { headers: { "cache-control": "private, max-age=20" } });
}
