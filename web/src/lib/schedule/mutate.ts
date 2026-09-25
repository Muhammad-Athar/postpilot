import type { SupabaseClient } from "@supabase/supabase-js";

type Slot = { id: string; brand_id: string; draft_id: string | null; status: string };
async function loadOwnedSlot(admin: SupabaseClient, slotId: string, brandId: string): Promise<Slot> {
  const { data } = await admin.from("schedule_slots").select("id, brand_id, draft_id, status").eq("id", slotId).eq("brand_id", brandId);
  const slot = (data as Slot[] | null)?.[0];
  if (!slot) throw Object.assign(new Error("slot not found"), { status: 404 });
  if (slot.status === "done") throw Object.assign(new Error("This post is already published."), { status: 409 });
  return slot;
}

/** Moves a pending slot to a new time. The draft stays `scheduled`. */
export async function rescheduleSlot(admin: SupabaseClient, a: { slotId: string; brandId: string; at: Date }): Promise<void> {
  await loadOwnedSlot(admin, a.slotId, a.brandId);
  if (a.at.getTime() < Date.now() - 60e3) throw Object.assign(new Error("Pick a time in the future."), { status: 400 });
  const { error } = await admin.from("schedule_slots").update({ scheduled_at: a.at.toISOString() }).eq("id", a.slotId).eq("brand_id", a.brandId);
  if (error) throw error;
}

/** Removes a pending slot and returns its draft to `approved` so it can be rescheduled from the inbox or calendar. */
export async function unscheduleSlot(admin: SupabaseClient, a: { slotId: string; brandId: string }): Promise<void> {
  const slot = await loadOwnedSlot(admin, a.slotId, a.brandId);
  const { error } = await admin.from("schedule_slots").delete().eq("id", a.slotId).eq("brand_id", a.brandId);
  if (error) throw error;
  if (slot.draft_id) await admin.from("drafts").update({ status: "approved" }).eq("id", slot.draft_id).eq("status", "scheduled");
}
