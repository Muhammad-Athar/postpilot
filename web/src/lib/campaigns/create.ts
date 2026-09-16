import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { resolveSettings } from "./settings";
import { isOwnStorageUrl } from "@/lib/net/safe-fetch";

const httpUrl = z.string().url().max(2048).refine((u) => /^https?:\/\//i.test(u), "Only http(s) URLs are allowed");
export const referenceSchema = z.object({
  kind: z.enum(["image", "video", "url"]),
  url: httpUrl,
  name: z.string().max(200).optional(),
});
export const MAX_PROMPT_CHARS = 4000;
export const MAX_REFERENCES = 10;
export type Reference = z.infer<typeof referenceSchema>;

export async function createCampaign(
  db: SupabaseClient,
  input: { workspaceId: string; brandId: string; prompt: string; references: Reference[]; overrides: unknown; defaults: unknown },
) {
  const prompt = z.string().trim().min(1, "Prompt is required").max(MAX_PROMPT_CHARS).parse(input.prompt);
  const settings = resolveSettings(input.defaults, input.overrides);
  const references = z.array(referenceSchema).max(MAX_REFERENCES).parse(input.references);
  for (const r of references) {
    if (r.kind !== "url" && !isOwnStorageUrl(r.url)) throw new Error("Image and video references must be uploaded to Postpilot storage");
  }
  const { data, error } = await db
    .from("campaigns")
    .insert({ workspace_id: input.workspaceId, brand_id: input.brandId, prompt, references, settings, status: "queued" })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id as string, settings };
}
