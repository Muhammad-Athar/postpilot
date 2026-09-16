import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

/** RFC1918, loopback, link-local, CGNAT, unspecified, and IPv6 equivalents (incl. IPv4-mapped). */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const l = ip.toLowerCase();
  return l === "::" || l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("fec0");
}

type Resolver = (host: string) => Promise<string[]>;
const defaultResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((r) => r.address);

/** Throws unless `url` is http(s), has no credentials, and every resolved address is public. Returns the validated addresses. */
export async function assertPublicHttpUrl(url: string, resolve: Resolver = defaultResolver): Promise<string[]> {
  let u: URL;
  try { u = new URL(url); } catch { throw new Error("Invalid URL"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http(s) URLs are allowed");
  if (u.username || u.password) throw new Error("URLs with credentials are not allowed");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Host not allowed");
  const addrs = isIP(host) ? [host] : await resolve(host);
  if (!addrs.length) throw new Error("Host could not be resolved");
  if (addrs.some(isPrivateAddress)) throw new Error("Host resolves to a private address");
  return addrs;
}

/** An agent that connects only to a pre-validated address, defeating DNS rebinding between check and use. */
function pinnedAgent(address: string, timeoutMs: number) {
  return new Agent({
    connect: {
      timeout: timeoutMs,
      lookup: (_host, _opts, cb) => cb(null, [{ address, family: isIP(address) === 6 ? 6 : 4 }]),
    },
  });
}

/** True only for public object URLs inside this project's `media` bucket. */
export function isOwnStorageUrl(url: string): boolean {
  try {
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    const u = new URL(url);
    return u.protocol === "https:" && u.host === base.host && u.pathname.startsWith("/storage/v1/object/public/media/");
  } catch {
    return false;
  }
}

/** Fetch with SSRF guard, manual redirect handling (each hop re-validated), timeout and byte cap. */
export async function safeFetch(url: string, opts: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number } = {}): Promise<{ bytes: Buffer; contentType: string }> {
  const { maxBytes = 15 * 1024 * 1024, timeoutMs = 10_000, maxRedirects = 3 } = opts;
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const [address] = await assertPublicHttpUrl(current);
    const dispatcher = pinnedAgent(address, timeoutMs);
    const res = await undiciFetch(current, { dispatcher, redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "PostpilotBot/1.0" } });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Redirect without location");
      current = new URL(loc, current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`Fetch failed with ${res.status}`);
    const len = Number(res.headers.get("content-length") || 0);
    if (len > maxBytes) throw new Error("Response too large");
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = []; let total = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) { await reader.cancel(); throw new Error("Response too large"); }
      chunks.push(value);
    }
    return { bytes: Buffer.concat(chunks), contentType: res.headers.get("content-type") ?? "" };
  }
  throw new Error("Too many redirects");
}
