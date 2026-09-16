import { getSession } from "@/lib/auth/session";
import { updateWorkspace } from "./actions";

export default async function SettingsPage() {
  const { workspace } = await getSession();
  const cadence = workspace.cadence_rule as { type?: string; times?: string[] };
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Workspace settings</h1>
      <form action={updateWorkspace} className="space-y-4 rounded-2xl bg-white p-6 border border-neutral-200">
        <label className="block text-sm">Mode
          <select name="mode" defaultValue={workspace.mode} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2">
            <option value="single">Single brand</option>
            <option value="agency">Agency (multiple brands, client approvals)</option>
          </select>
        </label>
        <label className="block text-sm">Timezone (IANA)
          <input name="timezone" defaultValue={workspace.timezone} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        <label className="block text-sm">Posting cadence
          <select name="cadence_type" defaultValue={cadence.type ?? "weekdays"} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2">
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
        <label className="block text-sm">Posting times (comma-separated, 24h)
          <input name="cadence_times" defaultValue={(cadence.times ?? ["10:00"]).join(", ")} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        <button className="rounded-lg bg-neutral-900 text-white px-4 py-2">Save</button>
      </form>
    </div>
  );
}
