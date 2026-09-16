import { z } from "zod";

export const brandKitSchema = z.object({
  tagline: z.string().default(""),
  description: z.string().default(""),
  audience: z.string().default(""),
  toneWords: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
  fonts: z.array(z.string()).default([]),
  logoUrl: z.string().url().optional(),
  samplePosts: z.array(z.string()).default([]),
  defaultCta: z.string().optional(),
  hashtagSets: z.array(z.string()).default([]),
});
export type BrandKit = z.infer<typeof brandKitSchema>;
