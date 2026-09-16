"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";

export async function updateWorkspace(formData: FormData) {
  const { workspace, admin } = await getSession();
  const mode = formData.get("mode") === "agency" ? "agency" : "single";
  const timezone = String(formData.get("timezone") || "UTC");
  const type = String(formData.get("cadence_type") || "weekdays");
  const times = String(formData.get("cadence_times") || "10:00").split(",").map((t) => t.trim()).filter(Boolean);
  await admin.from("workspaces").update({ mode, timezone, cadence_rule: { type, times } }).eq("id", workspace.id);
  revalidatePath("/", "layout");
}
