import { safeFetch } from "@/lib/net/safe-fetch";
import { PublishError, type MetricSet, type Publisher, type PublishInput, type PublishResult } from "./types";

function classify(status: number, body: string): PublishError {
  if (status === 401 || status === 403) return new PublishError("Mastodon rejected the access token. Reconnect the account.", "auth");
  if (status === 429 || status >= 500) return new PublishError(`Mastodon is unavailable (HTTP ${status}). Will retry.`, "transient");
  if (status === 422 && /processing/i.test(body)) return new PublishError("Mastodon is still processing the media. Will retry.", "transient");
  return new PublishError(`Mastodon refused the post (HTTP ${status}): ${body.slice(0, 200)}`, "permanent");
}

type Part = { name: string; value: string | { bytes: Buffer; contentType: string; filename: string } };
function multipart(parts: Part[]): { body: Uint8Array; contentType: string } {
  const boundary = `----postpilot${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const chunks: Buffer[] = [];
  for (const p of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (typeof p.value === "string") chunks.push(Buffer.from(`Content-Disposition: form-data; name="${p.name}"\r\n\r\n${p.value}\r\n`));
    else { chunks.push(Buffer.from(`Content-Disposition: form-data; name="${p.name}"; filename="${p.value.filename}"\r\nContent-Type: ${p.value.contentType}\r\n\r\n`)); chunks.push(p.value.bytes); chunks.push(Buffer.from("\r\n")); }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: new Uint8Array(Buffer.concat(chunks)), contentType: `multipart/form-data; boundary=${boundary}` };
}

/** Mastodon adapter. The instance is user-supplied, so every call goes through safeFetch (SSRF guard, no redirects). */
export function createMastodonPublisher(creds: { instance: string; accessToken: string }): Publisher {
  const base = creds.instance.replace(/\/$/, "");
  const call = async <T>(path: string, init: { method?: string; body?: string | Uint8Array; contentType?: string } = {}): Promise<T> => {
    let r: { bytes: Buffer; status: number };
    try {
      r = await safeFetch(`${base}${path}`, { method: init.method ?? "GET", body: init.body, headers: { authorization: `Bearer ${creds.accessToken}`, ...(init.contentType ? { "content-type": init.contentType } : {}) }, maxRedirects: 0, maxBytes: 512 * 1024, timeoutMs: 20000 });
    } catch (e) { throw new PublishError(`Mastodon unreachable: ${e instanceof Error ? e.message : e}`, "transient"); }
    const text = r.bytes.toString("utf8");
    if (r.status < 200 || r.status >= 300) throw classify(r.status, text);
    return JSON.parse(text) as T;
  };
  return {
    platform: "mastodon",
    async healthcheck() { await call("/api/v1/accounts/verify_credentials"); },
    async publish(input: PublishInput): Promise<PublishResult> {
      const media_ids: string[] = [];
      for (const [i, im] of input.images.slice(0, 4).entries()) {
        const mp = multipart([{ name: "file", value: { bytes: im.bytes, contentType: im.contentType, filename: `image-${i}.${im.contentType.split("/")[1] ?? "jpg"}` } }, { name: "description", value: im.alt || input.altText || "" }]);
        const up = await call<{ id: string }>("/api/v2/media", { method: "POST", body: mp.body, contentType: mp.contentType });
        media_ids.push(up.id);
      }
      const res = await call<{ id: string; url: string }>("/api/v1/statuses", { method: "POST", body: JSON.stringify({ status: input.text, media_ids, visibility: "public" }), contentType: "application/json" });
      return { externalId: res.id, permalink: res.url, warnings: [] };
    },
    async fetchPostMetrics(id: string): Promise<MetricSet> {
      const s = await call<{ favourites_count: number; reblogs_count: number; replies_count: number }>(`/api/v1/statuses/${encodeURIComponent(id)}`);
      return { likes: s.favourites_count ?? 0, reposts: s.reblogs_count ?? 0, replies: s.replies_count ?? 0 };
    },
    async fetchAccountMetrics() { const a = await call<{ followers_count: number }>("/api/v1/accounts/verify_credentials"); return { followers: a.followers_count ?? 0 }; },
  };
}
