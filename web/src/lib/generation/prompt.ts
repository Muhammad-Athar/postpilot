import { PLATFORM_RULES, type Platform } from "@/lib/platforms/rules";
import type { CampaignSettings } from "@/lib/campaigns/settings";

export interface FeedbackContext {
  recentEvents: { action: string; note?: string; editDiff?: unknown }[];
  positiveExamples: string[];
  negativeExamples: string[];
  hardInstruction?: string;
  requireChanges: boolean;
}

export interface GenerationInput {
  brand: { name: string; voiceProfile: string };
  settings: CampaignSettings;
  prompt: string;
  references: string[];
  preferenceSummary: string | null;
  feedback: FeedbackContext | null;
  platforms?: Platform[];
  candidatesPerSlot?: number;
}

export interface PromptBundle {
  platform: Platform;
  candidateIndex: number;
  system: string;
  user: string;
}

const ANGLES = [
  "the most direct, benefit-first angle",
  "a different angle: story, contrast, or a surprising detail",
  "a third angle: a question or a bold claim the audience would argue with",
];

/** One bundle per platform × candidate. Pure; no I/O. */
export function buildGenerationPrompts(input: GenerationInput): PromptBundle[] {
  const platforms = input.platforms ?? input.settings.platforms;
  const n = input.candidatesPerSlot ?? input.settings.candidatesPerSlot;
  const system = [
    `You write social media content for the brand "${input.brand.name}".`,
    input.brand.voiceProfile,
    input.preferenceSummary ? `What this brand's owner has shown they like and dislike:\n${input.preferenceSummary}` : "",
    "Return only JSON matching the schema. Be specific and concrete; no filler, no generic AI phrasing.",
  ].filter(Boolean).join("\n\n");

  const out: PromptBundle[] = [];
  for (const platform of platforms) {
    const r = PLATFORM_RULES[platform];
    const hashtags = Math.min(Math.max(input.settings.hashtagCount, r.hashtagMin), r.hashtagMax);
    for (let i = 0; i < n; i++) {
      const wantsVideo = input.settings.videosCount > 0 && r.supportsVideo && i === 0;
      const parts = [
        `Brand: ${input.brand.name}.`,
        `Platform: ${r.label}. Caption limit ${r.captionMax} characters. Use ${hashtags} hashtags${r.firstCommentHashtags ? " placed in firstComment, not the caption" : ""}. Hook style: ${r.hookStyle}. Aspect ratio ${r.aspect}.`,
        `Tone: ${input.settings.tone}. Language: ${input.settings.language}.${input.settings.cta ? ` CTA: ${input.settings.cta}.` : ""}`,
        `Brief from the owner:\n${input.prompt}`,
        input.references.length ? `Reference material:\n${input.references.map((s, k) => `${k + 1}. ${s}`).join("\n")}` : "",
        `Candidate ${i + 1} of ${n}: take ${ANGLES[i] ?? ANGLES[ANGLES.length - 1]}.`,
        `mediaPlan: ${wantsVideo
          ? `prefer kind "video" with ${input.settings.videoLength}s of scenes (each scene 3-6 seconds)`
          : `choose "use_reference_image" if a reference image fits, else "generate_image" with a detailed prompt, else "none"`}.`,
        "altText: describe the intended image in one sentence.",
      ];
      const f = input.feedback;
      if (f) {
        if (f.hardInstruction) parts.push(`Owner's explicit instruction (must follow): ${f.hardInstruction}`);
        if (f.positiveExamples.length) parts.push(`Posts the owner approved (match this feel):\n${f.positiveExamples.map((p) => `- ${p}`).join("\n")}`);
        if (f.negativeExamples.length) parts.push(`Posts the owner rejected (avoid this feel):\n${f.negativeExamples.map((p) => `- ${p}`).join("\n")}`);
        if (f.recentEvents.length) parts.push(`Recent feedback signals: ${f.recentEvents.map((e) => (e.note ? `${e.action}: "${e.note}"` : e.action)).join("; ")}`);
        if (f.requireChanges) parts.push("The owner asked for a new version without saying why. Infer what they disliked from the signals above and change at least two of: hook, angle, format, length, CTA. List each change as a short sentence in changeNotes.");
      }
      out.push({ platform, candidateIndex: i, system, user: parts.filter(Boolean).join("\n\n") });
    }
  }
  return out;
}
