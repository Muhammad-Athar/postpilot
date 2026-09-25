"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";

export async function setBrandCookie(brandId: string) {
  const { brands } = await getSession();
  if (!brands.some((b) => b.id === brandId)) throw new Error("Unknown brand");
  (await cookies()).set("pp_brand", brandId, { path: "/", httpOnly: true, sameSite: "lax" });
}

export async function addBrand(name: string) {
  const { workspace, admin } = await getSession();
  if (workspace.mode !== "agency") throw new Error("Switch the workspace to agency mode to add brands");
  const { data: brand } = await admin.from("brands").insert({ workspace_id: workspace.id, name: name.trim() || "New brand" }).select().single();
  await admin.from("preference_summaries").insert({ brand_id: brand.id, workspace_id: workspace.id });
  (await cookies()).set("pp_brand", brand.id, { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function renameBrand(brandId: string, name: string): Promise<{ error?: string }> {
  const { workspace, admin } = await getSession();
  const clean = name.trim();
  if (clean.length < 2 || clean.length > 60) return { error: "Name must be 2–60 characters." };
  const { error } = await admin.from("brands").update({ name: clean }).eq("id", brandId).eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}
