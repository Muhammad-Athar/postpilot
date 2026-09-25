"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { isValidTimezone } from "@/lib/schedule/timezones";

export async function updateWorkspace(formData: FormData) {
  const { workspace, admin } = await getSession();
  const mode = formData.get("mode") === "agency" ? "agency" : "single";
  const requested = String(formData.get("timezone") || "");
  const timezone = isValidTimezone(requested) ? requested : workspace.timezone;
  const type = String(formData.get("cadence_type") || "weekdays");
  const parsedTimes = String(formData.get("cadence_times") || "").split(",").map((t) => t.trim()).filter((t) => /^\d{1,2}:\d{2}$/.test(t));
  const times = parsedTimes.length ? parsedTimes : ["10:00"];
  await admin.from("workspaces").update({ mode, timezone, cadence_rule: { type, times } }).eq("id", workspace.id);
  revalidatePath("/", "layout");
}
