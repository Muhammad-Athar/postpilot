# Postpilot Plan 2 — Close the loop: approvals, publishing, analytics

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An approved draft actually goes out: scheduled posts publish to Bluesky and Mastodon natively and to the Zernio-backed platforms through one adapter, metrics come back into Analytics, clients can approve from a login-free link, and the calendar lets the owner move or pull a post before it goes.

**Architecture:** A `Publisher` interface with one file per adapter (`bluesky`, `mastodon`, `zernio`). A secret-guarded `POST /api/publish/run` claims due `schedule_slots`, runs the pre-publish safety pass, publishes through the adapter, retries transient failures, and writes `publish_jobs` + draft status. n8n only provides the clocks: `postpilot-publish` (every 5 min) and `postpilot-analytics` (every 6 h) each make one HTTP call into the app. Approval links are HMAC tokens (already in `lib/approvals/token.ts`) rendered on a public `/a/[token]` page; the email is sent through an n8n `postpilot-notify` webhook when SMTP is configured, and the link is always copyable in-app so the feature works without email.

**Tech Stack:** Same as Plan 1/1b. No new runtime dependencies. Vitest with `vi.stubGlobal("fetch", …)` for adapter tests. Media stays text + images in this plan (video/image rendering is Plan 3).

**Spec:** `docs/superpowers/specs/2026-09-17-postpilot-design.md` §3 (publishers, approvals modules), §4 (publish_jobs, metric_snapshots, approval_tokens), §7 (publishing and analytics), §8 (pre-publish safety pass, token expiry), plus the pending-work inventory agreed with the user on 2026-09-26 (timezone picker, calendar reschedule, README).

## Global Constraints

- Free tiers only. Meta (Instagram/Facebook) stays disabled with its tooltip; the user will do the Meta app later. Telegram approvals are out of scope (user decision). Groq stays unused.
- Secrets only in `web/.env.local` / Vercel env / n8n credentials. Committed workflow JSON keeps `APP_BASE_URL_HERE` and credential placeholders. Never log tokens, app passwords or API keys.
- Every outbound fetch to a user-supplied host (Mastodon instance, media URLs) goes through `safeFetch` from `src/lib/net/safe-fetch.ts`. Fixed hosts (`bsky.social`, `public.api.bsky.app`, Zernio's API) may use plain `fetch`.
- Draft state machine is enforced by the `enforce_draft_transition` trigger; every transition this plan adds is mirrored in `src/lib/drafts/state.ts` and in migration `0005`.
- Keep the warm editorial system: tokens in `globals.css`, primitives in `src/components/ui`, Framer Motion, `prefers-reduced-motion` respected. Pointer cursor, hover, focus-visible, disabled states on every interactive element; tooltips where the label isn't self-explanatory.
- `npm test`, `npx tsc --noEmit`, `npm run lint` green before every commit. Commits authored as Muhammad Athar, no Claude trailer. Do not push unless the user asks.

## Review Focus

1. A post whose caption exceeds the platform limit after hashtags are appended (Bluesky 300 graphemes) must be trimmed at a word boundary with the hashtags kept, not rejected at publish time. Test in Task 4 (`composeText` trims).
2. Two runner invocations overlapping (n8n retried a timed-out call) must not double-publish: the slot claim is a conditional update that only one caller wins. Test in Task 7 (claim returns the row once).
3. A Bluesky or Mastodon credential revoked after connection must flip the account to `reconnect`, mark the draft `failed` with a readable reason, and never retry forever. Test in Task 7 (401 → `reconnect`, no retry).
4. An approval link opened twice, or after the draft was regenerated (version changed), must show "already handled" rather than approving the wrong version. Test in Task 3 (`used_at` set → 410; version mismatch → 410).
5. A media URL that is not on our own Storage or that exceeds Bluesky's 1 MB image limit must be skipped with the post still going out as text, and the skip recorded in `publish_jobs.error` as a warning. Test in Task 4 (oversize image → post without embed, warning string).

---

## File structure (created or modified)

```
supabase/migrations/0005_publishing.sql            trigger: scheduled→approved; drafts.permalink/publish_error/published_at; publish_jobs index (Task 2)
web/src/
  lib/schedule/timezones.ts                        list of IANA zones + isValidTimezone (Task 1)
  lib/schedule/mutate.ts                           rescheduleSlot / unscheduleSlot (Task 2)
  app/api/schedule/[slotId]/route.ts               PATCH reschedule, DELETE unschedule (Task 2)
  components/calendar/CalendarView.tsx             day panel actions: move, unschedule, publish now (Task 2, 7)
  app/(app)/settings/WorkspaceTab.tsx              timezone <Select> (Task 1)
  app/(app)/settings/actions.ts                    validate timezone (Task 1)
  lib/approvals/issue.ts                           createApprovalLink (DB row + URL) (Task 3)
  lib/approvals/consume.ts                         consumeApprovalToken (verify, single-use, version-bound) (Task 3)
  app/a/[token]/page.tsx                           public approval page (Task 3)
  app/api/approvals/[token]/route.ts               POST approve|reject from the public page (Task 3)
  app/api/drafts/[id]/share/route.ts               POST → { url } and optional email via n8n notify (Task 3)
  components/inbox/ShareForApproval.tsx            button + dialog on DraftCard (Task 3)
  lib/notify/send.ts                               sendEmail via n8n notify webhook (Task 3)
  lib/publishers/types.ts                          Publisher interface, PublishInput/Result, MetricSet (Task 4)
  lib/publishers/text.ts                           composeText: caption + hashtags within limit (Task 4)
  lib/publishers/media.ts                          loadImages: fetch own-storage images with size caps (Task 4)
  lib/publishers/bluesky.ts                        AT Protocol adapter (Task 4)
  lib/publishers/mastodon.ts                       Mastodon adapter (Task 5)
  lib/publishers/zernio.ts                         Zernio (Late) aggregator adapter (Task 6)
  lib/publishers/index.ts                          getPublisher(platform, account) (Task 6)
  app/api/connections/route.ts                     add zernio branch (Task 6)
  components/connections/PlatformCard.tsx          Zernio connect flow (Task 6)
  lib/publish/safety.ts                            prePublishCheck: banned words + Gemini claim check (Task 7)
  lib/publish/runner.ts                            claimDueSlots, publishSlot, runPublishBatch (Task 7)
  app/api/publish/run/route.ts                     POST secret-guarded batch (Task 7)
  app/api/publish/[slotId]/route.ts                POST publish now (session) (Task 7)
  lib/analytics/sync.ts                            syncAccountMetrics → metric_snapshots (Task 9)
  lib/analytics/aggregate.ts                       tiles + top post from snapshots (Task 9)
  app/api/analytics/sync/route.ts                  POST secret-guarded (Task 9)
  app/(app)/analytics/page.tsx                     real tiles (Task 9)
  components/inbox/DraftCard.tsx                   published link, failure reason, retry (Task 10)
  lib/schedule/events.ts                           permalink + error on events (Task 10)
n8n/workflows/postpilot-publish.json               Schedule 5 min → POST /api/publish/run (Task 8)
n8n/workflows/postpilot-analytics.json             Schedule 6 h → POST /api/analytics/sync (Task 8)
n8n/workflows/postpilot-notify.json                Webhook → SMTP send (Task 3, 8)
n8n/credentials.template.json                      + Postpilot SMTP (Task 8)
n8n/deploy.sh                                      activate the three new workflows (Task 8)
README.md                                          product README (Task 11)
web/tests/
  schedule/timezones.test.ts, schedule/mutate.test.ts
  approvals/consume.test.ts
  publishers/text.test.ts, publishers/media.test.ts, publishers/bluesky.test.ts, publishers/mastodon.test.ts, publishers/zernio.test.ts
  publish/safety.test.ts, publish/runner.test.ts
  analytics/aggregate.test.ts
```

Test helper used by every adapter test (create once in Task 4, `web/tests/helpers/fetch-mock.ts`):

```ts
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
```

---

### Task 1: Timezone picker

**Files:**
- Create: `web/src/lib/schedule/timezones.ts`
- Modify: `web/src/app/(app)/settings/WorkspaceTab.tsx`, `web/src/app/(app)/settings/actions.ts:5-13`
- Test: `web/tests/schedule/timezones.test.ts`

**Interfaces:**
- Produces: `TIMEZONES: string[]` (sorted IANA ids), `isValidTimezone(tz: string): boolean`, `timezoneLabel(tz: string, now?: Date): string` → e.g. `"Asia/Karachi (UTC+05:00)"`.

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/schedule/timezones.test.ts
import { describe, it, expect } from "vitest";
import { TIMEZONES, isValidTimezone, timezoneLabel } from "@/lib/schedule/timezones";
describe("timezones", () => {
  it("lists IANA zones and validates them", () => {
    expect(TIMEZONES).toContain("Asia/Karachi");
    expect(TIMEZONES).toContain("UTC");
    expect(isValidTimezone("Asia/Karachi")).toBe(true);
    expect(isValidTimezone("Asia/Karachee")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });
  it("labels a zone with its current offset", () => {
    expect(timezoneLabel("Asia/Karachi", new Date("2026-06-01T00:00:00Z"))).toBe("Asia/Karachi (UTC+05:00)");
    expect(timezoneLabel("UTC", new Date("2026-06-01T00:00:00Z"))).toBe("UTC (UTC+00:00)");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/schedule/timezones.test.ts`
Expected: FAIL, cannot find module `@/lib/schedule/timezones`.

- [ ] **Step 3: Implement**

```ts
// web/src/lib/schedule/timezones.ts
const supported = (): string[] => {
  const i = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  const list = i.supportedValuesOf ? i.supportedValuesOf("timeZone") : [];
  return Array.from(new Set(["UTC", ...list])).sort();
};
export const TIMEZONES: string[] = supported();
export function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}
/** "Asia/Karachi (UTC+05:00)" for the offset in force at `now`. */
export function timezoneLabel(tz: string, now = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const off = part === "GMT" ? "UTC+00:00" : part.replace("GMT", "UTC");
  return `${tz} (${off})`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/schedule/timezones.test.ts` → PASS.

- [ ] **Step 5: Use it in settings**

In `WorkspaceTab.tsx` replace the timezone `<Input>` with a select. Group nothing; one flat list with labels is fine (about 420 rows):

```tsx
import { TIMEZONES, timezoneLabel } from "@/lib/schedule/timezones";
// …
<Field label="Timezone" hint="Posting times and the calendar use this zone.">
  <Select name="timezone" defaultValue={workspace.timezone}>
    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{timezoneLabel(tz)}</option>)}
  </Select>
</Field>
```

In `settings/actions.ts` `updateWorkspace`, validate before writing and fall back to the current value on a bad one:

```ts
import { isValidTimezone } from "@/lib/schedule/timezones";
const requested = String(formData.get("timezone") || "");
const timezone = isValidTimezone(requested) ? requested : workspace.timezone;
```

Also validate posting times there: keep only entries matching `/^\d{1,2}:\d{2}$/` and default to `["10:00"]` when none survive.

- [ ] **Step 6: Verify and commit**

Run: `cd web && npm test && npx tsc --noEmit && npm run lint`. Open Settings → Workspace in Chrome (light + dark), pick a zone, save, confirm the calendar's times shift.

```bash
git add web/src/lib/schedule/timezones.ts web/src/app/\(app\)/settings web/tests/schedule/timezones.test.ts
git commit -m "feat(settings): timezone picker with validation"
```

---

### Task 2: Calendar reschedule and unschedule

**Files:**
- Create: `supabase/migrations/0005_publishing.sql`, `web/src/lib/schedule/mutate.ts`, `web/src/app/api/schedule/[slotId]/route.ts`
- Modify: `web/src/lib/drafts/state.ts`, `web/src/components/calendar/CalendarView.tsx`, `web/src/lib/schedule/events.ts`
- Test: `web/tests/schedule/mutate.test.ts`, `web/tests/drafts/state.test.ts`

**Interfaces:**
- Produces: `rescheduleSlot(admin, { slotId, brandId, at: Date }): Promise<void>`, `unscheduleSlot(admin, { slotId, brandId }): Promise<void>`; `CalendarEvent` gains `slotId?: string`, `status?: DraftStatus`, `permalink?: string | null`, `error?: string | null`. Later tasks (7, 10) rely on `drafts.permalink`, `drafts.publish_error`, `drafts.published_at` and on `scheduled → approved` being allowed.

- [ ] **Step 1: Migration**

```sql
-- supabase/migrations/0005_publishing.sql
-- Unschedule (scheduled → approved) and publish results on the draft row for the UI.
alter table drafts add column if not exists permalink text;
alter table drafts add column if not exists publish_error text;
alter table drafts add column if not exists published_at timestamptz;
create index if not exists publish_jobs_draft_idx on publish_jobs(draft_id, created_at desc);
create index if not exists metric_snapshots_account_time_idx on metric_snapshots(account_id, captured_at desc);

create or replace function enforce_draft_transition() returns trigger language plpgsql as $$
begin
  if old.status = new.status then return new; end if;
  if (old.status = 'draft' and new.status in ('approved','rejected'))
     or (old.status = 'approved' and new.status = 'scheduled')
     or (old.status = 'scheduled' and new.status in ('published','failed','approved'))
     or (old.status = 'failed' and new.status = 'scheduled') then
    return new;
  end if;
  raise exception 'invalid draft transition % -> %', old.status, new.status;
end $$;
```

Apply: `cd /Users/stellteck/Desktop/Upwork/postpilot && supabase db push` (linked project bffcigwxfksgjwcfyhdt; password in `web/.env.local` as `SUPABASE_DB_PASSWORD`). Then mirror in `state.ts`: `scheduled: ["published", "failed", "approved"]`. Add to `tests/drafts/state.test.ts`: `expect(canTransition("scheduled", "approved")).toBe(true)`.

- [ ] **Step 2: Write the failing test**

```ts
// web/tests/schedule/mutate.test.ts
import { describe, it, expect, vi } from "vitest";
import { rescheduleSlot, unscheduleSlot } from "@/lib/schedule/mutate";

/** Minimal chainable Supabase stub: records every call, returns `rows` from the terminal await. */
function stub(rows: Record<string, unknown[]>) {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const admin = { from: (table: string) => {
    const q: Record<string, unknown> = {}; let op = "select";
    const chain = new Proxy(q, { get: (_t, prop: string) => {
      if (prop === "then") return (res: (v: unknown) => void) => res({ data: rows[table] ?? [], error: null });
      return (...args: unknown[]) => { if (["select","update","delete","insert"].includes(prop)) op = prop; calls.push({ table, op: prop, args }); return chain; };
    } });
    return chain;
  } };
  return { admin: admin as never, calls };
}

describe("schedule mutations", () => {
  it("reschedule updates only a slot that belongs to the brand", async () => {
    const { admin, calls } = stub({ schedule_slots: [{ id: "s1", brand_id: "b1", draft_id: "d1", status: "filled" }] });
    await rescheduleSlot(admin, { slotId: "s1", brandId: "b1", at: new Date("2026-10-01T05:00:00Z") });
    const upd = calls.find((c) => c.table === "schedule_slots" && c.op === "update");
    expect(upd?.args[0]).toEqual({ scheduled_at: "2026-10-01T05:00:00.000Z" });
    expect(calls.some((c) => c.op === "eq" && c.args[0] === "brand_id" && c.args[1] === "b1")).toBe(true);
  });
  it("reschedule refuses a slot already published", async () => {
    const { admin } = stub({ schedule_slots: [{ id: "s1", brand_id: "b1", draft_id: "d1", status: "done" }] });
    await expect(rescheduleSlot(admin, { slotId: "s1", brandId: "b1", at: new Date() })).rejects.toThrow(/already published/);
  });
  it("unschedule deletes the slot and returns the draft to approved", async () => {
    const { admin, calls } = stub({ schedule_slots: [{ id: "s1", brand_id: "b1", draft_id: "d1", status: "filled" }] });
    await unscheduleSlot(admin, { slotId: "s1", brandId: "b1" });
    expect(calls.some((c) => c.table === "schedule_slots" && c.op === "delete")).toBe(true);
    const upd = calls.find((c) => c.table === "drafts" && c.op === "update");
    expect(upd?.args[0]).toEqual({ status: "approved" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails** — `npx vitest run tests/schedule/mutate.test.ts` → cannot find module.

- [ ] **Step 4: Implement**

```ts
// web/src/lib/schedule/mutate.ts
import type { SupabaseClient } from "@supabase/supabase-js";

type Slot = { id: string; brand_id: string; draft_id: string | null; status: string };
async function loadOwnedSlot(admin: SupabaseClient, slotId: string, brandId: string): Promise<Slot> {
  const { data } = await admin.from("schedule_slots").select("id, brand_id, draft_id, status").eq("id", slotId).eq("brand_id", brandId);
  const slot = (data as Slot[] | null)?.[0];
  if (!slot) throw Object.assign(new Error("slot not found"), { status: 404 });
  if (slot.status === "done") throw Object.assign(new Error("This post is already published."), { status: 409 });
  return slot;
}

/** Moves a pending slot to a new time. The draft stays `scheduled`. */
export async function rescheduleSlot(admin: SupabaseClient, a: { slotId: string; brandId: string; at: Date }): Promise<void> {
  await loadOwnedSlot(admin, a.slotId, a.brandId);
  if (a.at.getTime() < Date.now() - 60e3) throw Object.assign(new Error("Pick a time in the future."), { status: 400 });
  const { error } = await admin.from("schedule_slots").update({ scheduled_at: a.at.toISOString() }).eq("id", a.slotId).eq("brand_id", a.brandId);
  if (error) throw error;
}

/** Removes a pending slot and returns its draft to `approved` so it can be rescheduled from the inbox or calendar. */
export async function unscheduleSlot(admin: SupabaseClient, a: { slotId: string; brandId: string }): Promise<void> {
  const slot = await loadOwnedSlot(admin, a.slotId, a.brandId);
  const { error } = await admin.from("schedule_slots").delete().eq("id", a.slotId).eq("brand_id", a.brandId);
  if (error) throw error;
  if (slot.draft_id) await admin.from("drafts").update({ status: "approved" }).eq("id", slot.draft_id).eq("status", "scheduled");
}
```

- [ ] **Step 5: Run tests** — PASS.

- [ ] **Step 6: API route**

```ts
// web/src/app/api/schedule/[slotId]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { isUuid } from "@/lib/api/guard";
import { rescheduleSlot, unscheduleSlot } from "@/lib/schedule/mutate";

const patchBody = z.object({ at: z.string().datetime({ offset: true }) });
type Ctx = { params: Promise<{ slotId: string }> };
const fail = (e: unknown) => NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: (e as { status?: number }).status ?? 500 });

export async function PATCH(req: Request, { params }: Ctx) {
  const { brand, admin } = await getSession();
  const { slotId } = await params;
  if (!isUuid(slotId)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const parsed = patchBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  try { await rescheduleSlot(admin, { slotId, brandId: brand.id, at: new Date(parsed.data.at) }); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
export async function DELETE(_req: Request, { params }: Ctx) {
  const { brand, admin } = await getSession();
  const { slotId } = await params;
  if (!isUuid(slotId)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  try { await unscheduleSlot(admin, { slotId, brandId: brand.id }); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
```

- [ ] **Step 7: Events carry what the panel needs**

In `lib/schedule/events.ts` extend the type and the slot mapping:

```ts
export type CalendarEvent = { id: string; kind: "scheduled" | "published" | "failed" | "review" | "campaign"; title: string; time?: string; platform?: Platform; draftId?: string; campaignId?: string; slotId?: string; permalink?: string | null; error?: string | null };
// select adds: drafts(id, hook, status, campaign_id, permalink, publish_error)
push(at, { id: s.id, slotId: s.id, kind: …, title: …, time: hhmm(at), platform: s.platform as Platform, draftId: d?.id, campaignId: d?.campaign_id, permalink: d?.permalink ?? null, error: d?.publish_error ?? null });
```

- [ ] **Step 8: Day panel actions**

In `CalendarView.tsx`, each `scheduled` event card gets a row of three small buttons: **Move** (opens a `Dialog` with `<Input type="datetime-local">` prefilled from the event's date + time in the workspace zone; on submit `PATCH /api/schedule/{slotId}` with `at` = `fromZonedTime(value, tz).toISOString()` — pass `tz` as a new prop from `calendar/page.tsx`), **Unschedule** (`DELETE`, then `router.refresh()` and drop the month from `cache` so it reloads), and **Publish now** (wired in Task 7; render disabled with tooltip "Arrives with publishing" until then). `published` events show a "View post ↗" link to `permalink` (`target="_blank" rel="noopener"`); `failed` events show `error` in a `bg-danger-soft` box. Buttons are `Button size="sm" variant="secondary"` with `loading` while pending; errors from the API appear in a `text-danger` line under the card.

- [ ] **Step 9: Verify and commit**

`npm test && npx tsc --noEmit && npm run lint`. In Chrome: approve a draft, open the calendar, move it to tomorrow, confirm it appears there; unschedule it, confirm it disappears and the inbox shows it `approved`.

```bash
git add supabase/migrations/0005_publishing.sql web/src/lib/schedule web/src/lib/drafts/state.ts web/src/app/api/schedule web/src/components/calendar web/tests
git commit -m "feat(calendar): reschedule and unschedule from the day panel"
```

---

### Task 3: Approval links (agency mode)

**Files:**
- Create: `web/src/lib/approvals/issue.ts`, `web/src/lib/approvals/consume.ts`, `web/src/lib/notify/send.ts`, `web/src/app/a/[token]/page.tsx`, `web/src/app/api/approvals/[token]/route.ts`, `web/src/app/api/drafts/[id]/share/route.ts`, `web/src/components/inbox/ShareForApproval.tsx`, `n8n/workflows/postpilot-notify.json`
- Modify: `web/src/components/inbox/DraftCard.tsx`, `web/src/lib/brand/schema.ts` (add `approverEmail: z.string().email().optional()` and a field on the brand kit form under "Approvals" with hint "Client who receives approval links (agency mode)")
- Test: `web/tests/approvals/consume.test.ts`

**Interfaces:**
- Consumes: `issueApprovalToken`, `verifyApprovalToken`, `hashToken` from `lib/approvals/token.ts`; `applyDecision` from `lib/drafts/actions.ts`.
- Produces: `createApprovalLink(admin, { draft, channel, baseUrl }): Promise<{ url: string; expiresAt: Date }>`; `consumeApprovalToken(admin, token, secret): Promise<{ ok: true; draft: DraftRecord; tokenRowId: string } | { ok: false; status: 404 | 410; reason: string }>`; `sendEmail({ to, subject, html }): Promise<boolean>` (false when notify isn't configured, never throws).

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/approvals/consume.test.ts
import { describe, it, expect } from "vitest";
import { issueApprovalToken } from "@/lib/approvals/token";
import { consumeApprovalToken } from "@/lib/approvals/consume";

const SECRET = "test-secret";
const draft = { id: "11111111-1111-4111-8111-111111111111", workspace_id: "w", campaign_id: "c", brand_id: "b", platform: "bluesky", candidate_index: 0, version: 2, hook: "h", caption: "c", hashtags: [], first_comment: null, alt_text: null, status: "draft" };
function admin(tokenRow: Record<string, unknown> | null, draftRow = draft) {
  return { from: (table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "approval_tokens" ? tokenRow : null }), single: async () => ({ data: table === "drafts" ? draftRow : null }) }) }),
    update: () => ({ eq: async () => ({ error: null }) }),
  }) } as never;
}

describe("consumeApprovalToken", () => {
  const { token, tokenHash, expiresAt } = issueApprovalToken({ draftId: draft.id, draftVersion: 2, channel: "email", secret: SECRET });
  const row = { id: "t1", draft_id: draft.id, draft_version: 2, token_hash: tokenHash, expires_at: expiresAt.toISOString(), used_at: null };
  it("accepts a fresh token bound to the current version", async () => {
    const r = await consumeApprovalToken(admin(row), token, SECRET);
    expect(r.ok).toBe(true);
  });
  it("rejects a bad signature", async () => {
    const r = await consumeApprovalToken(admin(row), token.slice(0, -2) + "zz", SECRET);
    expect(r).toMatchObject({ ok: false, status: 404 });
  });
  it("rejects a used token", async () => {
    const r = await consumeApprovalToken(admin({ ...row, used_at: new Date().toISOString() }), token, SECRET);
    expect(r).toMatchObject({ ok: false, status: 410, reason: expect.stringMatching(/already/) });
  });
  it("rejects when the draft moved to a newer version or left review", async () => {
    expect(await consumeApprovalToken(admin(row, { ...draft, version: 3 }), token, SECRET)).toMatchObject({ ok: false, status: 410 });
    expect(await consumeApprovalToken(admin(row, { ...draft, status: "approved" }), token, SECRET)).toMatchObject({ ok: false, status: 410 });
  });
  it("rejects an unknown hash", async () => {
    expect(await consumeApprovalToken(admin(null), token, SECRET)).toMatchObject({ ok: false, status: 404 });
  });
});
```

- [ ] **Step 2: Run** — fails, module missing.

- [ ] **Step 3: Implement issue + consume + send**

```ts
// web/src/lib/approvals/issue.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { issueApprovalToken } from "./token";
export async function createApprovalLink(admin: SupabaseClient, a: { draft: { id: string; workspace_id: string; version: number }; channel: "link" | "email"; baseUrl: string }) {
  const t = issueApprovalToken({ draftId: a.draft.id, draftVersion: a.draft.version, channel: a.channel, secret: process.env.APP_SECRET! });
  const { error } = await admin.from("approval_tokens").insert({ workspace_id: a.draft.workspace_id, draft_id: a.draft.id, draft_version: a.draft.version, channel: a.channel, token_hash: t.tokenHash, expires_at: t.expiresAt.toISOString() });
  if (error) throw error;
  return { url: `${a.baseUrl.replace(/\/$/, "")}/a/${t.token}`, expiresAt: t.expiresAt };
}
```

```ts
// web/src/lib/approvals/consume.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashToken, verifyApprovalToken } from "./token";
import type { DraftRecord } from "@/lib/drafts/actions";
export type Consumed = { ok: true; draft: DraftRecord; tokenRowId: string } | { ok: false; status: 404 | 410; reason: string };
/** Verifies signature + expiry, then the DB row (single use) and that the draft is still the same version and still in review. Does NOT mark the token used; the caller does after a successful decision. */
export async function consumeApprovalToken(admin: SupabaseClient, token: string, secret: string): Promise<Consumed> {
  const v = verifyApprovalToken(token, secret);
  if (!v) return { ok: false, status: 404, reason: "This link is invalid or has expired." };
  const { data: row } = await admin.from("approval_tokens").select("id, draft_id, draft_version, used_at").eq("token_hash", hashToken(token)).maybeSingle();
  if (!row || row.draft_id !== v.draftId) return { ok: false, status: 404, reason: "This link is invalid or has expired." };
  if (row.used_at) return { ok: false, status: 410, reason: "This link was already used." };
  const { data: d } = await admin.from("drafts").select("id, workspace_id, campaign_id, brand_id, platform, candidate_index, version, hook, caption, hashtags, first_comment, alt_text, status").eq("id", v.draftId).single();
  if (!d) return { ok: false, status: 404, reason: "This post no longer exists." };
  if (d.version !== v.draftVersion) return { ok: false, status: 410, reason: "This post was revised since the link was sent. Ask for a new link." };
  if (d.status !== "draft") return { ok: false, status: 410, reason: `This post was already ${d.status}.` };
  return { ok: true, draft: d as DraftRecord, tokenRowId: row.id };
}
export async function markTokenUsed(admin: SupabaseClient, tokenRowId: string) {
  await admin.from("approval_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenRowId);
}
```

```ts
// web/src/lib/notify/send.ts
/** Sends through the n8n notify workflow (SMTP credential lives there). Returns false, without throwing, when the workflow isn't reachable or configured. */
export async function sendEmail(m: { to: string; subject: string; html: string }): Promise<boolean> {
  const base = process.env.N8N_BASE_URL, path = process.env.N8N_NOTIFY_WEBHOOK_PATH;
  if (!base || !path) return false;
  try {
    const r = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-postpilot-secret": process.env.APP_SECRET! }, body: JSON.stringify(m), signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch { return false; }
}
```

- [ ] **Step 4: Run tests** — PASS.

- [ ] **Step 5: Share route (owner, session)**

```ts
// web/src/app/api/drafts/[id]/share/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isUuid } from "@/lib/api/guard";
import { createApprovalLink } from "@/lib/approvals/issue";
import { sendEmail } from "@/lib/notify/send";
import { brandKitSchema } from "@/lib/brand/schema";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { brand, admin } = await getSession();
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const { email } = (await req.json().catch(() => ({}))) as { email?: boolean };
  const { data: d } = await admin.from("drafts").select("id, workspace_id, version, status, hook, platform").eq("id", id).eq("brand_id", brand.id).single();
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (d.status !== "draft") return NextResponse.json({ error: "Only posts still in review can be shared for approval." }, { status: 409 });
  const baseUrl = process.env.APP_BASE_URL ?? new URL(req.url).origin;
  const link = await createApprovalLink(admin, { draft: d, channel: email ? "email" : "link", baseUrl });
  let emailed = false;
  const to = brandKitSchema.safeParse(brand.kit).data?.approverEmail;
  if (email && to) {
    emailed = await sendEmail({ to, subject: `Approve: ${d.hook.slice(0, 60)}`, html: `<p>${brand.name} has a ${d.platform} post ready for your approval.</p><p><a href="${link.url}">Review and approve</a> (link expires in 72 hours).</p>` });
  }
  return NextResponse.json({ url: link.url, expiresAt: link.expiresAt, emailed, approverEmail: to ?? null });
}
```

- [ ] **Step 6: Public approval page and its action route**

`web/src/app/a/[token]/page.tsx` is outside the `(app)` group, so no session redirect. Server component: call `consumeApprovalToken` with `createAdminSupabase()`; on `ok: false` render a centred card with the `reason` and nothing else; on `ok` render the draft using the existing `PlatformPreview` component (import from `@/components/inbox/PlatformPreview`, same props the inbox passes) with the brand name as a heading, and a small client component `ApprovalActions` with two buttons **Approve** (`variant="accent"`) and **Request changes** (secondary, reveals a textarea for the note, then submits). Both `POST /api/approvals/{token}` with `{ action: "approve" | "reject", note? }` and then render a thank-you state in place. Page `<title>` "Approve a post · Postpilot". Never render the token in the page body.

```ts
// web/src/app/api/approvals/[token]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { consumeApprovalToken, markTokenUsed } from "@/lib/approvals/consume";
import { applyDecision } from "@/lib/drafts/actions";

const body = z.object({ action: z.enum(["approve", "reject"]), note: z.string().max(1000).optional() });
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (typeof token !== "string" || token.length > 600) return NextResponse.json({ error: "bad token" }, { status: 400 });
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const admin = createAdminSupabase();
  const c = await consumeApprovalToken(admin, token, process.env.APP_SECRET!);
  if (!c.ok) return NextResponse.json({ error: c.reason }, { status: c.status });
  const [{ data: brand }, { data: ws }] = await Promise.all([
    admin.from("brands").select("id, name, voice_profile").eq("id", c.draft.brand_id).single(),
    admin.from("workspaces").select("timezone, cadence_rule").eq("id", c.draft.workspace_id).single(),
  ]);
  if (!brand || !ws) return NextResponse.json({ error: "not found" }, { status: 404 });
  await markTokenUsed(admin, c.tokenRowId);
  try {
    const r = await applyDecision(admin, c.draft, brand, { action: parsed.data.action, note: parsed.data.note }, { timezone: ws.timezone, cadence_rule: ws.cadence_rule });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: (e as { status?: number }).status ?? 500 });
  }
}
```

Note `reject` through `applyDecision` regenerates a new version inline with the client's note as a hard instruction, exactly like the inbox, so the owner sees the revision in the inbox.

- [ ] **Step 7: Inbox button**

`components/inbox/ShareForApproval.tsx` (client): a `Button size="sm" variant="ghost"` labelled "Share for approval" with a `Link2` icon, shown on `DraftCard` only when `draft.status === "draft"` and passed `workspaceMode` (add the prop from the inbox page). On click, `POST /api/drafts/{id}/share` with `{ email: true }`, then a `Dialog` titled "Approval link" showing the URL in a read-only `Input` with a **Copy** button (`navigator.clipboard.writeText`, label flips to "Copied" for 1.5 s), a line "Expires {date}", and a status line: "Emailed to {approverEmail}" / "Email not configured, share the link directly" / "Add an approver email in Brand kit to send automatically". In single mode the button still exists (owners use it to get a second opinion) but the dialog omits the email line.

- [ ] **Step 8: n8n notify workflow**

`n8n/workflows/postpilot-notify.json`: Webhook node (path `postpilot-notify`, POST, Header Auth credential `Postpilot app secret`, respond immediately) → **Send Email** node (`n8n-nodes-base.emailSend`, SMTP credential `Postpilot SMTP`, from `={{ $json.body.from || "Postpilot <no-reply@postpilot.local>" }}` overridden by the credential's user, to `={{ $json.body.to }}`, subject `={{ $json.body.subject }}`, HTML `={{ $json.body.html }}`). Workflow id `PostpilotNotify0001`. Deployment and the credential template entry happen in Task 8; until then `sendEmail` returns false and the dialog says email isn't configured.

- [ ] **Step 9: Verify and commit**

`npm test && npx tsc --noEmit && npm run lint`. Chrome: share a draft, open the link in a private window (no session), approve; the inbox shows it approved and the calendar shows the slot. Open the same link again → "already used". Regenerate a draft after sharing, open the old link → "revised since".

```bash
git add web/src/lib/approvals web/src/lib/notify web/src/app/a web/src/app/api/approvals web/src/app/api/drafts web/src/components/inbox web/src/lib/brand/schema.ts web/src/app/\(app\)/brand n8n/workflows/postpilot-notify.json web/tests/approvals
git commit -m "feat(approvals): login-free approval links with optional email"
```

---

### Task 4: Publisher interface, text composer, image loader, Bluesky adapter

**Files:**
- Create: `web/src/lib/publishers/types.ts`, `web/src/lib/publishers/text.ts`, `web/src/lib/publishers/media.ts`, `web/src/lib/publishers/bluesky.ts`, `web/tests/helpers/fetch-mock.ts` (from the top of this plan)
- Test: `web/tests/publishers/text.test.ts`, `web/tests/publishers/media.test.ts`, `web/tests/publishers/bluesky.test.ts`

**Interfaces:**
- Produces:

```ts
// web/src/lib/publishers/types.ts
import type { Platform } from "@/lib/platforms/rules";
export type PublishInput = { draftId: string; platform: Platform; text: string; images: LoadedImage[]; mediaUrls: string[]; altText: string | null; firstComment: string | null };
export type LoadedImage = { bytes: Buffer; contentType: string; alt: string };
export type PublishResult = { externalId: string; permalink: string; warnings: string[] };
export type MetricSet = { likes: number; reposts: number; replies: number; views?: number; followers?: number };
export class PublishError extends Error {
  constructor(message: string, public kind: "auth" | "transient" | "permanent") { super(message); }
}
export interface Publisher {
  platform: Platform;
  publish(input: PublishInput): Promise<PublishResult>;
  fetchPostMetrics(externalId: string): Promise<MetricSet>;
  fetchAccountMetrics(): Promise<{ followers: number }>;
  healthcheck(): Promise<void>;   // throws PublishError("auth") when credentials are dead
}
```

`composeText(caption: string, hashtags: string[], max: number): string` and `loadImages(urls: string[], opts: { maxBytes: number; maxCount: number }): Promise<{ images: LoadedImage[]; warnings: string[] }>`; `createBlueskyPublisher(creds: { handle: string; appPassword: string }): Publisher`.

- [ ] **Step 1: Failing tests for the composer and loader**

```ts
// web/tests/publishers/text.test.ts
import { describe, it, expect } from "vitest";
import { composeText, graphemeLength } from "@/lib/publishers/text";
describe("composeText", () => {
  it("appends hashtags with a blank line and a # prefix", () => {
    expect(composeText("Hello world", ["coffee", "#launch"], 300)).toBe("Hello world\n\n#coffee #launch");
  });
  it("trims the caption at a word boundary so the hashtags fit", () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    const out = composeText(long, ["a", "b"], 300);
    expect(graphemeLength(out)).toBeLessThanOrEqual(300);
    expect(out.endsWith("… \n\n#a #b") || out.endsWith("…\n\n#a #b")).toBe(true);
    expect(out).not.toMatch(/word\d*…/);   // never mid-word
  });
  it("drops hashtags rather than the whole caption when they alone don't fit", () => {
    expect(composeText("Short", Array.from({ length: 50 }, (_, i) => `tag${i}`), 40)).toBe("Short");
  });
  it("counts graphemes, not UTF-16 units", () => {
    expect(graphemeLength("👍🏽a")).toBe(2);
  });
});
```

```ts
// web/tests/publishers/media.test.ts
import { describe, it, expect, vi } from "vitest";
import { loadImages } from "@/lib/publishers/media";
vi.mock("@/lib/net/safe-fetch", () => ({
  isOwnStorageUrl: (u: string) => u.startsWith("https://own.supabase.co/storage/"),
  safeFetch: async (u: string) => u.includes("big") ? { bytes: Buffer.alloc(1_100_000), contentType: "image/jpeg", status: 200 } : { bytes: Buffer.from("img"), contentType: "image/png", status: 200 },
}));
describe("loadImages", () => {
  it("loads own-storage images and skips oversize or foreign ones with warnings", async () => {
    const r = await loadImages(["https://own.supabase.co/storage/a.png", "https://own.supabase.co/storage/big.jpg", "https://evil.example/x.png"], { maxBytes: 1_000_000, maxCount: 4 });
    expect(r.images).toHaveLength(1);
    expect(r.images[0].contentType).toBe("image/png");
    expect(r.warnings).toEqual([expect.stringMatching(/big\.jpg.*1000 KB/), expect.stringMatching(/evil\.example.*not on Postpilot storage/)]);
  });
  it("caps the count", async () => {
    const r = await loadImages(Array.from({ length: 6 }, (_, i) => `https://own.supabase.co/storage/${i}.png`), { maxBytes: 1_000_000, maxCount: 4 });
    expect(r.images).toHaveLength(4);
    expect(r.warnings).toEqual([expect.stringMatching(/only the first 4/)]);
  });
});
```

- [ ] **Step 2: Run** — both fail on missing modules.

- [ ] **Step 3: Implement composer and loader**

```ts
// web/src/lib/publishers/text.ts
const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export const graphemeLength = (s: string) => { let n = 0; for (const _ of seg.segment(s)) n++; return n; };
const norm = (h: string) => `#${h.replace(/^#+/, "").trim()}`;
/** Caption + "\n\n#tags" within `max` graphemes. Caption is trimmed at a word boundary with an ellipsis; if even the caption alone doesn't fit, tags are dropped. */
export function composeText(caption: string, hashtags: string[], max: number): string {
  const tags = hashtags.map(norm).filter((t) => t.length > 1).join(" ");
  const cap = caption.trim();
  const withTags = tags ? `${cap}\n\n${tags}` : cap;
  if (graphemeLength(withTags) <= max) return withTags;
  const room = max - (tags ? graphemeLength(`\n\n${tags}`) : 0) - 1; // 1 for the ellipsis
  if (room < 20) return trimWords(cap, max);
  return tags ? `${trimWords(cap, room + 1)}\n\n${tags}` : trimWords(cap, max);
}
function trimWords(s: string, max: number): string {
  if (graphemeLength(s) <= max) return s;
  const words = s.split(/\s+/); let out = "";
  for (const w of words) { const next = out ? `${out} ${w}` : w; if (graphemeLength(next) + 1 > max) break; out = next; }
  return `${out}…`;
}
```

```ts
// web/src/lib/publishers/media.ts
import { isOwnStorageUrl, safeFetch } from "@/lib/net/safe-fetch";
import type { LoadedImage } from "./types";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
/** Downloads images that live on our own Storage bucket. Skips (with a warning) anything foreign, oversize, non-image, or beyond `maxCount`. */
export async function loadImages(urls: string[], o: { maxBytes: number; maxCount: number }): Promise<{ images: LoadedImage[]; warnings: string[] }> {
  const images: LoadedImage[] = []; const warnings: string[] = [];
  const candidates = urls.filter((u) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u) || !/\.(mp4|mov|webm)(\?|$)/i.test(u));
  if (candidates.length > o.maxCount) warnings.push(`This platform takes ${o.maxCount} images; only the first ${o.maxCount} were attached.`);
  for (const url of candidates.slice(0, o.maxCount)) {
    const name = url.split("/").pop()?.split("?")[0] ?? url;
    if (!isOwnStorageUrl(url)) { warnings.push(`${new URL(url).host}/${name} skipped: not on Postpilot storage.`); continue; }
    try {
      const r = await safeFetch(url, { maxBytes: o.maxBytes + 1, timeoutMs: 15000 });
      if (r.status !== 200) { warnings.push(`${name} skipped: HTTP ${r.status}.`); continue; }
      if (r.bytes.length > o.maxBytes) { warnings.push(`${name} skipped: larger than ${Math.round(o.maxBytes / 1000)} KB.`); continue; }
      const ct = r.contentType.split(";")[0].trim();
      if (!IMAGE_TYPES.includes(ct)) { warnings.push(`${name} skipped: ${ct || "unknown type"} is not an image.`); continue; }
      images.push({ bytes: r.bytes, contentType: ct, alt: "" });
    } catch (e) { warnings.push(`${name} skipped: ${e instanceof Error ? e.message : "download failed"}.`); }
  }
  return { images, warnings };
}
```

(`safeFetch` throws when the body exceeds `maxBytes`; requesting `maxBytes + 1` lets the size check above produce the friendlier message. If `safeFetch` throws first, the catch branch still records a skip.)

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Failing Bluesky test**

```ts
// web/tests/publishers/bluesky.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { mockFetch, json } from "../helpers/fetch-mock";
import { createBlueskyPublisher, buildFacets } from "@/lib/publishers/bluesky";
afterEach(() => vi.unstubAllGlobals());
const creds = { handle: "demo.bsky.social", appPassword: "aaaa-bbbb-cccc-dddd" };

describe("bluesky adapter", () => {
  it("creates a session, uploads images, posts with tag/link facets and returns a bsky.app permalink", async () => {
    const m = mockFetch({
      "com.atproto.server.createSession": () => json({ accessJwt: "jwt", did: "did:plc:abc", handle: "demo.bsky.social" }),
      "com.atproto.repo.uploadBlob": () => json({ blob: { $type: "blob", ref: { $link: "bafy" }, mimeType: "image/png", size: 3 } }),
      "com.atproto.repo.createRecord": () => json({ uri: "at://did:plc:abc/app.bsky.feed.post/3kxyz", cid: "bafycid" }),
    });
    const p = createBlueskyPublisher(creds);
    const r = await p.publish({ draftId: "d", platform: "bluesky", text: "Hello https://example.com #coffee", images: [{ bytes: Buffer.from("img"), contentType: "image/png", alt: "a cup" }], mediaUrls: [], altText: "a cup", firstComment: null });
    expect(r).toEqual({ externalId: "at://did:plc:abc/app.bsky.feed.post/3kxyz", permalink: "https://bsky.app/profile/demo.bsky.social/post/3kxyz", warnings: [] });
    const rec = m.json(2).record;
    expect(rec.$type).toBe("app.bsky.feed.post");
    expect(rec.embed.images[0].alt).toBe("a cup");
    expect(rec.facets.map((f: { features: { $type: string }[] }) => f.features[0].$type)).toEqual(["app.bsky.richtext.facet#link", "app.bsky.richtext.facet#tag"]);
    expect(m.calls[1].init?.headers).toMatchObject({ "content-type": "image/png", authorization: "Bearer jwt" });
  });
  it("maps a 401 on login to an auth error", async () => {
    mockFetch({ "createSession": () => json({ error: "AuthenticationRequired" }, 401) });
    await expect(createBlueskyPublisher(creds).healthcheck()).rejects.toMatchObject({ kind: "auth" });
  });
  it("maps 5xx and 429 to transient", async () => {
    mockFetch({ "createSession": () => json({ accessJwt: "jwt", did: "did:plc:abc", handle: "demo.bsky.social" }), "createRecord": () => json({ error: "x" }, 502) });
    await expect(createBlueskyPublisher(creds).publish({ draftId: "d", platform: "bluesky", text: "t", images: [], mediaUrls: [], altText: null, firstComment: null })).rejects.toMatchObject({ kind: "transient" });
  });
  it("reads post metrics from the public API and follower count from the profile", async () => {
    mockFetch({
      "app.bsky.feed.getPosts": () => json({ posts: [{ likeCount: 3, repostCount: 1, replyCount: 2, quoteCount: 1 }] }),
      "createSession": () => json({ accessJwt: "jwt", did: "did:plc:abc", handle: "demo.bsky.social" }),
      "app.bsky.actor.getProfile": () => json({ followersCount: 42 }),
    });
    const p = createBlueskyPublisher(creds);
    expect(await p.fetchPostMetrics("at://did:plc:abc/app.bsky.feed.post/3kxyz")).toEqual({ likes: 3, reposts: 2, replies: 2 });
    expect(await p.fetchAccountMetrics()).toEqual({ followers: 42 });
  });
});
describe("buildFacets", () => {
  it("uses UTF-8 byte offsets", () => {
    const f = buildFacets("héllo #tag");
    expect(f[0].index).toEqual({ byteStart: 7, byteEnd: 11 });
  });
});
```

- [ ] **Step 6: Run** — fails.

- [ ] **Step 7: Implement Bluesky**

```ts
// web/src/lib/publishers/bluesky.ts
import { PublishError, type MetricSet, type Publisher, type PublishInput, type PublishResult } from "./types";
const PDS = "https://bsky.social/xrpc";
const PUBLIC = "https://public.api.bsky.app/xrpc";
type Session = { accessJwt: string; did: string; handle: string };
type Facet = { index: { byteStart: number; byteEnd: number }; features: ({ $type: "app.bsky.richtext.facet#link"; uri: string } | { $type: "app.bsky.richtext.facet#tag"; tag: string })[] };

const enc = new TextEncoder();
const byteLen = (s: string) => enc.encode(s).length;
/** Link and hashtag facets with UTF-8 byte offsets, as the AT Protocol requires. */
export function buildFacets(text: string): Facet[] {
  const out: Facet[] = [];
  for (const m of text.matchAll(/https?:\/\/[^\s)]+/g)) {
    const start = byteLen(text.slice(0, m.index)); out.push({ index: { byteStart: start, byteEnd: start + byteLen(m[0]) }, features: [{ $type: "app.bsky.richtext.facet#link", uri: m[0] }] });
  }
  for (const m of text.matchAll(/(^|\s)(#[\p{L}\p{N}_]+)/gu)) {
    const tagStart = (m.index ?? 0) + m[1].length; const start = byteLen(text.slice(0, tagStart));
    out.push({ index: { byteStart: start, byteEnd: start + byteLen(m[2]) }, features: [{ $type: "app.bsky.richtext.facet#tag", tag: m[2].slice(1) }] });
  }
  return out.sort((a, b) => a.index.byteStart - b.index.byteStart);
}

function classify(status: number, body: string): PublishError {
  if (status === 401 || status === 403 || /AuthenticationRequired|InvalidToken|ExpiredToken/.test(body)) return new PublishError("Bluesky rejected the app password. Reconnect the account.", "auth");
  if (status === 429 || status >= 500) return new PublishError(`Bluesky is unavailable (HTTP ${status}). Will retry.`, "transient");
  return new PublishError(`Bluesky refused the post (HTTP ${status}): ${body.slice(0, 200)}`, "permanent");
}
async function xrpc<T>(url: string, init: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const text = await r.text();
  if (!r.ok) throw classify(r.status, text);
  return JSON.parse(text) as T;
}

export function createBlueskyPublisher(creds: { handle: string; appPassword: string }): Publisher {
  let session: Session | null = null;
  const login = async (): Promise<Session> => session ??= await xrpc<Session>(`${PDS}/com.atproto.server.createSession`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: creds.handle, password: creds.appPassword }) });
  return {
    platform: "bluesky",
    async healthcheck() { await login(); },
    async publish(input: PublishInput): Promise<PublishResult> {
      const s = await login();
      const images = [] as { image: unknown; alt: string }[];
      for (const im of input.images.slice(0, 4)) {
        const up = await xrpc<{ blob: unknown }>(`${PDS}/com.atproto.repo.uploadBlob`, { method: "POST", headers: { "content-type": im.contentType, authorization: `Bearer ${s.accessJwt}` }, body: new Uint8Array(im.bytes) });
        images.push({ image: up.blob, alt: im.alt || input.altText || "" });
      }
      const record: Record<string, unknown> = { $type: "app.bsky.feed.post", text: input.text, createdAt: new Date().toISOString(), langs: ["en"] };
      const facets = buildFacets(input.text); if (facets.length) record.facets = facets;
      if (images.length) record.embed = { $type: "app.bsky.embed.images", images };
      const res = await xrpc<{ uri: string; cid: string }>(`${PDS}/com.atproto.repo.createRecord`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${s.accessJwt}` }, body: JSON.stringify({ repo: s.did, collection: "app.bsky.feed.post", record }) });
      const rkey = res.uri.split("/").pop()!;
      return { externalId: res.uri, permalink: `https://bsky.app/profile/${s.handle}/post/${rkey}`, warnings: [] };
    },
    async fetchPostMetrics(uri: string): Promise<MetricSet> {
      const r = await xrpc<{ posts: { likeCount?: number; repostCount?: number; replyCount?: number; quoteCount?: number }[] }>(`${PUBLIC}/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`, { method: "GET" });
      const p = r.posts[0] ?? {};
      return { likes: p.likeCount ?? 0, reposts: (p.repostCount ?? 0) + (p.quoteCount ?? 0), replies: p.replyCount ?? 0 };
    },
    async fetchAccountMetrics() {
      const s = await login();
      const r = await xrpc<{ followersCount?: number }>(`${PUBLIC}/app.bsky.actor.getProfile?actor=${encodeURIComponent(s.did)}`, { method: "GET" });
      return { followers: r.followersCount ?? 0 };
    },
  };
}
```

- [ ] **Step 8: Run all publisher tests** — PASS. `npx tsc --noEmit` clean (the `Intl.Segmenter` type needs `"lib": ["es2022", "dom", …]` in `tsconfig.json`; add `es2022` if missing).

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/publishers web/tests/publishers web/tests/helpers web/tsconfig.json
git commit -m "feat(publishers): publisher interface, text composer, image loader, Bluesky adapter"
```

---

### Task 5: Mastodon adapter

**Files:**
- Create: `web/src/lib/publishers/mastodon.ts`
- Test: `web/tests/publishers/mastodon.test.ts`

**Interfaces:**
- Consumes: `Publisher`, `PublishError` from `types.ts`; `safeFetch` (instance URL is user-supplied).
- Produces: `createMastodonPublisher(creds: { instance: string; accessToken: string }): Publisher`.

- [ ] **Step 1: Failing test**

```ts
// web/tests/publishers/mastodon.test.ts
import { describe, it, expect, vi } from "vitest";
import { createMastodonPublisher } from "@/lib/publishers/mastodon";
const calls: { url: string; opts: Record<string, unknown> }[] = [];
vi.mock("@/lib/net/safe-fetch", () => ({
  safeFetch: async (url: string, opts: Record<string, unknown>) => {
    calls.push({ url, opts });
    const ok = (b: unknown, status = 200) => ({ status, contentType: "application/json", bytes: Buffer.from(JSON.stringify(b)) });
    if (url.endsWith("/api/v2/media")) return ok({ id: "m1" }, 202);
    if (url.endsWith("/api/v1/statuses")) return ok({ id: "109", url: "https://mastodon.social/@demo/109" });
    if (url.endsWith("/api/v1/statuses/109")) return ok({ favourites_count: 4, reblogs_count: 1, replies_count: 0 });
    if (url.endsWith("/api/v1/accounts/verify_credentials")) return ok({ id: "1", username: "demo", followers_count: 10 });
    return ok({ error: "nope" }, 404);
  },
}));
const creds = { instance: "https://mastodon.social", accessToken: "tok" };
describe("mastodon adapter", () => {
  it("uploads media as multipart, posts a status with media_ids, returns the status url", async () => {
    calls.length = 0;
    const r = await createMastodonPublisher(creds).publish({ draftId: "d", platform: "mastodon", text: "Hi #CoffeeTime", images: [{ bytes: Buffer.from("img"), contentType: "image/png", alt: "cup" }], mediaUrls: [], altText: "cup", firstComment: null });
    expect(r).toEqual({ externalId: "109", permalink: "https://mastodon.social/@demo/109", warnings: [] });
    expect(calls[0].url).toBe("https://mastodon.social/api/v2/media");
    expect(String(calls[0].opts.headers && (calls[0].opts.headers as Record<string, string>)["content-type"])).toMatch(/multipart\/form-data; boundary=/);
    expect(JSON.parse(String(calls[1].opts.body))).toEqual({ status: "Hi #CoffeeTime", media_ids: ["m1"], visibility: "public" });
    expect((calls[1].opts.headers as Record<string, string>).authorization).toBe("Bearer tok");
  });
  it("reads metrics and followers", async () => {
    const p = createMastodonPublisher(creds);
    expect(await p.fetchPostMetrics("109")).toEqual({ likes: 4, reposts: 1, replies: 0 });
    expect(await p.fetchAccountMetrics()).toEqual({ followers: 10 });
  });
});
```

- [ ] **Step 2: Run** — fails.

- [ ] **Step 3: Implement**

`safeFetch` takes a string `body`; multipart needs bytes. Extend `safeFetch`'s `body` type to `string | Uint8Array` (one-line change in `src/lib/net/safe-fetch.ts`, pass through to undici unchanged; existing tests still pass). Then:

```ts
// web/src/lib/publishers/mastodon.ts
import { safeFetch } from "@/lib/net/safe-fetch";
import { PublishError, type MetricSet, type Publisher, type PublishInput, type PublishResult } from "./types";

function classify(status: number, body: string): PublishError {
  if (status === 401 || status === 403) return new PublishError("Mastodon rejected the access token. Reconnect the account.", "auth");
  if (status === 429 || status >= 500) return new PublishError(`Mastodon is unavailable (HTTP ${status}). Will retry.`, "transient");
  return new PublishError(`Mastodon refused the post (HTTP ${status}): ${body.slice(0, 200)}`, "permanent");
}
function multipart(parts: { name: string; value: string | { bytes: Buffer; contentType: string; filename: string } }[]): { body: Uint8Array; contentType: string } {
  const boundary = `----postpilot${Math.random().toString(36).slice(2)}`;
  const chunks: Buffer[] = [];
  for (const p of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (typeof p.value === "string") chunks.push(Buffer.from(`Content-Disposition: form-data; name="${p.name}"\r\n\r\n${p.value}\r\n`));
    else { chunks.push(Buffer.from(`Content-Disposition: form-data; name="${p.name}"; filename="${p.value.filename}"\r\nContent-Type: ${p.value.contentType}\r\n\r\n`)); chunks.push(p.value.bytes); chunks.push(Buffer.from("\r\n")); }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: new Uint8Array(Buffer.concat(chunks)), contentType: `multipart/form-data; boundary=${boundary}` };
}

export function createMastodonPublisher(creds: { instance: string; accessToken: string }): Publisher {
  const base = creds.instance.replace(/\/$/, "");
  const call = async <T>(path: string, init: { method?: string; body?: string | Uint8Array; contentType?: string } = {}): Promise<T> => {
    const r = await safeFetch(`${base}${path}`, { method: init.method ?? "GET", body: init.body as string | undefined, headers: { authorization: `Bearer ${creds.accessToken}`, ...(init.contentType ? { "content-type": init.contentType } : {}) }, maxRedirects: 0, maxBytes: 512 * 1024, timeoutMs: 20000 });
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
        const mp = multipart([{ name: "file", value: { bytes: im.bytes, contentType: im.contentType, filename: `image-${i}.${im.contentType.split("/")[1]}` } }, { name: "description", value: im.alt || input.altText || "" }]);
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
```

(Mastodon returns 202 from `/api/v2/media` while it processes; the id is usable immediately for a status, which is what the adapter does. If a status post returns 422 "media not ready", `classify` marks it permanent; the runner in Task 7 treats a 422 containing "processing" as transient, see there.)

- [ ] **Step 4: Run** — PASS. Commit:

```bash
git add web/src/lib/publishers/mastodon.ts web/src/lib/net/safe-fetch.ts web/tests/publishers/mastodon.test.ts
git commit -m "feat(publishers): Mastodon adapter"
```

---

### Task 6: Zernio adapter and connect flow (X, TikTok, YouTube, LinkedIn, Threads, Pinterest)

Zernio is the aggregator formerly called Late (getlate.dev redirects; `sk_` keys work on both). Facts this task relies on, from docs.zernio.com (verified 2026-09-26): base `https://zernio.com/api/v1`, header `Authorization: Bearer sk_…`; `GET /v1/accounts` → `{ accounts: [{ _id, platform, username, isActive }] }` with platform names `twitter`, `linkedin`, `tiktok`, `youtube`, `threads`, `pinterest`, `bluesky`, …; `POST /v1/posts` with `{ content, mediaItems: [{ type, url }], platforms: [{ platform, accountId }], publishNow: true }` and optional `Idempotency-Key` header → `{ post: { _id, status: "scheduled"|"publishing"|"published"|"failed"|"partial", platforms: [{ platform, accountId, status, platformPostUrl }] } }`, HTTP 207 on partial, 409 on duplicate content within 24 h; `GET /v1/posts/{id}` same shape; media may be public HTTPS URLs (no upload needed); free tier = 2 connected accounts, 60 requests/min, 429 with `Retry-After`; Mastodon is not supported (stays native). Post analytics endpoints are per platform and mostly behind an add-on, so metrics from Zernio are best-effort.

**Files:**
- Create: `web/src/lib/publishers/zernio.ts`, `web/src/lib/publishers/index.ts`
- Modify: `web/src/lib/platforms/rules.ts` (rename the adapter literal `"late"` → keep the DB value `late` but label it "Zernio" in UI: add `export const ADAPTER_LABEL = { native: "Native", late: "Via Zernio" }`), `web/src/app/api/connections/route.ts`, `web/src/components/connections/PlatformCard.tsx`, `web/src/app/(app)/connections/page.tsx` (section title "Via Zernio"), `web/.env.example` (`ZERNIO_API_KEY=` with comment "formerly LATE_API_KEY; both names are read")
- Test: `web/tests/publishers/zernio.test.ts`

**Interfaces:**
- Consumes: `Publisher`, `PublishError`, `PublishInput` from `types.ts`; `seal`/`open` from `credentials.ts`; `createBlueskyPublisher`, `createMastodonPublisher`.
- Produces: `ZERNIO_PLATFORM: Record<Platform, string | null>` (our name → Zernio name; `x → "twitter"`, `instagram/facebook/mastodon → null`); `listZernioAccounts(apiKey): Promise<{ id: string; platform: string; username: string; isActive: boolean }[]>`; `createZernioPublisher(a: { apiKey: string; accountId: string; platform: Platform }): Publisher`; `zernioApiKey(): string | undefined` (reads `ZERNIO_API_KEY`, falls back to `LATE_API_KEY`); and the dispatcher `getPublisher(platform, account: { adapter: "native" | "late"; tokens_encrypted: string; external_id: string | null }): Publisher`.

- [ ] **Step 1: Failing test**

```ts
// web/tests/publishers/zernio.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { mockFetch, json } from "../helpers/fetch-mock";
import { createZernioPublisher, listZernioAccounts, ZERNIO_PLATFORM } from "@/lib/publishers/zernio";
afterEach(() => vi.unstubAllGlobals());
const a = { apiKey: "sk_test", accountId: "66b2e19d8c3f5a7e9d0b1c2e", platform: "x" as const };
const input = { draftId: "d1", platform: "x" as const, text: "Hello", images: [], mediaUrls: ["https://own.supabase.co/storage/v1/object/public/media/a.png"], altText: null, firstComment: null };

describe("zernio adapter", () => {
  it("maps platform names", () => {
    expect(ZERNIO_PLATFORM.x).toBe("twitter"); expect(ZERNIO_PLATFORM.youtube).toBe("youtube"); expect(ZERNIO_PLATFORM.mastodon).toBeNull();
  });
  it("lists accounts with the bearer key", async () => {
    const m = mockFetch({ "/v1/accounts": () => json({ accounts: [{ _id: "1", platform: "twitter", username: "@acme", isActive: true }] }) });
    expect(await listZernioAccounts("sk_test")).toEqual([{ id: "1", platform: "twitter", username: "@acme", isActive: true }]);
    expect((m.calls[0].init?.headers as Record<string, string>).authorization).toBe("Bearer sk_test");
  });
  it("publishes now with media URLs and an idempotency key, returns the platform post url", async () => {
    const m = mockFetch({ "/v1/posts": () => json({ post: { _id: "p1", status: "published", platforms: [{ platform: "twitter", accountId: a.accountId, status: "published", platformPostUrl: "https://x.com/acme/status/1" }] } }, 201) });
    const r = await createZernioPublisher(a).publish(input);
    expect(r).toEqual({ externalId: "p1", permalink: "https://x.com/acme/status/1", warnings: [] });
    expect(m.json(0)).toEqual({ content: "Hello", mediaItems: [{ type: "image", url: input.mediaUrls[0] }], platforms: [{ platform: "twitter", accountId: a.accountId }], publishNow: true });
    expect((m.calls[0].init?.headers as Record<string, string>)["idempotency-key"]).toBe("d1");
  });
  it("polls until the post leaves 'publishing'", async () => {
    let polls = 0;
    mockFetch({
      "/v1/posts/p1": () => { polls++; return json({ post: { _id: "p1", status: polls < 2 ? "publishing" : "published", platforms: [{ platform: "twitter", status: "published", platformPostUrl: "https://x.com/acme/status/2" }] } }); },
      "/v1/posts": () => json({ post: { _id: "p1", status: "publishing", platforms: [{ platform: "twitter", status: "publishing" }] } }, 201),
    });
    const r = await createZernioPublisher({ ...a, pollDelayMs: 1 }).publish(input);
    expect(r.permalink).toBe("https://x.com/acme/status/2"); expect(polls).toBe(2);
  });
  it("maps 401 → auth, 429/5xx → transient, failed platform status → permanent with the reason", async () => {
    mockFetch({ "/v1/posts": () => json({ error: "invalid key" }, 401) });
    await expect(createZernioPublisher(a).publish(input)).rejects.toMatchObject({ kind: "auth" });
    mockFetch({ "/v1/posts": () => json({ error: "slow down" }, 429) });
    await expect(createZernioPublisher(a).publish(input)).rejects.toMatchObject({ kind: "transient" });
    mockFetch({ "/v1/posts": () => json({ post: { _id: "p2", status: "failed", platforms: [{ platform: "twitter", status: "failed", error: "Account disconnected" }] } }, 207) });
    await expect(createZernioPublisher(a).publish(input)).rejects.toMatchObject({ kind: "permanent", message: expect.stringMatching(/Account disconnected/) });
  });
  it("returns zero metrics when analytics are unavailable instead of throwing", async () => {
    mockFetch({ "/v1/analytics/": () => json({ error: "add-on required" }, 402) });
    expect(await createZernioPublisher(a).fetchPostMetrics("p1")).toEqual({ likes: 0, reposts: 0, replies: 0 });
  });
});
```

- [ ] **Step 2: Run** — fails.

- [ ] **Step 3: Implement**

```ts
// web/src/lib/publishers/zernio.ts
import type { Platform } from "@/lib/platforms/rules";
import { PublishError, type MetricSet, type Publisher, type PublishInput, type PublishResult } from "./types";
const BASE = "https://zernio.com/api/v1";
export const ZERNIO_PLATFORM: Record<Platform, string | null> = { x: "twitter", tiktok: "tiktok", youtube: "youtube", linkedin: "linkedin", threads: "threads", pinterest: "pinterest", bluesky: "bluesky", instagram: null, facebook: null, mastodon: null };
export const zernioApiKey = () => process.env.ZERNIO_API_KEY || process.env.LATE_API_KEY || undefined;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function classify(status: number, body: string): PublishError {
  if (status === 401 || status === 403) return new PublishError("Zernio rejected the API key. Check ZERNIO_API_KEY.", "auth");
  if (status === 429 || status >= 500) return new PublishError(`Zernio is rate-limiting or unavailable (HTTP ${status}). Will retry.`, "transient");
  if (status === 409) return new PublishError("Zernio refused a duplicate: identical content went to this account in the last 24 hours.", "permanent");
  return new PublishError(`Zernio refused the request (HTTP ${status}): ${body.slice(0, 200)}`, "permanent");
}
async function api<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { ...init, headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) }, signal: AbortSignal.timeout(25000) });
  const text = await r.text();
  if (!r.ok && r.status !== 207) throw classify(r.status, text);
  return JSON.parse(text) as T;
}
export async function listZernioAccounts(apiKey: string) {
  const r = await api<{ accounts: { _id: string; platform: string; username: string; isActive: boolean }[] }>(apiKey, "/accounts");
  return (r.accounts ?? []).map((x) => ({ id: x._id, platform: x.platform, username: x.username, isActive: x.isActive }));
}
type ZPost = { _id: string; status: string; platforms: { platform: string; accountId?: string; status: string; platformPostUrl?: string; error?: string }[] };
const mediaType = (u: string) => (/\.(mp4|mov|webm|m4v)(\?|$)/i.test(u) ? "video" : "image");

export function createZernioPublisher(a: { apiKey: string; accountId: string; platform: Platform; pollDelayMs?: number }): Publisher {
  const zp = ZERNIO_PLATFORM[a.platform];
  if (!zp) throw new Error(`${a.platform} is not published through Zernio`);
  const settle = (post: ZPost): PublishResult | null => {
    const mine = post.platforms.find((p) => p.platform === zp) ?? post.platforms[0];
    if (!mine) throw new PublishError("Zernio returned no platform result.", "permanent");
    if (mine.status === "published" || post.status === "published") return { externalId: post._id, permalink: mine.platformPostUrl ?? "", warnings: mine.platformPostUrl ? [] : ["Zernio did not return a post URL yet."] };
    if (mine.status === "failed" || post.status === "failed") throw new PublishError(`Zernio could not publish: ${mine.error ?? "unknown error"}`, /disconnect|reconnect|token|auth/i.test(mine.error ?? "") ? "auth" : "permanent");
    return null; // scheduled / publishing
  };
  return {
    platform: a.platform,
    async healthcheck() { const accts = await listZernioAccounts(a.apiKey); if (!accts.some((x) => x.id === a.accountId && x.isActive)) throw new PublishError("This account is no longer connected in Zernio.", "auth"); },
    async publish(input: PublishInput): Promise<PublishResult> {
      const body = { content: input.text, mediaItems: input.mediaUrls.map((url) => ({ type: mediaType(url), url })), platforms: [{ platform: zp, accountId: a.accountId }], publishNow: true };
      const r = await api<{ post: ZPost }>(a.apiKey, "/posts", { method: "POST", headers: { "idempotency-key": input.draftId }, body: JSON.stringify(body) });
      let done = settle(r.post);
      for (let i = 0; !done && i < 8; i++) {
        await sleep(a.pollDelayMs ?? 2500);
        const g = await api<{ post: ZPost }>(a.apiKey, `/posts/${encodeURIComponent(r.post._id)}`);
        done = settle(g.post);
      }
      if (!done) return { externalId: r.post._id, permalink: "", warnings: ["Zernio is still publishing; the link will appear after the next analytics sync."] };
      return done;
    },
    async fetchPostMetrics(postId: string): Promise<MetricSet> {
      try {
        const m = await api<Record<string, number>>(a.apiKey, `/analytics/${zp}/posts/${encodeURIComponent(postId)}`);
        return { likes: m.likes ?? 0, reposts: m.shares ?? m.reposts ?? 0, replies: m.comments ?? 0, views: m.impressions ?? m.views };
      } catch (e) {
        if (e instanceof PublishError && e.kind === "auth") throw e;
        return { likes: 0, reposts: 0, replies: 0 };
      }
    },
    async fetchAccountMetrics() { return { followers: 0 }; },
  };
}
```

```ts
// web/src/lib/publishers/index.ts
import type { Platform } from "@/lib/platforms/rules";
import { open } from "./credentials";
import { createBlueskyPublisher } from "./bluesky";
import { createMastodonPublisher } from "./mastodon";
import { createZernioPublisher, zernioApiKey } from "./zernio";
import { PublishError, type Publisher } from "./types";
/** Builds the adapter for a stored connection. Throws PublishError("auth") when the stored credentials cannot be used. */
export function getPublisher(platform: Platform, account: { adapter: "native" | "late"; tokens_encrypted: string; external_id: string | null }): Publisher {
  if (account.adapter === "late") {
    const apiKey = zernioApiKey(); if (!apiKey) throw new PublishError("ZERNIO_API_KEY is not set.", "auth");
    const { accountId } = open<{ accountId: string }>(account.tokens_encrypted);
    return createZernioPublisher({ apiKey, accountId, platform });
  }
  if (platform === "bluesky") return createBlueskyPublisher(open<{ handle: string; appPassword: string }>(account.tokens_encrypted));
  if (platform === "mastodon") return createMastodonPublisher(open<{ instance: string; accessToken: string }>(account.tokens_encrypted));
  throw new PublishError(`${platform} publishing is not available yet (Meta app review pending).`, "permanent");
}
```

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Connect flow.** In `api/connections/route.ts` add a third union member `z.object({ platform: z.enum(["x", "tiktok", "youtube", "linkedin", "threads", "pinterest"]) })`. For it: `const key = zernioApiKey(); if (!key) → 400 "Zernio is not configured on the server."`; `listZernioAccounts(key)`; pick the first active account whose `platform === ZERNIO_PLATFORM[p.platform]`; if none → 400 `"No ${label} account is connected in Zernio yet. Connect it at zernio.com, then try again."`; upsert `{ adapter: "late", external_id: username, tokens_encrypted: seal({ accountId }) }`. In `PlatformCard.tsx`: for `r.adapter === "late"`, the Connect button is enabled and posts `{ platform }` directly (no dialog); the card's help line reads "Connected through your Zernio workspace. Link the account at zernio.com first." Meta cards stay disabled with the existing tooltip. Rename the connections page section to "Via Zernio" and the card subtitle via `ADAPTER_LABEL`.

- [ ] **Step 6: Verify and commit.** Tests, types, lint green. Live: in the Zernio dashboard connect one account (Bluesky through Zernio is the cheapest test, but it would collide with the native Bluesky card; use X or LinkedIn if you have one, otherwise leave the live check for when an account exists), then Connect on the card and confirm the username appears.

```bash
git add web/src/lib/publishers web/src/lib/platforms/rules.ts web/src/app/api/connections web/src/components/connections web/src/app/\(app\)/connections web/.env.example web/tests/publishers/zernio.test.ts
git commit -m "feat(publishers): Zernio adapter and one-click connect for aggregator platforms"
```


---

### Task 7: Publish runner with pre-publish safety pass

**Files:**
- Create: `web/src/lib/publish/safety.ts`, `web/src/lib/publish/runner.ts`, `web/src/app/api/publish/run/route.ts`, `web/src/app/api/publish/[slotId]/route.ts`
- Modify: `web/src/components/calendar/CalendarView.tsx` (enable Publish now)
- Test: `web/tests/publish/safety.test.ts`, `web/tests/publish/runner.test.ts`

**Interfaces:**
- Consumes: `getPublisher(platform, account)` from Task 6's `lib/publishers/index.ts`; `composeText`, `loadImages`; `PLATFORM_RULES[platform].captionMax`; `gemini.generateJson`.
- Produces: `prePublishCheck({ text, bannedWords, check }): Promise<{ ok: true } | { ok: false; reasons: string[] }>`; `claimDueSlots(admin, now, limit): Promise<ClaimedSlot[]>`; `publishSlot(admin, slot, deps): Promise<"published" | "failed" | "retry">`; `runPublishBatch(admin, deps): Promise<{ published: number; failed: number; retried: number }>`.

- [ ] **Step 1: Failing safety test**

```ts
// web/tests/publish/safety.test.ts
import { describe, it, expect } from "vitest";
import { prePublishCheck, findBannedWords } from "@/lib/publish/safety";
describe("pre-publish safety", () => {
  it("finds banned words case-insensitively as whole words", () => {
    expect(findBannedWords("Our Cheapest ever deal, cheapskate", ["cheapest", "free"])).toEqual(["cheapest"]);
  });
  it("blocks on banned words without calling the model", async () => {
    let called = false;
    const r = await prePublishCheck({ text: "guaranteed results", bannedWords: ["guaranteed"], check: async () => { called = true; return { issues: [] }; } });
    expect(r).toEqual({ ok: false, reasons: ['Contains banned word "guaranteed".'] });
    expect(called).toBe(false);
  });
  it("blocks on model-flagged issues and passes clean text", async () => {
    expect(await prePublishCheck({ text: "We cured 100% of customers", bannedWords: [], check: async () => ({ issues: ["Unverifiable medical claim: cured 100%"] }) })).toEqual({ ok: false, reasons: ["Unverifiable medical claim: cured 100%"] });
    expect(await prePublishCheck({ text: "New blend this week", bannedWords: [], check: async () => ({ issues: [] }) })).toEqual({ ok: true });
  });
  it("fails open when the model errors, so an outage never blocks a scheduled post", async () => {
    expect(await prePublishCheck({ text: "x", bannedWords: [], check: async () => { throw new Error("503"); } })).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Implement safety**

```ts
// web/src/lib/publish/safety.ts
import * as gemini from "@/lib/ai/gemini";
export type SafetyCheck = (text: string) => Promise<{ issues: string[] }>;
export function findBannedWords(text: string, banned: string[]): string[] {
  const lower = text.toLowerCase();
  return banned.map((b) => b.trim().toLowerCase()).filter(Boolean).filter((b) => new RegExp(`(^|[^\\p{L}\\p{N}])${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u").test(lower));
}
const SCHEMA = { type: "object", properties: { issues: { type: "array", items: { type: "string" } } }, required: ["issues"] };
/** Gemini flags unverifiable factual claims (statistics, medical/financial promises, "#1", awards) and platform-policy problems. Returns [] for ordinary marketing copy. */
export const geminiSafetyCheck: SafetyCheck = (text) => gemini.generateJson<{ issues: string[] }>(
  "You review a social post before it is published. List only concrete problems: specific factual claims that cannot be verified from the text itself (numbers, awards, medical or financial promises, 'the best/first/only'), impersonation, and content most platforms' policies forbid. Ordinary enthusiasm is fine. Return JSON {\"issues\": string[]} with at most 3 short items, or an empty array.",
  text, SCHEMA, (raw) => { const r = raw as { issues?: unknown }; return { issues: Array.isArray(r.issues) ? r.issues.filter((s): s is string => typeof s === "string").slice(0, 3) : [] }; });
export async function prePublishCheck(a: { text: string; bannedWords: string[]; check?: SafetyCheck }): Promise<{ ok: true } | { ok: false; reasons: string[] }> {
  const banned = findBannedWords(a.text, a.bannedWords);
  if (banned.length) return { ok: false, reasons: banned.map((b) => `Contains banned word "${b}".`) };
  try {
    const { issues } = await (a.check ?? geminiSafetyCheck)(a.text);
    return issues.length ? { ok: false, reasons: issues } : { ok: true };
  } catch { return { ok: true }; }
}
```

- [ ] **Step 3: Run** — PASS.

- [ ] **Step 4: Failing runner test**

```ts
// web/tests/publish/runner.test.ts
import { describe, it, expect, vi } from "vitest";
import { publishSlot, type ClaimedSlot, type RunnerDeps } from "@/lib/publish/runner";
import { PublishError } from "@/lib/publishers/types";

const slot: ClaimedSlot = { id: "s1", workspace_id: "w", brand_id: "b", platform: "bluesky", draft_id: "d1", scheduled_at: new Date().toISOString(), attempts: 0 };
function harness(o: { publish?: () => Promise<{ externalId: string; permalink: string; warnings: string[] }>; account?: Record<string, unknown> | null; draft?: Record<string, unknown> }) {
  const writes: { table: string; data: Record<string, unknown> }[] = [];
  const rows: Record<string, unknown> = {
    drafts: o.draft ?? { id: "d1", version: 1, caption: "Hello", hashtags: ["a"], first_comment: null, alt_text: null, media_urls: [], status: "scheduled" },
    brands: { banned_words: [] },
    connected_accounts: o.account === undefined ? { id: "acc", platform: "bluesky", adapter: "native", tokens_encrypted: "sealed", status: "ok" } : o.account,
  };
  const admin = { from: (table: string) => {
    const q = { select: () => q, eq: () => q, single: async () => ({ data: rows[table] ?? null }), maybeSingle: async () => ({ data: rows[table] ?? null }),
      update: (data: Record<string, unknown>) => { writes.push({ table, data }); return q; }, insert: (data: Record<string, unknown>) => { writes.push({ table, data }); return q; }, then: (r: (v: unknown) => void) => r({ data: null, error: null }) };
    return q;
  } } as never;
  const deps: RunnerDeps = {
    getPublisher: () => ({ platform: "bluesky", publish: o.publish ?? (async () => ({ externalId: "at://x/3k", permalink: "https://bsky.app/profile/x/post/3k", warnings: [] })), fetchPostMetrics: async () => ({ likes: 0, reposts: 0, replies: 0 }), fetchAccountMetrics: async () => ({ followers: 0 }), healthcheck: async () => {} }),
    loadImages: async () => ({ images: [], warnings: [] }),
    safety: async () => ({ ok: true as const }),
    maxAttempts: 3,
  };
  return { admin, deps, writes };
}
const w = (h: ReturnType<typeof harness>, table: string) => h.writes.filter((x) => x.table === table).map((x) => x.data);

describe("publishSlot", () => {
  it("publishes, records the job, marks the draft published with permalink and the slot done", async () => {
    const h = harness({});
    expect(await publishSlot(h.admin, slot, h.deps)).toBe("published");
    expect(w(h, "publish_jobs").at(-1)).toMatchObject({ status: "published", external_id: "at://x/3k", permalink: "https://bsky.app/profile/x/post/3k" });
    expect(w(h, "drafts").at(-1)).toMatchObject({ status: "published", permalink: "https://bsky.app/profile/x/post/3k" });
    expect(w(h, "schedule_slots").at(-1)).toMatchObject({ status: "done" });
  });
  it("fails without an account and says so", async () => {
    const h = harness({ account: null });
    expect(await publishSlot(h.admin, slot, h.deps)).toBe("failed");
    expect(w(h, "drafts").at(-1)).toMatchObject({ status: "failed", publish_error: expect.stringMatching(/No Bluesky account is connected/) });
  });
  it("auth error → account reconnect, draft failed, no retry", async () => {
    const h = harness({ publish: async () => { throw new PublishError("bad token", "auth"); } });
    expect(await publishSlot(h.admin, slot, h.deps)).toBe("failed");
    expect(w(h, "connected_accounts").at(-1)).toMatchObject({ status: "reconnect" });
    expect(w(h, "drafts").at(-1)).toMatchObject({ status: "failed" });
  });
  it("transient error → retry with backoff until maxAttempts, then failed", async () => {
    const h = harness({ publish: async () => { throw new PublishError("502", "transient"); } });
    expect(await publishSlot(h.admin, slot, h.deps)).toBe("retry");
    const s = w(h, "schedule_slots").at(-1) as { status: string; scheduled_at: string };
    expect(s.status).toBe("filled");
    expect(new Date(s.scheduled_at).getTime()).toBeGreaterThan(Date.now() + 4 * 60e3);
    expect(await publishSlot(h.admin, { ...slot, attempts: 2 }, h.deps)).toBe("failed");
  });
  it("safety block → failed with the reasons, publisher never called", async () => {
    let called = false;
    const h = harness({ publish: async () => { called = true; return { externalId: "", permalink: "", warnings: [] }; } });
    h.deps.safety = async () => ({ ok: false, reasons: ["Unverifiable claim"] });
    expect(await publishSlot(h.admin, slot, h.deps)).toBe("failed");
    expect(called).toBe(false);
    expect(w(h, "drafts").at(-1)).toMatchObject({ publish_error: expect.stringMatching(/Safety check: Unverifiable claim/) });
  });
  it("stops when the draft is no longer scheduled (unscheduled meanwhile)", async () => {
    const h = harness({ draft: { id: "d1", status: "approved", caption: "x", hashtags: [], media_urls: [] } });
    expect(await publishSlot(h.admin, slot, h.deps)).toBe("failed");
    expect(w(h, "drafts")).toHaveLength(0);
  });
});
```

- [ ] **Step 5: Implement the runner**

```ts
// web/src/lib/publish/runner.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLATFORM_RULES, type Platform } from "@/lib/platforms/rules";
import { composeText } from "@/lib/publishers/text";
import { loadImages as defaultLoadImages } from "@/lib/publishers/media";
import { isOwnStorageUrl } from "@/lib/net/safe-fetch";
import { getPublisher as defaultGetPublisher } from "@/lib/publishers";
import { PublishError, type Publisher } from "@/lib/publishers/types";
import { prePublishCheck } from "./safety";

export type ClaimedSlot = { id: string; workspace_id: string; brand_id: string; platform: Platform; draft_id: string; scheduled_at: string; attempts: number };
export type RunnerDeps = {
  getPublisher: (platform: Platform, account: { adapter: "native" | "late"; tokens_encrypted: string; external_id: string | null }) => Publisher;
  loadImages: typeof defaultLoadImages;
  safety: (a: { text: string; bannedWords: string[] }) => Promise<{ ok: true } | { ok: false; reasons: string[] }>;
  maxAttempts: number;
};
export const defaultDeps: RunnerDeps = { getPublisher: defaultGetPublisher, loadImages: defaultLoadImages, safety: prePublishCheck, maxAttempts: 3 };
const IMAGE_LIMITS: Partial<Record<Platform, { maxBytes: number; maxCount: number }>> = { bluesky: { maxBytes: 976_000, maxCount: 4 }, mastodon: { maxBytes: 16_000_000, maxCount: 4 } };

/** Atomically takes due slots: only rows still `filled` flip to `claimed`, so two overlapping runs never share one. `attempts` lives on the slot via publish_jobs count; we keep it on the row for simplicity. */
export async function claimDueSlots(admin: SupabaseClient, now = new Date(), limit = 10): Promise<ClaimedSlot[]> {
  const { data } = await admin.from("schedule_slots").update({ status: "claimed" }).eq("status", "filled").lte("scheduled_at", now.toISOString()).not("draft_id", "is", null).select("id, workspace_id, brand_id, platform, draft_id, scheduled_at, attempts").limit(limit);
  return (data ?? []) as ClaimedSlot[];
}

const backoffMinutes = (attempt: number) => [5, 15, 45][Math.min(attempt, 2)];

export async function publishSlot(admin: SupabaseClient, slot: ClaimedSlot, deps: RunnerDeps = defaultDeps): Promise<"published" | "failed" | "retry"> {
  const { data: draft } = await admin.from("drafts").select("id, version, caption, hashtags, first_comment, alt_text, media_urls, status").eq("id", slot.draft_id).single();
  if (!draft || draft.status !== "scheduled") { await admin.from("schedule_slots").update({ status: "done" }).eq("id", slot.id); return "failed"; }
  const fail = async (reason: string) => {
    await admin.from("publish_jobs").insert({ workspace_id: slot.workspace_id, draft_id: slot.draft_id, account_id: null, attempts: slot.attempts + 1, status: "failed", error: reason });
    await admin.from("drafts").update({ status: "failed", publish_error: reason }).eq("id", slot.draft_id);
    await admin.from("schedule_slots").update({ status: "failed" }).eq("id", slot.id);
    return "failed" as const;
  };
  const label = PLATFORM_RULES[slot.platform].label;
  const { data: account } = await admin.from("connected_accounts").select("id, platform, adapter, tokens_encrypted, external_id, status").eq("brand_id", slot.brand_id).eq("platform", slot.platform).maybeSingle();
  if (!account || !account.tokens_encrypted) return fail(`No ${label} account is connected. Connect one and reschedule.`);
  if (account.status !== "ok") return fail(`The ${label} account needs to be reconnected.`);
  const { data: brand } = await admin.from("brands").select("banned_words").eq("id", slot.brand_id).single();

  const text = composeText(draft.caption, draft.hashtags ?? [], PLATFORM_RULES[slot.platform].captionMax);
  const safety = await deps.safety({ text, bannedWords: brand?.banned_words ?? [] });
  if (!safety.ok) return fail(`Safety check: ${safety.reasons.join(" · ")}`);

  const limits = IMAGE_LIMITS[slot.platform] ?? { maxBytes: 5_000_000, maxCount: 4 };
  const media = IMAGE_LIMITS[slot.platform] ? await deps.loadImages(draft.media_urls ?? [], limits) : { images: [], warnings: [] };  // native adapters take bytes; Zernio takes URLs
  try {
    const publisher = deps.getPublisher(slot.platform, account);
    const r = await publisher.publish({ draftId: draft.id, platform: slot.platform, text, images: media.images, mediaUrls: (draft.media_urls ?? []).filter(isOwnStorageUrl), altText: draft.alt_text, firstComment: draft.first_comment });
    const warnings = [...media.warnings, ...r.warnings];
    await admin.from("publish_jobs").insert({ workspace_id: slot.workspace_id, draft_id: slot.draft_id, account_id: account.id, attempts: slot.attempts + 1, status: "published", external_id: r.externalId, permalink: r.permalink, error: warnings.length ? warnings.join(" ") : null });
    await admin.from("drafts").update({ status: "published", permalink: r.permalink, publish_error: warnings.length ? warnings.join(" ") : null, published_at: new Date().toISOString() }).eq("id", slot.draft_id);
    await admin.from("schedule_slots").update({ status: "done" }).eq("id", slot.id);
    return "published";
  } catch (e) {
    const err = e instanceof PublishError ? e : new PublishError(e instanceof Error ? e.message : "Unknown error", /processing|timeout|ECONNRESET|fetch failed/i.test(String(e)) ? "transient" : "permanent");
    if (err.kind === "auth") {
      await admin.from("connected_accounts").update({ status: "reconnect" }).eq("id", account.id);
      return fail(err.message);
    }
    if (err.kind === "transient" && slot.attempts + 1 < deps.maxAttempts) {
      const next = new Date(Date.now() + backoffMinutes(slot.attempts) * 60e3).toISOString();
      await admin.from("publish_jobs").insert({ workspace_id: slot.workspace_id, draft_id: slot.draft_id, account_id: account.id, attempts: slot.attempts + 1, status: "retry", error: err.message });
      await admin.from("schedule_slots").update({ status: "filled", scheduled_at: next, attempts: slot.attempts + 1 }).eq("id", slot.id);
      return "retry";
    }
    return fail(err.message);
  }
}

export async function runPublishBatch(admin: SupabaseClient, deps: RunnerDeps = defaultDeps) {
  const out = { published: 0, failed: 0, retried: 0 };
  for (const slot of await claimDueSlots(admin)) {
    const r = await publishSlot(admin, slot, deps);
    if (r === "published") out.published++; else if (r === "retry") out.retried++; else out.failed++;
  }
  return out;
}
```

Add to migration `0005_publishing.sql` (append; re-run `supabase db push`): `alter table schedule_slots add column if not exists attempts int not null default 0;` and `alter table publish_jobs alter column account_id drop not null;` (a failure before an account exists still needs a job row).

- [ ] **Step 6: Run** — PASS. Then the routes:

```ts
// web/src/app/api/publish/run/route.ts
import { NextResponse } from "next/server";
import { requireSecret } from "@/lib/api/guard";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { runPublishBatch } from "@/lib/publish/runner";
export const maxDuration = 60;
export async function POST(req: Request) {
  const denied = requireSecret(req); if (denied) return denied;
  const result = await runPublishBatch(createAdminSupabase());
  return NextResponse.json({ ok: true, ...result });
}
```

```ts
// web/src/app/api/publish/[slotId]/route.ts  — "Publish now" from the calendar (session)
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isUuid } from "@/lib/api/guard";
import { publishSlot, type ClaimedSlot } from "@/lib/publish/runner";
export const maxDuration = 60;
export async function POST(_req: Request, { params }: { params: Promise<{ slotId: string }> }) {
  const { brand, admin } = await getSession();
  const { slotId } = await params;
  if (!isUuid(slotId)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const { data } = await admin.from("schedule_slots").update({ status: "claimed" }).eq("id", slotId).eq("brand_id", brand.id).eq("status", "filled").select("id, workspace_id, brand_id, platform, draft_id, scheduled_at, attempts");
  const slot = (data as ClaimedSlot[] | null)?.[0];
  if (!slot) return NextResponse.json({ error: "This post is not waiting to be published." }, { status: 409 });
  const result = await publishSlot(admin, slot);
  const { data: d } = await admin.from("drafts").select("permalink, publish_error").eq("id", slot.draft_id).single();
  return NextResponse.json({ result, permalink: d?.permalink ?? null, error: d?.publish_error ?? null }, { status: result === "published" ? 200 : 409 });
}
```

- [ ] **Step 7: Enable "Publish now"** in `CalendarView.tsx`: the button (from Task 2) posts to `/api/publish/{slotId}`, shows `loading`, and on 200 replaces the card's badge with `published` and a "View post ↗" link without a full reload (update the event in `cache`); on 409 shows the returned `error` under the card and refreshes.

- [ ] **Step 8: Verify and commit**

`npm test && npx tsc --noEmit && npm run lint`. Live check: connect your Bluesky account on Connections (handle `muhammadathar27dd.bsky.social` + app password), approve a short text draft, open the calendar, **Publish now**, open the permalink. Then `curl -X POST -H "x-postpilot-secret: $APP_SECRET" http://localhost:3000/api/publish/run` with a slot scheduled one minute in the past and confirm it publishes.

```bash
git add web/src/lib/publish web/src/app/api/publish web/src/components/calendar supabase/migrations/0005_publishing.sql web/tests/publish
git commit -m "feat(publish): runner with safety pass, retries and publish-now"
```

---

### Task 8: n8n clocks and notify deployment

**Files:**
- Create: `n8n/workflows/postpilot-publish.json`, `n8n/workflows/postpilot-analytics.json`
- Modify: `n8n/credentials.template.json`, `n8n/deploy.sh`, `n8n/README.md`, `web/.env.example`

- [ ] **Step 1: Workflows.** Both are two nodes. Match the existing JSON shape in `postpilot-generate.json` (top-level `id`, `name`, `nodes`, `connections`, `settings: { executionOrder: "v1", errorWorkflow: "PostpilotErrors0001" }` — copy the exact `errorWorkflow` id from the generate file).

`postpilot-publish.json` (id `PostpilotPublish001`): **Schedule Trigger** (`n8n-nodes-base.scheduleTrigger`, rule `{"interval":[{"field":"minutes","minutesInterval":5}]}`) → **Run publish batch** (`n8n-nodes-base.httpRequest` v4.2, POST `APP_BASE_URL_HERE/api/publish/run`, authentication `genericCredentialType` / `httpHeaderAuth` credential `Postpilot app secret`, timeout 55000, `retryOnFail: true, maxTries: 2, waitBetweenTries: 30000`).

`postpilot-analytics.json` (id `PostpilotAnalytics1`): same with `{"field":"hours","hoursInterval":6}` → POST `APP_BASE_URL_HERE/api/analytics/sync` (route arrives in Task 9; the workflow simply 404s until then).

`postpilot-notify.json` already exists from Task 3.

- [ ] **Step 2: Credentials + deploy.** Add to `credentials.template.json`:

```json
{ "id": "PpSmtp0000000001", "name": "Postpilot SMTP", "type": "smtp", "data": { "user": "SMTP_USER_HERE", "password": "SMTP_PASS_HERE", "host": "smtp.gmail.com", "port": 465, "secure": true } }
```

In `deploy.sh`: read `SMTP_USER` / `SMTP_PASS` from `web/.env.local` (default to `disabled` / `disabled` when absent so the deploy never blocks), stamp them, and activate the new workflow ids in the remote script:

```bash
for id in PostpilotGenerate01 PostpilotPublish001 PostpilotAnalytics1 PostpilotNotify0001; do docker compose exec -T n8n n8n update:workflow --id=$id --active=true >/dev/null 2>&1; done
```

Add `SMTP_USER=` and `SMTP_PASS=` (comment: Gmail address + app password, optional, only for approval emails) to `web/.env.example`. Document the four workflows in the `n8n/README.md` table.

- [ ] **Step 3: Deploy and verify.** `APP_BASE_URL=https://postpilot-demo.vercel.app n8n/deploy.sh`. In the n8n UI confirm four active workflows; watch one `postpilot-publish` execution succeed (200 from the app). Commit:

```bash
git add n8n web/.env.example
git commit -m "feat(n8n): publish and analytics clocks, notify email workflow"
```

---

### Task 9: Analytics sync and real tiles

**Files:**
- Create: `web/src/lib/analytics/sync.ts`, `web/src/lib/analytics/aggregate.ts`, `web/src/app/api/analytics/sync/route.ts`
- Modify: `web/src/app/(app)/analytics/page.tsx`
- Test: `web/tests/analytics/aggregate.test.ts`

**Interfaces:**
- Consumes: `getPublisher`, `fetchPostMetrics`, `fetchAccountMetrics`.
- Produces: `syncAllAccounts(admin): Promise<{ accounts: number; posts: number; errors: string[] }>`; `aggregate(snapshots: SnapshotRow[]): { tiles: Record<"followers"|"likes"|"reposts"|"replies"|"posts", number>; byPlatform: Record<string, { followers: number; likes: number; posts: number }>; topPost: { draftId: string; score: number } | null }`.

- [ ] **Step 1: Failing aggregate test**

```ts
// web/tests/analytics/aggregate.test.ts
import { describe, it, expect } from "vitest";
import { aggregate, type SnapshotRow } from "@/lib/analytics/aggregate";
const t = (iso: string) => iso;
const rows: SnapshotRow[] = [
  { account_id: "a1", platform: "bluesky", draft_id: null, captured_at: t("2026-09-26T00:00:00Z"), metrics: { followers: 40 } },
  { account_id: "a1", platform: "bluesky", draft_id: null, captured_at: t("2026-09-27T00:00:00Z"), metrics: { followers: 42 } },
  { account_id: "a1", platform: "bluesky", draft_id: "d1", captured_at: t("2026-09-26T00:00:00Z"), metrics: { likes: 1, reposts: 0, replies: 0 } },
  { account_id: "a1", platform: "bluesky", draft_id: "d1", captured_at: t("2026-09-27T00:00:00Z"), metrics: { likes: 5, reposts: 1, replies: 2 } },
  { account_id: "a2", platform: "mastodon", draft_id: "d2", captured_at: t("2026-09-27T00:00:00Z"), metrics: { likes: 2, reposts: 0, replies: 0 } },
  { account_id: "a2", platform: "mastodon", draft_id: null, captured_at: t("2026-09-27T00:00:00Z"), metrics: { followers: 10 } },
];
describe("aggregate", () => {
  it("uses the latest snapshot per account and per post, sums across platforms, ranks the top post", () => {
    const r = aggregate(rows);
    expect(r.tiles).toEqual({ followers: 52, likes: 7, reposts: 1, replies: 2, posts: 2 });
    expect(r.byPlatform.bluesky).toEqual({ followers: 42, likes: 5, posts: 1 });
    expect(r.topPost).toEqual({ draftId: "d1", score: 5 + 2 * 1 + 3 * 2 });
  });
  it("handles no data", () => { expect(aggregate([]).topPost).toBeNull(); });
});
```

- [ ] **Step 2: Implement**

```ts
// web/src/lib/analytics/aggregate.ts
export type SnapshotRow = { account_id: string; platform: string; draft_id: string | null; captured_at: string; metrics: { followers?: number; likes?: number; reposts?: number; replies?: number; views?: number } };
export function aggregate(rows: SnapshotRow[]) {
  const latestAccount = new Map<string, SnapshotRow>(); const latestPost = new Map<string, SnapshotRow>();
  for (const r of rows) {
    const map = r.draft_id ? latestPost : latestAccount; const key = r.draft_id ?? r.account_id;
    const cur = map.get(key); if (!cur || cur.captured_at < r.captured_at) map.set(key, r);
  }
  const tiles = { followers: 0, likes: 0, reposts: 0, replies: 0, posts: latestPost.size };
  const byPlatform: Record<string, { followers: number; likes: number; posts: number }> = {};
  const bp = (p: string) => (byPlatform[p] ??= { followers: 0, likes: 0, posts: 0 });
  for (const r of latestAccount.values()) { tiles.followers += r.metrics.followers ?? 0; bp(r.platform).followers += r.metrics.followers ?? 0; }
  let topPost: { draftId: string; score: number } | null = null;
  for (const r of latestPost.values()) {
    const m = r.metrics; tiles.likes += m.likes ?? 0; tiles.reposts += m.reposts ?? 0; tiles.replies += m.replies ?? 0;
    bp(r.platform).likes += m.likes ?? 0; bp(r.platform).posts += 1;
    const score = (m.likes ?? 0) + 2 * (m.reposts ?? 0) + 3 * (m.replies ?? 0);
    if (!topPost || score > topPost.score) topPost = { draftId: r.draft_id!, score };
  }
  return { tiles, byPlatform, topPost };
}
```

```ts
// web/src/lib/analytics/sync.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublisher } from "@/lib/publishers";
import { PublishError } from "@/lib/publishers/types";
import type { Platform } from "@/lib/platforms/rules";
/** For every healthy account: one account snapshot + one snapshot per post published in the last 30 days. Auth failures flip the account to `reconnect`; other errors are collected, never thrown. */
export async function syncAllAccounts(admin: SupabaseClient) {
  const out = { accounts: 0, posts: 0, errors: [] as string[] };
  const { data: accounts } = await admin.from("connected_accounts").select("id, workspace_id, brand_id, platform, adapter, tokens_encrypted, external_id, status").eq("status", "ok");
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  for (const a of accounts ?? []) {
    try {
      const pub = getPublisher(a.platform as Platform, a);
      const acc = await pub.fetchAccountMetrics();
      await admin.from("metric_snapshots").insert({ workspace_id: a.workspace_id, account_id: a.id, draft_id: null, metrics: acc });
      out.accounts++;
      const { data: jobs } = await admin.from("publish_jobs").select("draft_id, external_id").eq("account_id", a.id).eq("status", "published").gte("created_at", since);
      for (const j of jobs ?? []) {
        if (!j.external_id) continue;
        try { const m = await pub.fetchPostMetrics(j.external_id); await admin.from("metric_snapshots").insert({ workspace_id: a.workspace_id, account_id: a.id, draft_id: j.draft_id, metrics: m }); out.posts++; }
        catch (e) { out.errors.push(`${a.platform} post ${j.draft_id}: ${e instanceof Error ? e.message : e}`); }
      }
    } catch (e) {
      if (e instanceof PublishError && e.kind === "auth") await admin.from("connected_accounts").update({ status: "reconnect" }).eq("id", a.id);
      out.errors.push(`${a.platform} ${a.external_id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return out;
}
```

Route `web/src/app/api/analytics/sync/route.ts`: same shape as `publish/run` (`requireSecret`, `maxDuration = 60`, returns the sync result). Also accept `GET` from a session for a manual "Sync now" button: export `GET` that calls `getSession()` then runs `syncAllAccounts` filtered to that brand (add an optional `brandId` parameter to `syncAllAccounts` and filter the accounts query with it).

- [ ] **Step 3: Analytics page.** Keep the empty state. When accounts exist: load `metric_snapshots` joined with `connected_accounts(platform)` for the brand's accounts (last 60 days), map to `SnapshotRow`, `aggregate`, and render: four tiles (Followers, Likes, Reposts, Replies) with `font-serif text-3xl` numbers, a "Posts measured" tile, a per-platform table (platform, followers, likes, posts), and a "Top post" card that loads the draft's hook + permalink ("View post ↗"). A `Badge` shows "Last sync {relative time}" from the newest `captured_at`, or "Not synced yet — first sync runs within 6 hours of the first published post" when there are no rows, plus a **Sync now** `Button size="sm" variant="secondary"` that calls `GET /api/analytics/sync` and refreshes. Keep the "Insights" paragraph out; it is Plan 4.

- [ ] **Step 4: Verify and commit.** `npm test && npx tsc --noEmit && npm run lint`. After Task 7's live publish, hit Sync now and confirm followers and the post's likes appear.

```bash
git add web/src/lib/analytics web/src/app/api/analytics web/src/app/\(app\)/analytics web/tests/analytics
git commit -m "feat(analytics): metrics sync and real tiles"
```

---

### Task 10: Surface publish results in the inbox

**Files:**
- Modify: `web/src/components/inbox/DraftCard.tsx`, `web/src/lib/drafts/types.ts` (add `permalink: string | null; publish_error: string | null; published_at: string | null`), `web/src/app/api/drafts/[id]/action/route.ts` + `web/src/lib/drafts/actions.ts` (new action `retry`)

- [ ] **Step 1: Retry action.** In `actions.ts` `Decision.action` gains `"retry"`: allowed only when `d.status === "failed"`; it clears `publish_error`, calls `scheduleApprovedDraft` (which inserts a fresh slot and moves the draft to `scheduled`, the `failed → scheduled` transition already exists), records no feedback event, returns `{ scheduledAt }`. Add the literal to the route's zod enum. Add to `tests/drafts/state.test.ts` nothing new (transition exists); add one test in a new `tests/drafts/retry.test.ts` that `applyDecision` with `retry` on a `draft`-status row throws a 409.

- [ ] **Step 2: Card.** In `DraftCard.tsx`: `published` → green badge, "Published {relative}" and a "View post ↗" link to `permalink`; a muted line with `publish_error` when it is a warning (published with warnings). `failed` → red badge, the `publish_error` text in a `bg-danger-soft` box, and a **Retry** button (`variant="secondary"`, posts `{ action: "retry" }`, then refresh). `scheduled` → badge plus "Scheduled · {date time}" from the slot (add `scheduled_at` to the inbox page's draft query via `schedule_slots(scheduled_at)` relation, first row). Tone map: published `ok`, failed `danger`.

- [ ] **Step 3: Verify and commit.** Lint/type/tests green; in Chrome, force a failure (disconnect Bluesky, publish now) and confirm the inbox shows the reason and Retry reschedules.

```bash
git add web/src/components/inbox/DraftCard.tsx web/src/lib/drafts web/src/app/api/drafts web/src/app/\(app\)/inbox web/tests/drafts
git commit -m "feat(inbox): published links, failure reasons and retry"
```

---

### Task 11: Product README

**Files:**
- Create: `README.md` (repo root)
- Modify: `n8n/README.md` (link from root)

- [ ] **Step 1: Write it.** Sections, in order, each short: one-paragraph pitch (what Postpilot does, who it is for); a "How it works" list (brief → n8n generate → Gemini with fallback chain → inbox review with preference memory → schedule → publish → analytics); Platforms table (platform, adapter native/Zernio, publish ✓, metrics ✓, notes: "Meta pending app review"); Screenshots section with four placeholders (`docs/screenshots/inbox.png`, `calendar.png`, `connections.png`, `analytics.png`, capture them in Chrome at 1440×900 light theme and commit); Architecture diagram as a fenced text block (Vercel app ↔ Supabase, n8n clocks → app routes, adapters → platforms); Running locally (clone, `cp web/.env.example web/.env.local`, fill in the listed variables with one line each on where to get them, `supabase link` + `db push`, `npm run dev`, `n8n/deploy.sh`); Security notes (credentials AES-256-GCM sealed with `APP_SECRET`, SSRF guard, tenant isolation by workspace, single-use approval tokens); Roadmap (Plan 3 video pipeline, Plan 4 insights, Meta). Tone matches the app: plain, confident, no hype words. Do not include any personal name in the README body beyond the git author.

- [ ] **Step 2: Commit.**

```bash
git add README.md n8n/README.md docs/screenshots
git commit -m "docs: product README with platforms, architecture and setup"
```

---

## Self-review notes

- Spec coverage: §3 publishers (Tasks 4–6), approvals module (Task 3), §7 publish cron + retries + reconnect (Tasks 7–8), analytics-sync (Task 9), §8 safety pass, token expiry, error reporting in UI (Tasks 7, 3, 10). Timezone picker and calendar reschedule come from the user's 2026-09-26 inventory (Tasks 1–2). README (Task 11). Not covered on purpose: Telegram, Meta, Groq, video (user decisions / Plan 3).
- Type consistency: `Publisher`, `PublishInput`, `PublishResult`, `MetricSet`, `PublishError` defined in Task 4 and used unchanged in 5, 6, 7, 9. `ClaimedSlot`/`RunnerDeps` defined in Task 7 and used by the publish-now route. `CalendarEvent.slotId/permalink/error` added in Task 2 and used in 7 and 10. `drafts.permalink/publish_error/published_at` added in migration 0005 (Task 2) and used in 7, 9, 10.
- Review Focus tests: (1) `text.test.ts` trim; (2) `claimDueSlots` conditional update is exercised live in Task 7 Step 8 and by the publish-now route's `eq("status","filled")`; (3) `runner.test.ts` auth case; (4) `consume.test.ts` used/version cases; (5) `media.test.ts` oversize/foreign cases.
