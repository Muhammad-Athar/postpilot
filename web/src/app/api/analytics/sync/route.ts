import { NextResponse } from "next/server";
import { requireSecret } from "@/lib/api/guard";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { syncAllAccounts } from "@/lib/analytics/sync";

export const maxDuration = 60;

/** n8n `postpilot-analytics` clock: sync every account. */
export async function POST(req: Request) {
  const denied = requireSecret(req); if (denied) return denied;
  return NextResponse.json({ ok: true, ...(await syncAllAccounts(createAdminSupabase())) });
}

/** "Sync now" from the Analytics page: sync the active brand only. */
export async function GET() {
  const { brand, admin } = await getSession();
  return NextResponse.json({ ok: true, ...(await syncAllAccounts(admin, brand.id)) });
}
