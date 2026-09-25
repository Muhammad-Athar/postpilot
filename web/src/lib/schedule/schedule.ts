import type { SupabaseClient } from "@supabase/supabase-js";
import { nextSlots, type CadenceRule } from "./slots";

/** Assigns an approved draft to a slot: the campaign's target day if set, else the next cadence slot. Returns the scheduled time. */
export async function scheduleApprovedDraft(admin: SupabaseClient, d: { id: string; workspace_id: string; brand_id: string; platform: string; campaign_id: string }, workspace: { timezone: string; cadence_rule: CadenceRule }): Promise<Date> {
  const { data: c } = await admin.from("campaigns").select("settings").eq("id", d.campaign_id).single();
  const targetDay = (c?.settings as { scheduledFor?: string })?.scheduledFor;
  // avoid stacking on an already-filled slot for the same platform
  const { data: taken } = await admin.from("schedule_slots").select("scheduled_at").eq("brand_id", d.brand_id).eq("platform", d.platform).gte("scheduled_at", new Date().toISOString());
  const busy = new Set((taken ?? []).map((t) => new Date(t.scheduled_at).getTime()));
  const candidates = targetDay ? nextSlots(workspace.cadence_rule, new Date(), 6, workspace.timezone, targetDay) : nextSlots(workspace.cadence_rule, new Date(), 30, workspace.timezone);
  const at = candidates.find((x) => !busy.has(x.getTime())) ?? candidates[0] ?? new Date(Date.now() + 3600e3);
  const { error } = await admin.from("schedule_slots").insert({ workspace_id: d.workspace_id, brand_id: d.brand_id, platform: d.platform, scheduled_at: at.toISOString(), draft_id: d.id, status: "filled" });
  if (error) throw error;
  await admin.from("drafts").update({ status: "scheduled" }).eq("id", d.id);
  return at;
}
