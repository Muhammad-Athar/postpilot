import Link from "next/link";
import { Link2, BarChart3, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getSession } from "@/lib/auth/session";
import { PLATFORM_RULES, type Platform } from "@/lib/platforms/rules";
import { aggregate, type SnapshotRow } from "@/lib/analytics/aggregate";
import { PageTitle, Eyebrow } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SyncNow } from "@/components/analytics/SyncNow";

const label = (p: string) => PLATFORM_RULES[p as Platform]?.label ?? p;

export default async function AnalyticsPage() {
  const { brand, admin } = await getSession();
  const { data: accounts } = await admin.from("connected_accounts").select("id, platform, external_id").eq("brand_id", brand.id).eq("status", "ok");
  if (!accounts?.length) {
    return (
      <div>
        <PageTitle sub="Per-platform metrics, and an explanation of what worked that feeds the next brief.">Analytics</PageTitle>
        <Card className="mx-auto max-w-2xl p-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent-strong dark:text-accent"><BarChart3 size={26} strokeWidth={1.5} /></span>
          <h2 className="mt-5 font-serif text-3xl">No accounts connected yet.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">Once a platform is connected and the first posts go out, this page shows followers, reach, views and engagement per platform, plus a plain-language read on what worked.</p>
          <Link href="/connections" className="mt-6 inline-block"><Button variant="accent"><Link2 size={16} /> Connect a platform</Button></Link>
        </Card>
      </div>
    );
  }
  const byId = new Map(accounts.map((a) => [a.id, a.platform as string]));
  const since = new Date(Date.now() - 60 * 864e5).toISOString();
  const { data: snaps } = await admin.from("metric_snapshots").select("account_id, draft_id, captured_at, metrics").in("account_id", accounts.map((a) => a.id)).gte("captured_at", since).order("captured_at", { ascending: true });
  const rows: SnapshotRow[] = (snaps ?? []).map((s) => ({ account_id: s.account_id, platform: byId.get(s.account_id) ?? "unknown", draft_id: s.draft_id, captured_at: s.captured_at, metrics: (s.metrics ?? {}) as SnapshotRow["metrics"] }));
  const agg = aggregate(rows);
  const top = agg.topPost ? (await admin.from("drafts").select("id, hook, platform, permalink").eq("id", agg.topPost.draftId).single()).data : null;
  const tiles: [string, number][] = [["Followers", agg.tiles.followers], ["Likes", agg.tiles.likes], ["Reposts", agg.tiles.reposts], ["Replies", agg.tiles.replies], ["Posts measured", agg.tiles.posts]];

  return (
    <div className="space-y-8">
      <PageTitle sub="Per-platform metrics, and an explanation of what worked that feeds the next brief.">Analytics</PageTitle>
      <div className="flex flex-wrap items-center gap-3">
        {accounts.map((a) => <Badge key={a.platform} tone="ok">{label(a.platform)} · {a.external_id}</Badge>)}
        <Badge tone="neutral">{agg.lastSync ? `Last sync ${formatDistanceToNow(new Date(agg.lastSync), { addSuffix: true })}` : "Not synced yet · first sync runs within 6 hours of the first published post"}</Badge>
        <SyncNow />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {tiles.map(([t, v]) => (
          <Card key={t} className="p-5"><div className="text-[11px] uppercase tracking-wide text-fg-subtle">{t}</div><div className="mt-2 font-serif text-3xl tabular-nums">{agg.lastSync ? v.toLocaleString() : "—"}</div></Card>
        ))}
      </div>
      <section>
        <Eyebrow>By platform</Eyebrow>
        <Card className="mt-3 overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-[11px] uppercase tracking-wide text-fg-subtle"><tr><th className="px-4 py-2 font-medium">Platform</th><th className="px-4 py-2 font-medium">Followers</th><th className="px-4 py-2 font-medium">Likes</th><th className="px-4 py-2 font-medium">Posts</th></tr></thead>
            <tbody>
              {accounts.map((a) => { const r = agg.byPlatform[a.platform as string]; return (
                <tr key={a.platform} className="border-t border-line"><td className="px-4 py-2.5">{label(a.platform)}</td><td className="px-4 py-2.5 tabular-nums">{r ? r.followers.toLocaleString() : "—"}</td><td className="px-4 py-2.5 tabular-nums">{r ? r.likes.toLocaleString() : "—"}</td><td className="px-4 py-2.5 tabular-nums">{r ? r.posts : "—"}</td></tr>
              ); })}
            </tbody>
          </table>
        </Card>
      </section>
      <section>
        <Eyebrow>Top post</Eyebrow>
        <Card className="mt-3 p-5">
          {top ? (<>
            <div className="flex items-center gap-2"><Badge tone="neutral">{label(top.platform)}</Badge><span className="text-xs text-fg-subtle">engagement score {agg.topPost?.score}</span></div>
            <p className="mt-2 font-serif text-xl leading-snug">{top.hook}</p>
            {top.permalink && <a href={top.permalink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-accent-strong underline-offset-2 hover:underline dark:text-accent">View post <ExternalLink size={12} /></a>}
          </>) : <p className="text-sm text-fg-muted">Appears after the first published post has been measured.</p>}
        </Card>
      </section>
    </div>
  );
}
