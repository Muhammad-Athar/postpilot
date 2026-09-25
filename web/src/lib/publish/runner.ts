import type { SupabaseClient } from "@supabase/supabase-js";
import { PLATFORM_RULES, type Platform } from "@/lib/platforms/rules";
import { composeText } from "@/lib/publishers/text";
import { loadImages as defaultLoadImages } from "@/lib/publishers/media";
import { isOwnStorageUrl } from "@/lib/net/safe-fetch";
import { getPublisher as defaultGetPublisher, type StoredAccount } from "@/lib/publishers";
import { PublishError, type Publisher } from "@/lib/publishers/types";
import { prePublishCheck } from "./safety";

export type ClaimedSlot = { id: string; workspace_id: string; brand_id: string; platform: Platform; draft_id: string; scheduled_at: string; attempts: number };
export type RunnerDeps = {
  getPublisher: (platform: Platform, account: StoredAccount) => Publisher;
  loadImages: typeof defaultLoadImages;
  safety: (a: { text: string; bannedWords: string[] }) => Promise<{ ok: true } | { ok: false; reasons: string[] }>;
  maxAttempts: number;
};
export const defaultDeps: RunnerDeps = { getPublisher: defaultGetPublisher, loadImages: defaultLoadImages, safety: prePublishCheck, maxAttempts: 3 };
/** Native adapters take image bytes with these caps; aggregator platforms take public URLs instead. */
const IMAGE_LIMITS: Partial<Record<Platform, { maxBytes: number; maxCount: number }>> = { bluesky: { maxBytes: 976_000, maxCount: 4 }, mastodon: { maxBytes: 16_000_000, maxCount: 4 } };
const backoffMinutes = (attempt: number) => [5, 15, 45][Math.min(attempt, 2)];

/** Atomically takes every due slot: only rows still `filled` flip to `claimed`, so overlapping runs never share one.
 *  (No `limit`: PostgREST refuses a limited UPDATE without an ordering, and a 5-minute batch is small anyway.) */
export async function claimDueSlots(admin: SupabaseClient, now = new Date()): Promise<ClaimedSlot[]> {
  const { data } = await admin.from("schedule_slots").update({ status: "claimed" }).eq("status", "filled").lte("scheduled_at", now.toISOString()).not("draft_id", "is", null).select("id, workspace_id, brand_id, platform, draft_id, scheduled_at, attempts");
  return (data ?? []) as ClaimedSlot[];
}

export async function publishSlot(admin: SupabaseClient, slot: ClaimedSlot, deps: RunnerDeps = defaultDeps): Promise<"published" | "failed" | "retry"> {
  const { data: draft } = await admin.from("drafts").select("id, version, caption, hashtags, first_comment, alt_text, media_urls, status").eq("id", slot.draft_id).single();
  if (!draft || draft.status !== "scheduled") { await admin.from("schedule_slots").update({ status: "done" }).eq("id", slot.id); return "failed"; }
  const fail = async (reason: string, accountId: string | null = null) => {
    await admin.from("publish_jobs").insert({ workspace_id: slot.workspace_id, draft_id: slot.draft_id, account_id: accountId, attempts: slot.attempts + 1, status: "failed", error: reason });
    await admin.from("drafts").update({ status: "failed", publish_error: reason }).eq("id", slot.draft_id);
    await admin.from("schedule_slots").update({ status: "failed" }).eq("id", slot.id);
    return "failed" as const;
  };
  const label = PLATFORM_RULES[slot.platform].label;
  const { data: account } = await admin.from("connected_accounts").select("id, platform, adapter, tokens_encrypted, external_id, status").eq("brand_id", slot.brand_id).eq("platform", slot.platform).maybeSingle();
  if (!account || !account.tokens_encrypted) return fail(`No ${label} account is connected. Connect one and reschedule.`);
  if (account.status !== "ok") return fail(`The ${label} account needs to be reconnected.`, account.id);
  const { data: brand } = await admin.from("brands").select("banned_words").eq("id", slot.brand_id).single();

  const text = composeText(draft.caption, draft.hashtags ?? [], PLATFORM_RULES[slot.platform].captionMax);
  const safety = await deps.safety({ text, bannedWords: brand?.banned_words ?? [] });
  if (!safety.ok) return fail(`Safety check: ${safety.reasons.join(" · ")}`, account.id);

  const limits = IMAGE_LIMITS[slot.platform];
  const media = limits ? await deps.loadImages(draft.media_urls ?? [], limits) : { images: [], warnings: [] as string[] };
  try {
    const publisher = deps.getPublisher(slot.platform, account);
    const r = await publisher.publish({ draftId: draft.id, platform: slot.platform, text, images: media.images, mediaUrls: (draft.media_urls ?? []).filter(isOwnStorageUrl), altText: draft.alt_text, firstComment: draft.first_comment });
    const warnings = [...media.warnings, ...r.warnings];
    const note = warnings.length ? warnings.join(" ") : null;
    await admin.from("publish_jobs").insert({ workspace_id: slot.workspace_id, draft_id: slot.draft_id, account_id: account.id, attempts: slot.attempts + 1, status: "published", external_id: r.externalId, permalink: r.permalink || null, error: note });
    await admin.from("drafts").update({ status: "published", permalink: r.permalink || null, publish_error: note, published_at: new Date().toISOString() }).eq("id", slot.draft_id);
    await admin.from("schedule_slots").update({ status: "done" }).eq("id", slot.id);
    return "published";
  } catch (e) {
    const err = e instanceof PublishError ? e : new PublishError(e instanceof Error ? e.message : "Unknown error", /processing|timeout|ECONNRESET|fetch failed/i.test(String(e)) ? "transient" : "permanent");
    if (err.kind === "auth") {
      await admin.from("connected_accounts").update({ status: "reconnect" }).eq("id", account.id);
      return fail(err.message, account.id);
    }
    if (err.kind === "transient" && slot.attempts + 1 < deps.maxAttempts) {
      const next = new Date(Date.now() + backoffMinutes(slot.attempts) * 60e3).toISOString();
      await admin.from("publish_jobs").insert({ workspace_id: slot.workspace_id, draft_id: slot.draft_id, account_id: account.id, attempts: slot.attempts + 1, status: "retry", error: err.message });
      await admin.from("schedule_slots").update({ status: "filled", scheduled_at: next, attempts: slot.attempts + 1 }).eq("id", slot.id);
      return "retry";
    }
    return fail(err.message, account.id);
  }
}

export async function runPublishBatch(admin: SupabaseClient, deps: RunnerDeps = defaultDeps) {
  const out = { published: 0, failed: 0, retried: 0 };
  for (const slot of await claimDueSlots(admin)) {
    const r = await publishSlot(admin, slot, deps);
    if (r === "published") out.published++; else if (r === "retry") out.retried++; else out.failed++;
  }
  return out;
}
