"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { PLATFORM_RULES } from "@/lib/platforms/rules";
import { DraftCard } from "./DraftCard";
import type { CampaignRow, DraftRow, DraftAction } from "@/lib/drafts/types";

export function InboxLive({ campaigns, initialDrafts, brandId }: { campaigns: CampaignRow[]; initialDrafts: DraftRow[]; brandId: string }) {
  const router = useRouter();
  // Server data is the base; realtime events are layered on top so a refresh never fights the subscription.
  const [live, setLive] = useState<Record<string, DraftRow | null>>({});
  const [showHandled, setShowHandled] = useState(false);
  const drafts = useMemo(() => {
    const merged = new Map(initialDrafts.map((d) => [d.id, d] as const));
    for (const [id, row] of Object.entries(live)) { if (row) merged.set(id, row); else merged.delete(id); }
    return [...merged.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [initialDrafts, live]);

  useEffect(() => {
    const sb = createBrowserSupabase();
    const ch = sb.channel(`drafts-${brandId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "drafts", filter: `brand_id=eq.${brandId}` }, (p) => {
        if (p.eventType === "DELETE") { setLive((l) => ({ ...l, [(p.old as { id: string }).id]: null })); return; }
        const row = p.new as DraftRow;
        setLive((l) => ({ ...l, [row.id]: row }));
        if (p.eventType === "INSERT") router.refresh();
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [brandId, router]);

  async function onAction(id: string, action: DraftAction, payload?: { note?: string; edits?: Record<string, unknown> }) {
    const res = await fetch(`/api/drafts/${id}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Action failed");
    router.refresh();
  }

  const byCampaign = useMemo(() => {
    const m = new Map<string, DraftRow[]>();
    for (const d of drafts) if (showHandled || d.status === "draft") (m.get(d.campaign_id) ?? m.set(d.campaign_id, []).get(d.campaign_id)!).push(d);
    return m;
  }, [drafts, showHandled]);

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <label className="flex items-center gap-2 text-sm text-neutral-600"><input type="checkbox" checked={showHandled} onChange={(e) => setShowHandled(e.target.checked)} />Show approved &amp; rejected</label>
      </div>
      {campaigns.length === 0 && <p className="text-neutral-500">No campaigns yet. Start one from “New campaign”.</p>}
      {campaigns.map((c) => {
        const list = (byCampaign.get(c.id) ?? []).sort((a, b) => a.platform.localeCompare(b.platform) || a.candidate_index - b.candidate_index || b.version - a.version);
        const refImage = c.references.find((r) => r.kind === "image")?.url;
        return (
          <section key={c.id} className="space-y-3">
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-medium">{c.prompt.length > 90 ? c.prompt.slice(0, 90) + "…" : c.prompt}</h2>
              <span className="text-xs text-neutral-500">{(c.settings.platforms ?? []).map((p) => PLATFORM_RULES[p]?.label ?? p).join(" · ")}</span>
              <span className={`text-xs rounded-full px-2 py-0.5 ${c.status === "failed" ? "bg-red-100 text-red-800" : c.status === "generating" ? "bg-amber-100 text-amber-800" : "bg-neutral-100"}`}>{c.status}</span>
            </header>
            {c.status === "generating" && list.length < (c.settings.platforms?.length ?? 1) * (c.settings.candidatesPerSlot ?? 2) && (
              <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 animate-pulse">Generating drafts… they appear here as each one lands.</div>
            )}
            {c.status === "failed" && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                Generation failed: {c.error}
                <RetryButton campaign={c} />
              </div>
            )}
            {list.map((d) => <DraftCard key={d.id} draft={d} referenceImage={refImage} onAction={onAction} />)}
            {c.status === "review" && list.length === 0 && <p className="text-sm text-neutral-500">All candidates handled.</p>}
          </section>
        );
      })}
    </div>
  );
}

function RetryButton({ campaign }: { campaign: CampaignRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button disabled={busy} onClick={async () => { setBusy(true); await fetch("/api/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: campaign.prompt, references: campaign.references, settings: campaign.settings }) }); router.refresh(); setBusy(false); }} className="ml-3 rounded-lg border border-red-300 px-2 py-1 text-xs disabled:opacity-50">{busy ? "Retrying…" : "Retry"}</button>
  );
}
