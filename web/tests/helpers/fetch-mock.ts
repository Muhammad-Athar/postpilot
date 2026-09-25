import { vi } from "vitest";
export type Call = { url: string; init?: RequestInit };
/** Replaces global fetch with a router: each handler gets (url, init) and returns a Response. Records calls. */
export function mockFetch(routes: Record<string, (url: string, init?: RequestInit) => Response | Promise<Response>>) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return new Response("no route", { status: 599 });
    return routes[key](url, init);
  }));
  return { calls, json: (i: number) => JSON.parse(String(calls[i].init?.body)) };
}
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
