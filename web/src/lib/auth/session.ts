import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureWorkspace } from "./bootstrap";

export type Workspace = { id: string; name: string; mode: "single" | "agency"; timezone: string; cadence_rule: Record<string, unknown>; posting_windows: Record<string, unknown>; default_settings: Record<string, unknown> };
export type Brand = { id: string; workspace_id: string; name: string; kit: Record<string, unknown>; voice_profile: string; banned_words: string[] };

/** Resolves the signed-in user, their workspace and the active brand (cookie `pp_brand`, else the first). Redirects to /login when signed out. */
export async function getSession() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminSupabase();
  const workspaceId = await ensureWorkspace(admin, user.id, user.email ?? "user@example.com");
  const { data: workspace } = await admin.from("workspaces").select("*").eq("id", workspaceId).single();
  const { data: brands } = await admin.from("brands").select("*").eq("workspace_id", workspaceId).order("created_at");
  const wanted = (await cookies()).get("pp_brand")?.value;
  const list = (brands ?? []) as Brand[];
  const brand = list.find((b) => b.id === wanted) ?? list[0];
  return { user, workspace: workspace as Workspace, brand, brands: list, supabase, admin };
}
