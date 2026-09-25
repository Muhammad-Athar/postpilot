import { PageTitle } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

const TILES = ["Followers", "Reach", "Views", "Likes", "Comments", "Shares", "Saves", "Top post"];

export default function AnalyticsPage() {
  return (
    <div className="">
      <PageTitle sub="Per-platform metrics, and an explanation of what worked that feeds the next brief.">Analytics</PageTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((t) => (
          <Card key={t} className="p-5">
            <div className="text-[11px] uppercase tracking-wide text-fg-subtle">{t}</div>
            <Skeleton className="mt-3 h-8 w-24" />
            <Skeleton className="mt-2 h-3 w-16" />
          </Card>
        ))}
      </div>
      <Card className="mt-6 p-8">
        <p className="font-serif text-2xl">Metrics start flowing once accounts are connected and the first posts go out.</p>
        <p className="mt-2 max-w-xl text-sm text-fg-muted">Snapshots are pulled every six hours. The “what worked” panel ranks hook style, length, posting hour and format, with a one-click “more like this”.</p>
      </Card>
    </div>
  );
}
