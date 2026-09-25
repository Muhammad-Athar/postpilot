"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { brandKitSchema } from "@/lib/brand/schema";
import { buildVoiceProfile } from "@/lib/brand/voice-profile";

const list = (v: FormDataEntryValue | null) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const lines = (v: FormDataEntryValue | null) => String(v ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

export async function saveBrand(formData: FormData) {
  const { workspace, brand, admin } = await getSession();
  const logo = formData.get("logo");
  let logoUrl = (brand.kit as { logoUrl?: string }).logoUrl;
  if (logo instanceof File && logo.size > 0) {
    if (!/^image\//.test(logo.type) || logo.size > 5 * 1024 * 1024) throw new Error("Logo must be an image under 5 MB");
    const ext = (logo.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${workspace.id}/brand/${brand.id}/logo.${ext}`;
    const { error } = await admin.storage.from("media").upload(path, logo, { upsert: true, contentType: logo.type });
    if (error) throw error;
    logoUrl = admin.storage.from("media").getPublicUrl(path).data.publicUrl;
  }
  const kit = brandKitSchema.parse({
    tagline: formData.get("tagline") ?? "",
    description: formData.get("description") ?? "",
    audience: formData.get("audience") ?? "",
    toneWords: list(formData.get("toneWords")),
    colors: list(formData.get("colors")),
    fonts: list(formData.get("fonts")),
    logoUrl,
    samplePosts: lines(formData.get("samplePosts")),
    defaultCta: String(formData.get("defaultCta") ?? "").trim() || undefined,
    hashtagSets: lines(formData.get("hashtagSets")),
  });
  const bannedWords = list(formData.get("bannedWords")).flatMap((w) => w.split(/\r?\n/)).map((w) => w.trim()).filter(Boolean);
  const name = String(formData.get("name") ?? "").trim() || brand.name;
  await admin.from("brands").update({ name, kit, banned_words: bannedWords, voice_profile: buildVoiceProfile(kit, bannedWords) }).eq("id", brand.id).eq("workspace_id", workspace.id);
  revalidatePath("/brand");
  revalidatePath("/", "layout");
}
