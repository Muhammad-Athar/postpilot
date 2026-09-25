import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublisher } from "@/lib/publishers";
import { PublishError } from "@/lib/publishers/types";
import type { Platform } from "@/lib/platforms/rules";

/** For every healthy account (optionally one brand's): one account snapshot + one per post published in the last 30 days.
 *  Auth failures flip the account to `reconnect`; other errors are collected, never thrown. */
export async function syncAllAccounts(admin: SupabaseClient, brandId?: string) {
  const out = { accounts: 0, posts: 0, errors: [] as string[] };
  let q = admin.from("connected_accounts").select("id, workspace_id, brand_id, platform, adapter, tokens_encrypted, external_id, status").eq("status", "ok");
  if (brandId) q = q.eq("brand_id", brandId);
  const { data: accounts } = await q;
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  for (const a of accounts ?? []) {
    if (!a.tokens_encrypted) continue;
    try {
      const pub = getPublisher(a.platform as Platform, a);
      const acc = await pub.fetchAccountMetrics();
      await admin.from("metric_snapshots").insert({ workspace_id: a.workspace_id, account_id: a.id, draft_id: null, metrics: acc });
      out.accounts++;
      const { data: jobs } = await admin.from("publish_jobs").select("draft_id, external_id").eq("account_id", a.id).eq("status", "published").gte("created_at", since);
      for (const j of jobs ?? []) {
        if (!j.external_id) continue;
        try {
          const m = await pub.fetchPostMetrics(j.external_id);
          await admin.from("metric_snapshots").insert({ workspace_id: a.workspace_id, account_id: a.id, draft_id: j.draft_id, metrics: m });
          out.posts++;
        } catch (e) { out.errors.push(`${a.platform} post ${j.draft_id}: ${e instanceof Error ? e.message : e}`); }
      }
    } catch (e) {
      if (e instanceof PublishError && e.kind === "auth") await admin.from("connected_accounts").update({ status: "reconnect" }).eq("id", a.id);
      out.errors.push(`${a.platform} ${a.external_id ?? ""}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return out;
}
