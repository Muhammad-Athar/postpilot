import type { Platform } from "@/lib/platforms/rules";
import { open } from "./credentials";
import { createBlueskyPublisher } from "./bluesky";
import { createMastodonPublisher } from "./mastodon";
import { createZernioPublisher, zernioApiKey } from "./zernio";
import { PublishError, type Publisher } from "./types";

export type StoredAccount = { adapter: "native" | "late"; tokens_encrypted: string; external_id: string | null };

/** Builds the adapter for a stored connection. Throws PublishError("auth") when the stored credentials cannot be used. */
export function getPublisher(platform: Platform, account: StoredAccount): Publisher {
  if (account.adapter === "late") {
    const apiKey = zernioApiKey();
    if (!apiKey) throw new PublishError("ZERNIO_API_KEY is not set on the server.", "auth");
    const { accountId } = open<{ accountId: string }>(account.tokens_encrypted);
    return createZernioPublisher({ apiKey, accountId, platform });
  }
  if (platform === "bluesky") return createBlueskyPublisher(open<{ handle: string; appPassword: string }>(account.tokens_encrypted));
  if (platform === "mastodon") return createMastodonPublisher(open<{ instance: string; accessToken: string }>(account.tokens_encrypted));
  throw new PublishError(`${platform} publishing is not available yet (Meta app review pending).`, "permanent");
}
