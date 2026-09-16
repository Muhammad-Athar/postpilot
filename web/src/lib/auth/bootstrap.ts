import type { SupabaseClient } from "@supabase/supabase-js";

/** First sign-in creates a workspace, owner membership, a default brand and its preference row. Idempotent. */
export async function ensureWorkspace(db: SupabaseClient, userId: string, email: string): Promise<string> {
  const { data: m } = await db.from("workspace_members").select("workspace_id").eq("user_id", userId).maybeSingle();
  if (m) return m.workspace_id as string;
  const { data: ws } = await db.from("workspaces").insert({ name: `${email.split("@")[0]}'s workspace` }).select().single();
  await db.from("workspace_members").insert({ workspace_id: ws.id, user_id: userId, role: "owner" }).select().single();
  const { data: brand } = await db.from("brands").insert({ workspace_id: ws.id, name: "My brand" }).select().single();
  await db.from("preference_summaries").insert({ brand_id: brand.id, workspace_id: ws.id }).select().single();
  return ws.id as string;
}
