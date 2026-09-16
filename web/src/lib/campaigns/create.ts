import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { resolveSettings } from "./settings";

export const referenceSchema = z.object({
  kind: z.enum(["image", "video", "url"]),
  url: z.string().url(),
  name: z.string().optional(),
});
export type Reference = z.infer<typeof referenceSchema>;

export async function createCampaign(
  db: SupabaseClient,
  input: { workspaceId: string; brandId: string; prompt: string; references: Reference[]; overrides: unknown; defaults: unknown },
) {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Prompt is required");
  const settings = resolveSettings(input.defaults, input.overrides);
  const references = z.array(referenceSchema).parse(input.references);
  const { data, error } = await db
    .from("campaigns")
    .insert({ workspace_id: input.workspaceId, brand_id: input.brandId, prompt, references, settings, status: "queued" })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id as string, settings };
}
