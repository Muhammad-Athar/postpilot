import { getSession } from "@/lib/auth/session";
import { InboxLive } from "@/components/inbox/InboxLive";
import type { CampaignRow, DraftRow } from "@/lib/drafts/types";

export default async function InboxPage() {
  const { brand, admin } = await getSession();
  const { data: campaigns } = await admin.from("campaigns").select("id, prompt, status, error, settings, references, created_at").eq("brand_id", brand.id).order("created_at", { ascending: false }).limit(20);
  const ids = (campaigns ?? []).map((c) => c.id);
  const { data: drafts } = ids.length ? await admin.from("drafts").select("*").in("campaign_id", ids).order("created_at", { ascending: false }) : { data: [] };
  return <InboxLive campaigns={(campaigns ?? []) as CampaignRow[]} initialDrafts={(drafts ?? []) as DraftRow[]} brandId={brand.id} />;
}
