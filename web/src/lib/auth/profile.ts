"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth/session";
import { validateProfileInput, validatePasswordInput } from "./validators";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Updates display name, email (immediately, via the admin API) and optional avatar. */
export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const { user, admin } = await getSession();
  const v = validateProfileInput({ displayName: String(formData.get("displayName") ?? ""), email: String(formData.get("email") ?? user.email ?? "") });
  if (!v.ok) return v;
  let avatar_url = (user.user_metadata?.avatar_url as string | undefined) ?? undefined;
  const file = formData.get("avatar");
  if (file instanceof File && file.size > 0) {
    if (!/^image\//.test(file.type)) return { ok: false, error: "Avatar must be an image." };
    if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Avatar must be under 2 MB." };
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `avatars/${user.id}/avatar.${ext}`;
    const { error } = await admin.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
    if (error) return { ok: false, error: error.message };
    avatar_url = `${admin.storage.from("media").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  }
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email: v.value.email, email_confirm: true,
    user_metadata: { ...(user.user_metadata ?? {}), display_name: v.value.displayName, avatar_url },
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Verifies the current password by signing in on a throwaway client, then sets the new one. */
export async function changePassword(formData: FormData): Promise<ActionResult> {
  const { user, admin } = await getSession();
  const v = validatePasswordInput({ current: String(formData.get("current") ?? ""), next: String(formData.get("next") ?? ""), confirm: String(formData.get("confirm") ?? "") });
  if (!v.ok) return v;
  const probe = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: bad } = await probe.auth.signInWithPassword({ email: user.email!, password: v.value.current });
  if (bad) return { ok: false, error: "Current password is incorrect." };
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: v.value.next });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
