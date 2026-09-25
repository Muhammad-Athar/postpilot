import { z } from "zod";

/** "#Tag" from "tag", "#tag", " #Tag " or "#Tag"; drops empties and duplicates. */
export function normaliseHashtags(tags: string[]): string[] {
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim().replace(/^#+/, "").replace(/\s+/g, "");
    if (!t) continue;
    const tag = `#${t}`;
    if (!out.some((x) => x.toLowerCase() === tag.toLowerCase())) out.push(tag);
  }
  return out;
}
/** Ensures space-separated tokens that look like tags in a first-comment string carry '#'. */
export function normaliseHashtagsInText(text: string): string {
  const tokens = text.trim().split(/\s+/);
  if (tokens.length === 0 || !tokens.every((t) => /^#?[\p{L}\p{N}_]+$/u.test(t))) return text;
  return normaliseHashtags(tokens).join(" ");
}

export const mediaPlanSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("use_reference_image"), index: z.number().int().min(0) }),
  z.object({ kind: z.literal("generate_image"), prompt: z.string().min(1) }),
  z.object({ kind: z.literal("carousel"), slides: z.array(z.object({ title: z.string(), body: z.string() })).min(2).max(10) }),
  z.object({ kind: z.literal("video"), scenes: z.array(z.object({ onScreenText: z.string(), voiceover: z.string(), visual: z.string() })).min(1).max(12) }),
  z.object({ kind: z.literal("none") }),
]);

export const draftOutputSchema = z.object({
  hook: z.string().min(1),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).default([]).transform((tags) => normaliseHashtags(tags)),
  firstComment: z.string().nullable().default(null).transform((v) => (v ? normaliseHashtagsInText(v) : v)),
  altText: z.string().nullable().default(null),
  mediaPlan: mediaPlanSchema,
  changeNotes: z.array(z.string()).default([]),
});
export type DraftOutput = z.infer<typeof draftOutputSchema>;
export type MediaPlan = z.infer<typeof mediaPlanSchema>;

/** Plain JSON schema handed to Gemini as responseSchema (OpenAPI subset). */
export const RESPONSE_JSON_SCHEMA = {
  type: "object",
  required: ["hook", "caption", "hashtags", "firstComment", "altText", "mediaPlan", "changeNotes"],
  properties: {
    hook: { type: "string" },
    caption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    firstComment: { type: "string", nullable: true },
    altText: { type: "string", nullable: true },
    mediaPlan: {
      type: "object",
      required: ["kind"],
      properties: {
        kind: { type: "string", enum: ["use_reference_image", "generate_image", "carousel", "video", "none"] },
        index: { type: "integer" },
        prompt: { type: "string" },
        slides: { type: "array", items: { type: "object", properties: { title: { type: "string" }, body: { type: "string" } }, required: ["title", "body"] } },
        scenes: { type: "array", items: { type: "object", properties: { onScreenText: { type: "string" }, voiceover: { type: "string" }, visual: { type: "string" } }, required: ["onScreenText", "voiceover", "visual"] } },
      },
    },
    changeNotes: { type: "array", items: { type: "string" } },
  },
} as const;
