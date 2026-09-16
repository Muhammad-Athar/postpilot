import type { BrandKit } from "./schema";

/** Plain-text voice profile injected into every generation prompt. */
export function buildVoiceProfile(kit: BrandKit, bannedWords: string[]): string {
  const lines = [
    `Voice: ${kit.toneWords.join(", ") || "clear and human"}.`,
    kit.description && `About: ${kit.description}`,
    kit.tagline && `Tagline: ${kit.tagline}`,
    kit.audience && `Audience: ${kit.audience}`,
    kit.defaultCta && `Default CTA: ${kit.defaultCta}`,
    kit.samplePosts.length && `Sample posts in our voice:\n${kit.samplePosts.map((p) => `- ${p}`).join("\n")}`,
    bannedWords.length && `Never use: ${bannedWords.join(", ")}`,
  ].filter(Boolean);
  return lines.join("\n");
}
