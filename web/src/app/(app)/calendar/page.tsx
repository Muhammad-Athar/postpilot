import { getSession } from "@/lib/auth/session";
import { PageTitle } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function CalendarPage() {
  const { workspace, admin, brand } = await getSession();
  const cadence = workspace.cadence_rule as { type?: string; times?: string[] };
  const { count } = await admin.from("drafts").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).eq("status", "approved");
  return (
    <div className="max-w-4xl">
      <PageTitle sub="Approved drafts fill the next open slot for their platform.">Calendar</PageTitle>
      <Card className="p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="accent">{cadence.type ?? "weekdays"}</Badge>
          <span className="text-sm text-fg-muted">at {(cadence.times ?? ["10:00"]).join(", ")} · {workspace.timezone}</span>
        </div>
        <p className="mt-6 font-serif text-3xl">{count ?? 0} approved {count === 1 ? "draft" : "drafts"} waiting for a slot.</p>
        <p className="mt-2 max-w-lg text-sm text-fg-muted">Scheduling and publishing arrive with the next release: native Bluesky, Mastodon and Meta, the rest via Late, with retries and a permalink per post.</p>
      </Card>
    </div>
  );
}
