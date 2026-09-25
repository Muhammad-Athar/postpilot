import type { Platform } from "@/lib/platforms/rules";

export type LoadedImage = { bytes: Buffer; contentType: string; alt: string };
export type PublishInput = { draftId: string; platform: Platform; text: string; images: LoadedImage[]; mediaUrls: string[]; altText: string | null; firstComment: string | null };
export type PublishResult = { externalId: string; permalink: string; warnings: string[] };
export type MetricSet = { likes: number; reposts: number; replies: number; views?: number; followers?: number };

/** `auth`: credentials are dead (reconnect, never retry). `transient`: retry with backoff. `permanent`: give up with the reason. */
export class PublishError extends Error {
  constructor(message: string, public kind: "auth" | "transient" | "permanent") { super(message); this.name = "PublishError"; }
}

export interface Publisher {
  platform: Platform;
  publish(input: PublishInput): Promise<PublishResult>;
  fetchPostMetrics(externalId: string): Promise<MetricSet>;
  fetchAccountMetrics(): Promise<{ followers: number }>;
  /** Throws PublishError("auth") when the stored credentials no longer work. */
  healthcheck(): Promise<void>;
}
