import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

/** Extracts an embedded IPv4 from IPv4-mapped (::ffff:a.b.c.d or ::ffff:XXXX:XXXX) or NAT64 (64:ff9b::a.b.c.d / hex) IPv6 forms. */
function embeddedIPv4(ip: string): string | null {
  const l = ip.toLowerCase();
  const m = l.match(/^(?:::ffff:|64:ff9b::)(.+)$/);
  if (!m) return null;
  const tail = m[1];
  if (isIP(tail) === 4) return tail;
  const hex = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return null;
  const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

/** Loopback, RFC1918, link-local, CGNAT, multicast, reserved, documentation and benchmark ranges, plus IPv6 equivalents. Anything not clearly public is private. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = isIP(ip) === 4 ? ip : embeddedIPv4(ip);
  if (v4) {
    const [a, b, c] = v4.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)
    );
  }
  if (isIP(ip) !== 6) return true;
  const l = ip.toLowerCase();
  return l === "::" || l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("fec0") || l.startsWith("ff") || l.startsWith("2001:db8") || l.startsWith("::ffff:") || l.startsWith("64:ff9b:");
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
export async function safeFetch(url: string, opts: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number; headers?: Record<string, string>; method?: string; body?: string | Uint8Array } = {}): Promise<{ bytes: Buffer; contentType: string; status: number }> {
  const { maxBytes = 15 * 1024 * 1024, timeoutMs = 10_000, maxRedirects = 3, headers = {}, method = "GET", body } = opts;
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const [address] = await assertPublicHttpUrl(current);
    const dispatcher = pinnedAgent(address, timeoutMs);
    try {
      // Auth headers are sent only to the original host; a redirect drops them.
      const hop0 = current === url;
      const res = await undiciFetch(current, { dispatcher, method, body, redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "PostpilotBot/1.0", ...(hop0 ? headers : {}) } });
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get("location");
        if (!loc) throw new Error("Redirect without location");
        await res.body?.cancel();
        current = new URL(loc, current).toString();
        continue;
      }
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
      return { bytes: Buffer.concat(chunks), contentType: res.headers.get("content-type") ?? "", status: res.status };
    } finally {
      await dispatcher.close();
    }
  }
  throw new Error("Too many redirects");
}
