import { updateWorkspace } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import type { Workspace } from "@/lib/auth/session";
import { TIMEZONES, timezoneLabel } from "@/lib/schedule/timezones";

export function WorkspaceTab({ workspace }: { workspace: Workspace }) {
  const cadence = workspace.cadence_rule as { type?: string; times?: string[] };
  return (
    <Card className="p-6">
      <form action={updateWorkspace} className="max-w-xl space-y-5">
        <Field label="Mode">
          <Select name="mode" defaultValue={workspace.mode}>
            <option value="single">Single brand · owner approves in-app</option>
            <option value="agency">Agency · multiple brands, client approval links</option>
          </Select>
        </Field>
        <Field label="Timezone" hint="Posting times and the calendar use this zone.">
          <Select name="timezone" defaultValue={workspace.timezone}>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{timezoneLabel(tz)}</option>)}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Posting cadence">
            <Select name="cadence_type" defaultValue={cadence.type ?? "weekdays"}>
              <option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option>
            </Select>
          </Field>
          <Field label="Posting times" hint="24h, comma-separated"><Input name="cadence_times" defaultValue={(cadence.times ?? ["10:00"]).join(", ")} /></Field>
        </div>
        <Button type="submit" variant="accent">Save workspace</Button>
      </form>
    </Card>
  );
}
