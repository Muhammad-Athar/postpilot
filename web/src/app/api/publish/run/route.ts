import { NextResponse } from "next/server";
import { requireSecret } from "@/lib/api/guard";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { runPublishBatch } from "@/lib/publish/runner";

export const maxDuration = 60;

/** Called by the n8n `postpilot-publish` clock every 5 minutes. Publishes every due slot. */
export async function POST(req: Request) {
  const denied = requireSecret(req); if (denied) return denied;
  const result = await runPublishBatch(createAdminSupabase());
  return NextResponse.json({ ok: true, ...result });
}
