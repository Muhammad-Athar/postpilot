import { getSession } from "@/lib/auth/session";
import { updateWorkspace } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { PageTitle } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";

export default async function SettingsPage() {
  const { workspace } = await getSession();
  const cadence = workspace.cadence_rule as { type?: string; times?: string[] };
  return (
    <div className="max-w-2xl">
      <PageTitle sub="Mode decides whether this is one brand or many. Cadence decides how approved drafts fill the calendar.">Workspace settings</PageTitle>
      <Card className="p-6">
        <form action={updateWorkspace} className="space-y-5">
          <Field label="Mode">
            <Select name="mode" defaultValue={workspace.mode}>
              <option value="single">Single brand · owner approves in-app</option>
              <option value="agency">Agency · multiple brands, client approval links</option>
            </Select>
          </Field>
          <Field label="Timezone" hint="IANA, e.g. Asia/Karachi"><Input name="timezone" defaultValue={workspace.timezone} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Posting cadence">
              <Select name="cadence_type" defaultValue={cadence.type ?? "weekdays"}>
                <option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option>
              </Select>
            </Field>
            <Field label="Posting times" hint="24h, comma-separated"><Input name="cadence_times" defaultValue={(cadence.times ?? ["10:00"]).join(", ")} /></Field>
          </div>
          <Button type="submit" variant="accent">Save</Button>
        </form>
      </Card>
    </div>
  );
}
