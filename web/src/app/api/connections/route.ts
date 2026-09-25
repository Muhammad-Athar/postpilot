import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { seal } from "@/lib/publishers/credentials";
import { safeFetch } from "@/lib/net/safe-fetch";
import { listZernioAccounts, zernioApiKey, ZERNIO_PLATFORM } from "@/lib/publishers/zernio";
import { PLATFORM_RULES } from "@/lib/platforms/rules";

const body = z.discriminatedUnion("platform", [
  z.object({ platform: z.literal("bluesky"), handle: z.string().min(3).max(253).transform((h) => h.replace(/^@/, "").toLowerCase()), appPassword: z.string().min(8).max(100) }),
  z.object({ platform: z.literal("mastodon"), instance: z.string().url(), accessToken: z.string().min(10).max(500) }),
  z.object({ platform: z.enum(["x", "tiktok", "youtube", "linkedin", "threads", "pinterest"]) }),
]);

/** Stores native-platform credentials (encrypted) after a lightweight verification call. */
export async function POST(req: Request) {
  const { workspace, brand, admin } = await getSession();
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Check the fields and try again." }, { status: 400 });
  const p = parsed.data;
  let externalId: string;
  let adapter: "native" | "late" = "native";
  let sealed: string;
  try {
    if (p.platform !== "bluesky" && p.platform !== "mastodon") {
      // Aggregator platforms: the account is linked inside Zernio; we store its id.
      const key = zernioApiKey();
      if (!key) return NextResponse.json({ error: "Zernio is not configured on this server." }, { status: 400 });
      const wanted = ZERNIO_PLATFORM[p.platform];
      const account = (await listZernioAccounts(key)).find((x) => x.platform === wanted && x.isActive);
      if (!account) return NextResponse.json({ error: `No ${PLATFORM_RULES[p.platform].label} account is connected in Zernio yet. Link it at zernio.com, then try again.` }, { status: 400 });
      externalId = account.username; adapter = "late"; sealed = seal({ accountId: account.id });
    } else if (p.platform === "bluesky") {
      const r = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: p.handle, password: p.appPassword }) });
      if (!r.ok) return NextResponse.json({ error: "Bluesky rejected the handle or app password." }, { status: 400 });
      externalId = (await r.json()).handle ?? p.handle; sealed = seal(p);
    } else {
      const r = await safeFetch(`${p.instance.replace(/\/$/, "")}/api/v1/accounts/verify_credentials`, { headers: { authorization: `Bearer ${p.accessToken}` }, maxRedirects: 0, maxBytes: 256 * 1024 });
      if (r.status !== 200) return NextResponse.json({ error: "Mastodon rejected the token (the instance must answer directly, without redirects)." }, { status: 400 });
      externalId = `@${JSON.parse(r.bytes.toString("utf8")).username}@${new URL(p.instance).host}`; sealed = seal(p);
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not verify" }, { status: 400 });
  }
  const { error } = await admin.from("connected_accounts").upsert({ workspace_id: workspace.id, brand_id: brand.id, platform: p.platform, adapter, external_id: externalId, tokens_encrypted: sealed, status: "ok" }, { onConflict: "brand_id,platform" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, externalId });
}

export async function DELETE(req: Request) {
  const { brand, admin } = await getSession();
  const { platform } = await req.json().catch(() => ({}));
  if (typeof platform !== "string") return NextResponse.json({ error: "platform required" }, { status: 400 });
  await admin.from("connected_accounts").delete().eq("brand_id", brand.id).eq("platform", platform);
  return NextResponse.json({ ok: true });
}
