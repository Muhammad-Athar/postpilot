import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths, startOfMonth } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { toDateKey } from "./slots";
import type { Platform } from "@/lib/platforms/rules";

export type CalendarEvent = {
  id: string;
  kind: "scheduled" | "published" | "failed" | "review" | "campaign";
  title: string;
  time?: string;        // HH:mm in workspace tz
  platform?: Platform;
  draftId?: string;
  campaignId?: string;
};

/** Events for the month containing `monthStart`, keyed by yyyy-MM-dd in the workspace timezone. */
export async function listMonthEvents(admin: SupabaseClient, brandId: string, monthStart: Date, tz: string): Promise<Record<string, CalendarEvent[]>> {
  const from = startOfMonth(addMonths(monthStart, -1)).toISOString();
  const to = startOfMonth(addMonths(monthStart, 2)).toISOString();
  const out: Record<string, CalendarEvent[]> = {};
  const push = (d: Date, e: CalendarEvent) => { const k = toDateKey(toZonedTime(d, tz)); (out[k] ??= []).push(e); };
  const hhmm = (d: Date) => { const z = toZonedTime(d, tz); return `${String(z.getHours()).padStart(2, "0")}:${String(z.getMinutes()).padStart(2, "0")}`; };

  const { data: slots } = await admin.from("schedule_slots").select("id, platform, scheduled_at, draft_id, status, drafts(id, hook, status, campaign_id)").eq("brand_id", brandId).gte("scheduled_at", from).lt("scheduled_at", to);
  for (const s of slots ?? []) {
    const d = (Array.isArray(s.drafts) ? s.drafts[0] : s.drafts) as { id: string; hook: string; status: string; campaign_id: string } | null;
    const at = new Date(s.scheduled_at);
    push(at, { id: s.id, kind: d?.status === "published" ? "published" : d?.status === "failed" ? "failed" : "scheduled", title: d?.hook ?? "Scheduled post", time: hhmm(at), platform: s.platform as Platform, draftId: d?.id, campaignId: d?.campaign_id });
  }
  const { data: campaigns } = await admin.from("campaigns").select("id, prompt, status, settings, created_at").eq("brand_id", brandId).gte("created_at", from).lt("created_at", to);
  for (const c of campaigns ?? []) {
    const target = (c.settings as { scheduledFor?: string })?.scheduledFor;
    const when = target ? new Date(`${target}T12:00:00`) : new Date(c.created_at);
    const { count } = await admin.from("drafts").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "draft");
    if ((count ?? 0) > 0) push(when, { id: `rv-${c.id}`, kind: "review", title: `${count} to review · ${c.prompt.slice(0, 40)}${c.prompt.length > 40 ? "…" : ""}`, campaignId: c.id });
    else if (c.status === "generating") push(when, { id: `gen-${c.id}`, kind: "campaign", title: `Generating · ${c.prompt.slice(0, 40)}`, campaignId: c.id });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  return out;
}
