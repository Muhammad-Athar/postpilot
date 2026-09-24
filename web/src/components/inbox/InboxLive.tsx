"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { PLATFORM_RULES } from "@/lib/platforms/rules";
import { AnimatePresence, motion } from "framer-motion";
import { DraftCard } from "./DraftCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageTitle } from "@/components/ui/Heading";
import { Skeleton } from "@/components/ui/Skeleton";
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
    <div className="max-w-5xl space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle sub="Approve what you like. Everything you decide here teaches the next batch.">Inbox</PageTitle>
        <label className="mb-6 flex cursor-pointer items-center gap-2 text-sm text-fg-muted"><input type="checkbox" className="accent-[var(--accent)]" checked={showHandled} onChange={(e) => setShowHandled(e.target.checked)} />Show approved &amp; rejected</label>
      </div>
      {campaigns.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[var(--radius)] border border-dashed border-line-strong p-10 text-center">
          <p className="font-serif text-2xl">Nothing to review yet.</p>
          <p className="mt-2 text-sm text-fg-muted">Start a campaign and candidates will land here as they are generated.</p>
        </motion.div>
      )}
      {campaigns.map((c) => {
        const list = (byCampaign.get(c.id) ?? []).sort((a, b) => a.platform.localeCompare(b.platform) || a.candidate_index - b.candidate_index || b.version - a.version);
        const refImage = c.references.find((r) => r.kind === "image")?.url;
        return (
          <section key={c.id} className="space-y-4">
            <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="font-serif text-xl">{c.prompt.length > 90 ? c.prompt.slice(0, 90) + "…" : c.prompt}</h2>
              <span className="text-xs text-fg-subtle">{(c.settings.platforms ?? []).map((p) => PLATFORM_RULES[p]?.label ?? p).join(" · ")}</span>
              <Badge tone={c.status === "failed" ? "danger" : c.status === "generating" ? "warn" : c.status === "review" ? "accent" : "neutral"}>{c.status}</Badge>
            </header>
            {c.status === "generating" && list.length < (c.settings.platforms?.length ?? 1) * (c.settings.candidatesPerSlot ?? 2) && (
              <div className="grid gap-5 rounded-[var(--radius)] border border-line bg-elev p-4 md:grid-cols-[270px_1fr]">
                <Skeleton className="aspect-[4/5] w-full" />
                <div className="space-y-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /><p className="pt-2 text-xs text-fg-subtle">Generating… candidates appear as each one lands.</p></div>
              </div>
            )}
            {c.status === "failed" && (
              <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
                <span className="min-w-0 flex-1">Generation failed: {c.error}</span>
                <RetryButton campaign={c} />
              </div>
            )}
            <AnimatePresence initial={false}>
              {list.map((d) => <DraftCard key={d.id} draft={d} referenceImage={refImage} onAction={onAction} />)}
            </AnimatePresence>
            {c.status === "review" && list.length === 0 && <p className="text-sm text-fg-subtle">All candidates handled.</p>}
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
    <Button size="sm" variant="danger" loading={busy} onClick={async () => { setBusy(true); await fetch("/api/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: campaign.prompt, references: campaign.references, settings: campaign.settings }) }); router.refresh(); setBusy(false); }}>Retry</Button>
  );
}
