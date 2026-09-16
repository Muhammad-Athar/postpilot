export const PLATFORMS = ["instagram", "facebook", "tiktok", "youtube", "linkedin", "x", "threads", "pinterest", "bluesky", "mastodon"] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface PlatformRules {
  label: string;
  captionMax: number;
  hashtagMin: number;
  hashtagMax: number;
  aspect: "9:16" | "1:1" | "4:5" | "16:9";
  hookStyle: string;
  supportsVideo: boolean;
  supportsCarousel: boolean;
  firstCommentHashtags: boolean;
  adapter: "native" | "late";
}

export const PLATFORM_RULES: Record<Platform, PlatformRules> = {
  instagram: { label: "Instagram", captionMax: 2200, hashtagMin: 3, hashtagMax: 15, aspect: "4:5", hookStyle: "first line must stop the scroll; emojis ok; line breaks", supportsVideo: true, supportsCarousel: true, firstCommentHashtags: true, adapter: "native" },
  facebook: { label: "Facebook", captionMax: 2000, hashtagMin: 0, hashtagMax: 3, aspect: "1:1", hookStyle: "conversational, question or story opener", supportsVideo: true, supportsCarousel: true, firstCommentHashtags: false, adapter: "native" },
  tiktok: { label: "TikTok", captionMax: 2200, hashtagMin: 3, hashtagMax: 6, aspect: "9:16", hookStyle: "on-screen hook in first 2 seconds; casual; trend-aware", supportsVideo: true, supportsCarousel: true, firstCommentHashtags: false, adapter: "late" },
  youtube: { label: "YouTube Shorts", captionMax: 100, hashtagMin: 1, hashtagMax: 3, aspect: "9:16", hookStyle: "title-like, curiosity gap, #Shorts", supportsVideo: true, supportsCarousel: false, firstCommentHashtags: false, adapter: "late" },
  linkedin: { label: "LinkedIn", captionMax: 3000, hashtagMin: 2, hashtagMax: 5, aspect: "1:1", hookStyle: "professional insight, no clickbait, short paragraphs", supportsVideo: true, supportsCarousel: true, firstCommentHashtags: false, adapter: "late" },
  x: { label: "X", captionMax: 280, hashtagMin: 0, hashtagMax: 2, aspect: "16:9", hookStyle: "punchy one-liner, no hashtags mid-sentence", supportsVideo: true, supportsCarousel: false, firstCommentHashtags: false, adapter: "late" },
  threads: { label: "Threads", captionMax: 500, hashtagMin: 0, hashtagMax: 1, aspect: "4:5", hookStyle: "casual, conversational, one topic tag max", supportsVideo: true, supportsCarousel: true, firstCommentHashtags: false, adapter: "late" },
  pinterest: { label: "Pinterest", captionMax: 500, hashtagMin: 2, hashtagMax: 5, aspect: "9:16", hookStyle: "descriptive, keyword-rich title first", supportsVideo: true, supportsCarousel: false, firstCommentHashtags: false, adapter: "late" },
  bluesky: { label: "Bluesky", captionMax: 300, hashtagMin: 0, hashtagMax: 2, aspect: "16:9", hookStyle: "plain, witty, no marketing voice", supportsVideo: true, supportsCarousel: false, firstCommentHashtags: false, adapter: "native" },
  mastodon: { label: "Mastodon", captionMax: 500, hashtagMin: 1, hashtagMax: 4, aspect: "16:9", hookStyle: "plain, community tone, CamelCase hashtags", supportsVideo: true, supportsCarousel: false, firstCommentHashtags: false, adapter: "native" },
};
