import Link from "next/link";
import { Link2, BarChart3 } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { PLATFORM_RULES, type Platform } from "@/lib/platforms/rules";
import { PageTitle } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const TILES = ["Followers", "Reach", "Views", "Likes", "Comments", "Shares", "Saves", "Top post"];

export default async function AnalyticsPage() {
  const { brand, admin } = await getSession();
  const { data: accounts } = await admin.from("connected_accounts").select("platform, external_id").eq("brand_id", brand.id).eq("status", "ok");
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
  return (
    <div>
      <PageTitle sub="Per-platform metrics, and an explanation of what worked that feeds the next brief.">Analytics</PageTitle>
      <div className="mb-4 flex flex-wrap gap-2">{accounts.map((a) => <Badge key={a.platform} tone="ok">{PLATFORM_RULES[a.platform as Platform]?.label} · {a.external_id}</Badge>)}</div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TILES.map((t) => (
          <Card key={t} className="p-5"><div className="text-[11px] uppercase tracking-wide text-fg-subtle">{t}</div><div className="mt-2 font-serif text-3xl">—</div><div className="mt-1 text-xs text-fg-subtle">First sync after the first published post</div></Card>
        ))}
      </div>
    </div>
  );
}
