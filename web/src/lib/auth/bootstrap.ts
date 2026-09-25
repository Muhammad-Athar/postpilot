import type { SupabaseClient } from "@supabase/supabase-js";

/** Returns the user's workspace, creating workspace + owner membership + default brand + preference row on first sign-in.
 *  Lookup picks the earliest workspace so duplicates can never fan out; creation runs inside the `ensure_workspace`
 *  SQL function under a per-user advisory lock, so concurrent first requests share one workspace. */
export async function ensureWorkspace(db: SupabaseClient, userId: string, email: string): Promise<string> {
  const { data: rows } = await db.from("workspace_members").select("workspace_id, workspaces(created_at)").eq("user_id", userId).order("created_at", { referencedTable: "workspaces", ascending: true }).limit(1);
  const existing = (rows as { workspace_id: string }[] | null)?.[0];
  if (existing) return existing.workspace_id;
  const { data, error } = await db.rpc("ensure_workspace", { p_user: userId, p_email: email });
  if (error || typeof data !== "string") throw error ?? new Error("ensure_workspace returned nothing");
  return data;
}
