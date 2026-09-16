import { z } from "zod";
import { PLATFORMS } from "@/lib/platforms/rules";

export const campaignSettingsSchema = z.object({
  postsCount: z.number().int().min(1).max(10).default(3),
  videosCount: z.number().int().min(0).max(5).default(1),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  tone: z.string().min(1).default("friendly, confident, specific"),
  language: z.string().min(2).default("en"),
  cta: z.string().optional(),
  hashtagCount: z.number().int().min(0).max(30).default(5),
  videoLength: z.enum(["15", "30", "60"]).default("30"),
  voice: z.string().default("Kore"),
  allowAiBroll: z.boolean().default(false),
  candidatesPerSlot: z.union([z.literal(2), z.literal(3)]).default(2),
});
export type CampaignSettings = z.infer<typeof campaignSettingsSchema>;

const strip = (o: unknown) => Object.fromEntries(Object.entries((o ?? {}) as object).filter(([, v]) => v !== undefined));

/** Workspace defaults merged with per-request overrides, validated. Throws ZodError on bad input. */
export function resolveSettings(defaults: unknown, overrides: unknown): CampaignSettings {
  return campaignSettingsSchema.parse({ ...strip(defaults), ...strip(overrides) });
}
