# Postpilot Plan 1 — Foundation & Review Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first working slice of Postpilot: a signed-in user sets up a brand kit, submits a campaign request with references, n8n + Gemini generate platform-specific draft candidates, and the user reviews them in an inbox with approve / edit / reject-with-note / regenerate, where every action feeds a persistent preference memory and bare regenerate produces visible, inferred changes.

**Architecture:** Next.js 16 app (`web/`) on Vercel owns UI, auth, and secret-protected API routes. Supabase holds all data (Postgres + pgvector, Auth, Storage, Realtime). n8n on the Oracle VM runs the `generate` workflow: it fetches a prompt bundle from the app, calls Gemini, and posts validated drafts back. All prompt building, validation and preference logic lives in pure TypeScript modules in the app so it is unit-testable without network.

**Tech Stack:** Next.js 16.3 (App Router, `proxy.ts`), React 19.2, TypeScript strict, Tailwind 4, Vitest 3, Zod 3, `@supabase/supabase-js` 2 + `@supabase/ssr`, `@google/genai` (Gemini 3.5 Flash + `gemini-embedding-001`), n8n 2.33 on Oracle VM, Node 22.

**Spec:** `docs/superpowers/specs/2026-09-17-postpilot-design.md` (sections 2–5, 8, 9). Plans 2–4 cover video, publishing/scheduling, analytics/ship.

## Global Constraints

- Free tiers only: Supabase free, Vercel hobby, Gemini free tier (fallback Groq). No paid services.
- No personal names anywhere in UI, README, seed data, screenshots. Product name: **Postpilot**.
- Git: local `user.name "Muhammad Athar"`, `user.email "hussanmughal9246@gmail.com"`. **No Co-Authored-By trailers.** Conventional-commit messages.
- Every table row carries `workspace_id`. `workspaces.mode ∈ {single, agency}`.
- Draft status machine: `draft→approved|rejected`, `approved→scheduled`, `scheduled→published|failed`. Enforced in DB and in code.
- Secrets only in `web/.env.local` (gitignored) and n8n credentials. Committed n8n JSON is scrubbed (`N8N_APP_SECRET_HERE`, `GEMINI_API_KEY_HERE`).
- n8n ↔ app calls carry header `x-postpilot-secret: $APP_SECRET`.
- Gemini model ids: text `gemini-3.5-flash`, embeddings `gemini-embedding-001` (768 dims, `outputDimensionality: 768`).
- Node 22, npm. Run `npm test` (Vitest) before every commit.

---

## File structure (created by this plan)

```
postpilot/
  README.md                          product-style README (Task 13)
  LICENSE                            MIT
  .gitignore
  supabase/
    migrations/0001_init.sql         schema from spec §4 + RLS + triggers (Task 2)
  n8n/
    workflows/postpilot-generate.json  exported, scrubbed (Task 9)
  web/
    package.json, vitest.config.ts, .env.example
    proxy.ts                         auth gate (Task 3)
    src/app/
      (auth)/login/page.tsx          email+password (Task 3)
      (app)/layout.tsx               sidebar, brand switcher in agency mode (Task 3, 10)
      (app)/brand/page.tsx           brand kit form (Task 5)
      (app)/campaigns/new/page.tsx   request form (Task 6)
      (app)/inbox/page.tsx           review inbox (Task 10)
      (app)/settings/page.tsx        workspace mode/cadence (Task 3)
      approve/[token]/page.tsx       login-free approval page (Task 12)
      api/campaigns/route.ts         POST create + trigger n8n (Task 6)
      api/campaigns/[id]/bundle/route.ts   GET prompt bundle for n8n (Task 8)
      api/campaigns/[id]/drafts/route.ts   POST drafts from n8n (Task 8)
      api/campaigns/[id]/fail/route.ts     POST failure callback (Task 8)
      api/drafts/[id]/action/route.ts      POST approve/edit/reject/regenerate (Task 11)
      api/approvals/route.ts               POST issue+send token (Task 12)
      api/approvals/[token]/route.ts       POST consume token (Task 12)
    src/lib/
      supabase/server.ts, client.ts, admin.ts   (Task 3)
      auth/session.ts                current user + workspace (Task 3)
      platforms/rules.ts             PLATFORM_RULES (Task 4)
      campaigns/settings.ts          schema + resolveSettings (Task 4)
      brand/voice-profile.ts         buildVoiceProfile (Task 5)
      generation/schema.ts           draftOutputSchema (Task 7)
      generation/prompt.ts           buildGenerationPrompts (Task 7)
      generation/references.ts       summariseReferences (Task 8)
      preferences/context.ts         buildFeedbackContext, diffEdits (Task 11)
      preferences/summary.ts         summariseFeedback (Task 11)
      drafts/state.ts                canTransition (Task 11)
      approvals/token.ts             issue/verify HMAC tokens (Task 12)
      ai/gemini.ts                   thin client: generateJson, embed (Task 8)
      n8n/trigger.ts                 triggerWorkflow (Task 6)
    src/components/...               UI pieces per task
    tests/                           Vitest unit tests mirror src/lib
```

---

### Task 1: Scaffold the repo and the Next.js app

**Files:**
- Create: `web/*` via create-next-app, `web/vitest.config.ts`, `web/.env.example`, `.gitignore`, `LICENSE`
- Modify: `.git/config` (local user)

**Interfaces:**
- Produces: `npm test` runs Vitest; `npm run dev` serves the app.

- [ ] **Step 1: Set local git identity and drop the earlier co-author trailer**

```bash
cd ~/Desktop/Upwork/postpilot
git config user.name "Muhammad Athar"
git config user.email "hussanmughal9246@gmail.com"
git commit --amend --reset-author -q -m "docs: Postpilot design spec"
git log --format='%an <%ae>%n%B' -1
```
Expected: author is Muhammad Athar <hussanmughal9246@gmail.com>, body has no `Co-Authored-By`.

- [ ] **Step 2: Scaffold Next.js**

```bash
cd ~/Desktop/Upwork/postpilot
npx --yes create-next-app@16.3.4 web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack --yes
cd web && npm i zod@3 @supabase/supabase-js@2 @supabase/ssr @google/genai
npm i -D vitest@3 @vitest/coverage-v8
```

- [ ] **Step 3: Vitest config and scripts**

`web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```
Add to `web/package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Smoke test**

`web/tests/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("toolchain", () => { it("runs", () => expect(1 + 1).toBe(2)); });
```
Run: `cd web && npm test` → Expected: 1 passed.

- [ ] **Step 5: Root files**

`.gitignore` (root):
```
node_modules/
.next/
.env
.env.local
.env*.local
.vercel
supabase/.temp/
*.log
.DS_Store
```
`LICENSE`: MIT text, copyright line `Copyright (c) 2026 Postpilot contributors`.
`web/.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_SECRET=            # shared with n8n, 32+ random chars
APP_BASE_URL=http://localhost:3000
N8N_BASE_URL=https://n8n.152-67-183-135.sslip.io
N8N_GENERATE_WEBHOOK_PATH=/webhook/postpilot-generate
GEMINI_API_KEY=
GROQ_API_KEY=
```
Copy to `web/.env.local` and fill in as keys become available.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/Upwork/postpilot && git add -A && git commit -m "chore: scaffold Next.js app with Vitest"
```

---

### Task 2: Database schema (Supabase)

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Test: `web/tests/db/migration.test.ts` (static checks on the SQL file)

**Interfaces:**
- Produces: tables exactly as spec §4; `draft_status` enum; trigger `enforce_draft_transition`; RLS policies keyed by `workspace_members`.

- [ ] **Step 1: Write the static test**

`web/tests/db/migration.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
const sql = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/0001_init.sql"), "utf8");
const tables = ["workspaces","workspace_members","brands","connected_accounts","campaigns","drafts","feedback_events","preference_summaries","render_jobs","schedule_slots","publish_jobs","metric_snapshots","approval_tokens","quota_usage"];
describe("0001_init.sql", () => {
  it.each(tables)("creates table %s", (t) => expect(sql).toMatch(new RegExp(`create table\\s+${t}\\b`, "i")));
  it("enables pgvector", () => expect(sql).toMatch(/create extension if not exists vector/i));
  it("defines the draft transition trigger", () => expect(sql).toMatch(/enforce_draft_transition/));
  it("enables RLS on drafts", () => expect(sql).toMatch(/alter table drafts enable row level security/i));
});
```
Run: `npm test` → Expected: FAIL (file missing).

- [ ] **Step 2: Write the migration**

`supabase/migrations/0001_init.sql`:
```sql
create extension if not exists vector;
create extension if not exists pgcrypto;

create type workspace_mode as enum ('single','agency');
create type draft_status as enum ('draft','approved','rejected','scheduled','published','failed');
create type campaign_status as enum ('queued','generating','review','done','failed');
create type feedback_action as enum ('approve','edit','reject','regenerate');
create type account_status as enum ('ok','reconnect','error');

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode workspace_mode not null default 'single',
  timezone text not null default 'UTC',
  cadence_rule jsonb not null default '{"type":"weekdays","times":["10:00"]}',
  posting_windows jsonb not null default '{}',
  default_settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  primary key (workspace_id, user_id)
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  kit jsonb not null default '{}',
  voice_profile text not null default '',
  banned_words text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table connected_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  platform text not null,
  adapter text not null check (adapter in ('native','late')),
  external_id text,
  tokens_encrypted text,
  status account_status not null default 'ok',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  prompt text not null,
  "references" jsonb not null default '[]',
  settings jsonb not null default '{}',
  status campaign_status not null default 'queued',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  platform text not null,
  candidate_index int not null default 0,
  version int not null default 1,
  parent_draft_id uuid references drafts(id),
  hook text not null default '',
  caption text not null default '',
  hashtags text[] not null default '{}',
  first_comment text,
  alt_text text,
  media_plan jsonb not null default '{}',
  media_urls text[] not null default '{}',
  change_notes text[] not null default '{}',
  status draft_status not null default 'draft',
  embedding vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index drafts_campaign_idx on drafts(campaign_id);
create index drafts_brand_status_idx on drafts(brand_id, status);

create table feedback_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  draft_id uuid not null references drafts(id) on delete cascade,
  action feedback_action not null,
  note text,
  edit_diff jsonb,
  snapshot jsonb not null default '{}',
  embedding vector(768),
  created_at timestamptz not null default now()
);
create index feedback_brand_idx on feedback_events(brand_id, created_at desc);

create table preference_summaries (
  brand_id uuid primary key references brands(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  summary text not null default '',
  event_count int not null default 0,
  updated_at timestamptz not null default now()
);

create table render_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  draft_id uuid not null references drafts(id) on delete cascade,
  spec jsonb not null default '{}',
  status text not null default 'queued',
  output_url text, thumbnail_url text, error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table schedule_slots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  platform text not null,
  scheduled_at timestamptz not null,
  draft_id uuid references drafts(id) on delete set null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table publish_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  draft_id uuid not null references drafts(id) on delete cascade,
  account_id uuid not null references connected_accounts(id) on delete cascade,
  attempts int not null default 0,
  external_id text, permalink text, error text,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid not null references connected_accounts(id) on delete cascade,
  draft_id uuid references drafts(id) on delete set null,
  captured_at timestamptz not null default now(),
  metrics jsonb not null default '{}'
);

create table approval_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  draft_id uuid not null references drafts(id) on delete cascade,
  draft_version int not null,
  channel text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table quota_usage (
  provider text not null,
  day date not null,
  units_used int not null default 0,
  units_limit int not null,
  primary key (provider, day)
);

-- draft state machine
create or replace function enforce_draft_transition() returns trigger language plpgsql as $$
begin
  if old.status = new.status then return new; end if;
  if (old.status = 'draft' and new.status in ('approved','rejected'))
     or (old.status = 'approved' and new.status = 'scheduled')
     or (old.status = 'scheduled' and new.status in ('published','failed'))
     or (old.status = 'failed' and new.status = 'scheduled') then
    return new;
  end if;
  raise exception 'invalid draft transition % -> %', old.status, new.status;
end $$;
create trigger drafts_transition before update of status on drafts
  for each row execute function enforce_draft_transition();

-- updated_at
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['workspaces','brands','connected_accounts','campaigns','drafts','render_jobs','publish_jobs'] loop
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop; end $$;

-- RLS: members of a workspace can read/write its rows
create or replace function is_member(ws uuid) returns boolean language sql stable as $$
  select exists (select 1 from workspace_members where workspace_id = ws and user_id = auth.uid());
$$;
do $$ declare t text; begin
  foreach t in array array['workspaces','brands','connected_accounts','campaigns','drafts','feedback_events','preference_summaries','render_jobs','schedule_slots','publish_jobs','metric_snapshots','approval_tokens'] loop
    execute format('alter table %I enable row level security', t);
    if t = 'workspaces' then
      execute 'create policy ws_member on workspaces for all using (is_member(id)) with check (is_member(id))';
    else
      execute format('create policy %I_member on %I for all using (is_member(workspace_id)) with check (is_member(workspace_id))', t, t);
    end if;
  end loop; end $$;
alter table workspace_members enable row level security;
create policy members_self on workspace_members for select using (user_id = auth.uid());

-- storage bucket for uploads and renders (public read)
insert into storage.buckets (id, name, public) values ('media','media', true) on conflict do nothing;
create policy media_read on storage.objects for select using (bucket_id = 'media');
create policy media_write on storage.objects for insert with check (bucket_id = 'media' and auth.role() = 'authenticated');

-- realtime on drafts
alter publication supabase_realtime add table drafts;
```

- [ ] **Step 3: Run static test** → `npm test` → Expected: PASS.

- [ ] **Step 4: Apply to the hosted Supabase project**

Create a free project at supabase.com named `postpilot` (user does this in browser; region closest to Pakistan: Singapore). Then:
```bash
cd ~/Desktop/Upwork/postpilot
npx --yes supabase@latest login          # opens browser
npx supabase link --project-ref <ref>    # ref from project URL
npx supabase db push
```
Expected: `Applying migration 0001_init.sql... Finished`. Copy URL, anon key, service role key into `web/.env.local`.

- [ ] **Step 5: Commit**

```bash
git add supabase web/tests && git commit -m "feat(db): initial schema with draft state machine and RLS"
```

---

### Task 3: Auth, Supabase clients, workspace bootstrap, app shell

**Files:**
- Create: `web/src/lib/supabase/server.ts`, `client.ts`, `admin.ts`; `web/proxy.ts`; `web/src/lib/auth/session.ts`; `web/src/app/(auth)/login/page.tsx`; `web/src/app/(app)/layout.tsx`; `web/src/app/(app)/settings/page.tsx`; `web/src/app/api/auth/signout/route.ts`
- Test: `web/tests/auth/bootstrap.test.ts`

**Interfaces:**
- Produces: `getSession(): Promise<{ user, workspace, brand }>` (redirects to `/login` if absent); `ensureWorkspace(admin, userId, email)` pure-ish bootstrap; `createServerSupabase()`, `createAdminSupabase()`.

- [ ] **Step 1: Supabase clients**

`web/src/lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function createServerSupabase() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (all) => { try { all.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {} },
    },
  });
}
```
`web/src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";
export const createBrowserSupabase = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
```
`web/src/lib/supabase/admin.ts`:
```ts
import { createClient } from "@supabase/supabase-js";
export const createAdminSupabase = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
```

- [ ] **Step 2: Write the bootstrap test**

`web/tests/auth/bootstrap.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { ensureWorkspace } from "@/lib/auth/bootstrap";

function fakeDb(existing: { workspace_id: string } | null) {
  const inserted: Record<string, unknown[]> = {};
  const from = (table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
    insert: (row: unknown) => {
      (inserted[table] ??= []).push(row);
      return { select: () => ({ single: async () => ({ data: { id: `${table}-id`, ...(row as object) }, error: null }) }) };
    },
  });
  return { db: { from } as never, inserted };
}

describe("ensureWorkspace", () => {
  it("returns existing membership without inserting", async () => {
    const { db, inserted } = fakeDb({ workspace_id: "ws-1" });
    const ws = await ensureWorkspace(db, "user-1", "a@b.co");
    expect(ws).toBe("ws-1");
    expect(inserted).toEqual({});
  });
  it("creates workspace, membership, brand and preference row for a new user", async () => {
    const { db, inserted } = fakeDb(null);
    const ws = await ensureWorkspace(db, "user-1", "a@b.co");
    expect(ws).toBe("workspaces-id");
    expect(Object.keys(inserted)).toEqual(["workspaces", "workspace_members", "brands", "preference_summaries"]);
    expect(inserted.brands[0]).toMatchObject({ workspace_id: "workspaces-id", name: "My brand" });
  });
});
```
Run: `npm test` → Expected: FAIL (module missing).

- [ ] **Step 3: Implement bootstrap and session**

`web/src/lib/auth/bootstrap.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
export async function ensureWorkspace(db: SupabaseClient, userId: string, email: string): Promise<string> {
  const { data: m } = await db.from("workspace_members").select("workspace_id").eq("user_id", userId).maybeSingle();
  if (m) return m.workspace_id;
  const { data: ws } = await db.from("workspaces").insert({ name: `${email.split("@")[0]}'s workspace` }).select().single();
  await db.from("workspace_members").insert({ workspace_id: ws.id, user_id: userId, role: "owner" }).select().single();
  const { data: brand } = await db.from("brands").insert({ workspace_id: ws.id, name: "My brand" }).select().single();
  await db.from("preference_summaries").insert({ brand_id: brand.id, workspace_id: ws.id }).select().single();
  return ws.id;
}
```
`web/src/lib/auth/session.ts`:
```ts
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureWorkspace } from "./bootstrap";

export async function getSession() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminSupabase();
  const workspaceId = await ensureWorkspace(admin, user.id, user.email ?? "user@example.com");
  const { data: workspace } = await admin.from("workspaces").select("*").eq("id", workspaceId).single();
  const store = await cookies();
  const wanted = store.get("pp_brand")?.value;
  const { data: brands } = await admin.from("brands").select("*").eq("workspace_id", workspaceId).order("created_at");
  const brand = brands!.find((b) => b.id === wanted) ?? brands![0];
  return { user, workspace, brand, brands: brands!, supabase, admin };
}
```

- [ ] **Step 4: Proxy (auth gate)**

`web/proxy.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => req.cookies.getAll(), setAll: (all) => all.forEach(({ name, value, options }) => res.cookies.set(name, value, options)) },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const p = req.nextUrl.pathname;
  const isPublic = p === "/" || p.startsWith("/login") || p.startsWith("/approve") || p.startsWith("/api/");
  if (!user && !isPublic) return NextResponse.redirect(new URL("/login", req.url));
  return res;
}
export const config = { matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"] };
```

- [ ] **Step 5: Login page and sign-out**

`web/src/app/(auth)/login/page.tsx` (client component): email + password fields, two buttons "Sign in" and "Create account" calling `supabase.auth.signInWithPassword` / `signUp`, then `router.replace("/inbox")`. Show the error message inline. Minimal Tailwind card, product name "Postpilot".
`web/src/app/api/auth/signout/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
export async function POST(req: Request) {
  const s = await createServerSupabase(); await s.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
```
In Supabase dashboard → Auth → Providers → Email: disable "Confirm email" for the demo.

- [ ] **Step 6: App shell and settings**

`web/src/app/(app)/layout.tsx`: server component calling `getSession()`; left sidebar with links Inbox, New campaign, Brand, Calendar (Plan 3), Analytics (Plan 4), Settings; if `workspace.mode === "agency"` render `<BrandSwitcher brands current>` (client component that sets cookie `pp_brand` via a server action and refreshes). Sign-out form posting to `/api/auth/signout`.
`web/src/app/(app)/settings/page.tsx`: form with `mode` select (single/agency), timezone text, cadence type select (daily/weekdays/weekly), times (comma list). Server action `updateWorkspace(formData)` writes to `workspaces` with the admin client after checking `getSession()`.

- [ ] **Step 7: Run tests, boot the app, sign up once**

`npm test` → PASS. `npm run dev` → open http://localhost:3000/login → create an account → land on `/inbox` (empty page is fine for now; create `web/src/app/(app)/inbox/page.tsx` returning "No drafts yet").

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(auth): email/password auth, workspace bootstrap, app shell and settings"
```

---

### Task 4: Platform rules and campaign settings resolution

**Files:**
- Create: `web/src/lib/platforms/rules.ts`, `web/src/lib/campaigns/settings.ts`
- Test: `web/tests/platforms/rules.test.ts`, `web/tests/campaigns/settings.test.ts`

**Interfaces:**
- Produces:
  - `type Platform = "instagram"|"facebook"|"tiktok"|"youtube"|"linkedin"|"x"|"threads"|"pinterest"|"bluesky"|"mastodon"`
  - `PLATFORM_RULES: Record<Platform, PlatformRules>` with `{ label, captionMax, hashtagMin, hashtagMax, aspect, hookStyle, supportsVideo, supportsCarousel, firstCommentHashtags, adapter }`
  - `campaignSettingsSchema` (zod) and `type CampaignSettings`
  - `resolveSettings(defaults: unknown, overrides: unknown): CampaignSettings`

- [ ] **Step 1: Tests**

`web/tests/platforms/rules.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { PLATFORM_RULES, PLATFORMS } from "@/lib/platforms/rules";
describe("PLATFORM_RULES", () => {
  it("covers all platforms with sane limits", () => {
    for (const p of PLATFORMS) {
      const r = PLATFORM_RULES[p];
      expect(r.captionMax).toBeGreaterThan(0);
      expect(r.hashtagMax).toBeGreaterThanOrEqual(r.hashtagMin);
      expect(["native", "late"]).toContain(r.adapter);
    }
  });
  it("knows X is short and Instagram uses first-comment hashtags", () => {
    expect(PLATFORM_RULES.x.captionMax).toBe(280);
    expect(PLATFORM_RULES.instagram.firstCommentHashtags).toBe(true);
  });
});
```
`web/tests/campaigns/settings.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveSettings } from "@/lib/campaigns/settings";
describe("resolveSettings", () => {
  it("applies defaults then overrides", () => {
    const s = resolveSettings({ platforms: ["instagram"], tone: "witty" }, { platforms: ["x", "bluesky"], postsCount: 2 });
    expect(s.platforms).toEqual(["x", "bluesky"]);
    expect(s.tone).toBe("witty");
    expect(s.postsCount).toBe(2);
    expect(s.candidatesPerSlot).toBe(2);
  });
  it("rejects unknown platforms and empty platform lists", () => {
    expect(() => resolveSettings({}, { platforms: ["myspace"] })).toThrow();
    expect(() => resolveSettings({}, { platforms: [] })).toThrow();
  });
  it("ignores undefined override keys", () => {
    const s = resolveSettings({ platforms: ["bluesky"], hashtagCount: 8 }, { hashtagCount: undefined });
    expect(s.hashtagCount).toBe(8);
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement**

`web/src/lib/platforms/rules.ts`:
```ts
export const PLATFORMS = ["instagram","facebook","tiktok","youtube","linkedin","x","threads","pinterest","bluesky","mastodon"] as const;
export type Platform = (typeof PLATFORMS)[number];
export interface PlatformRules {
  label: string; captionMax: number; hashtagMin: number; hashtagMax: number;
  aspect: "9:16" | "1:1" | "4:5" | "16:9"; hookStyle: string;
  supportsVideo: boolean; supportsCarousel: boolean; firstCommentHashtags: boolean; adapter: "native" | "late";
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
```
`web/src/lib/campaigns/settings.ts`:
```ts
import { z } from "zod";
import { PLATFORMS } from "@/lib/platforms/rules";
export const campaignSettingsSchema = z.object({
  postsCount: z.number().int().min(1).max(10).default(3),
  videosCount: z.number().int().min(0).max(5).default(1),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  tone: z.string().min(1).default("friendly, confident, specific"),
  language: z.string().min(2).default("en"),
  cta: z.string().optional(),
  hashtagCount: z.number().int().min(0).max(30).default(5),
  videoLength: z.enum(["15", "30", "60"]).default("30"),
  voice: z.string().default("Kore"),
  allowAiBroll: z.boolean().default(false),
  candidatesPerSlot: z.union([z.literal(2), z.literal(3)]).default(2),
});
export type CampaignSettings = z.infer<typeof campaignSettingsSchema>;
const strip = (o: unknown) => Object.fromEntries(Object.entries((o ?? {}) as object).filter(([, v]) => v !== undefined));
export function resolveSettings(defaults: unknown, overrides: unknown): CampaignSettings {
  return campaignSettingsSchema.parse({ ...strip(defaults), ...strip(overrides) });
}
```

- [ ] **Step 3: Run tests** → PASS. **Step 4: Commit** `git commit -am "feat: platform rules and campaign settings resolution"` (use `git add -A` first).

---

### Task 5: Brand kit and voice profile

**Files:**
- Create: `web/src/lib/brand/voice-profile.ts`, `web/src/lib/brand/schema.ts`, `web/src/app/(app)/brand/page.tsx`, `web/src/app/(app)/brand/actions.ts`
- Test: `web/tests/brand/voice-profile.test.ts`

**Interfaces:**
- Produces: `brandKitSchema` (zod) `{ tagline, description, audience, toneWords: string[], colors: string[], fonts: string[], logoUrl?, samplePosts: string[], defaultCta?, hashtagSets: string[] }`; `buildVoiceProfile(kit: BrandKit, bannedWords: string[]): string`.

- [ ] **Step 1: Test**

`web/tests/brand/voice-profile.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildVoiceProfile } from "@/lib/brand/voice-profile";
const kit = { tagline: "Coffee that ships itself", description: "Monthly specialty coffee subscription", audience: "remote workers 25-40", toneWords: ["warm", "witty"], colors: ["#3B2F2F"], fonts: ["Inter"], samplePosts: ["Monday, but make it Ethiopian.", "Your desk deserves better beans."], hashtagSets: ["#specialtycoffee #wfh"] };
describe("buildVoiceProfile", () => {
  it("includes tone, audience, samples and banned words", () => {
    const v = buildVoiceProfile(kit, ["cheap"]);
    expect(v).toContain("warm, witty");
    expect(v).toContain("remote workers 25-40");
    expect(v).toContain("Monday, but make it Ethiopian.");
    expect(v).toContain("Never use: cheap");
  });
  it("handles an empty kit without throwing", () => {
    expect(buildVoiceProfile({ tagline: "", description: "", audience: "", toneWords: [], colors: [], fonts: [], samplePosts: [], hashtagSets: [] }, [])).toContain("Voice:");
  });
});
```

- [ ] **Step 2: Implement**

`web/src/lib/brand/schema.ts`:
```ts
import { z } from "zod";
export const brandKitSchema = z.object({
  tagline: z.string().default(""), description: z.string().default(""), audience: z.string().default(""),
  toneWords: z.array(z.string()).default([]), colors: z.array(z.string()).default([]), fonts: z.array(z.string()).default([]),
  logoUrl: z.string().url().optional(), samplePosts: z.array(z.string()).default([]),
  defaultCta: z.string().optional(), hashtagSets: z.array(z.string()).default([]),
});
export type BrandKit = z.infer<typeof brandKitSchema>;
```
`web/src/lib/brand/voice-profile.ts`:
```ts
import type { BrandKit } from "./schema";
export function buildVoiceProfile(kit: BrandKit, bannedWords: string[]): string {
  const lines = [
    `Voice: ${kit.toneWords.join(", ") || "clear and human"}.`,
    kit.description && `About: ${kit.description}`,
    kit.tagline && `Tagline: ${kit.tagline}`,
    kit.audience && `Audience: ${kit.audience}`,
    kit.defaultCta && `Default CTA: ${kit.defaultCta}`,
    kit.samplePosts.length && `Sample posts in our voice:\n${kit.samplePosts.map((p) => `- ${p}`).join("\n")}`,
    bannedWords.length && `Never use: ${bannedWords.join(", ")}`,
  ].filter(Boolean);
  return lines.join("\n");
}
```

- [ ] **Step 3: Brand page**

`web/src/app/(app)/brand/actions.ts` server action `saveBrand(formData)`: parse fields with `brandKitSchema` (split comma lists, one sample post per line), compute `voice_profile = buildVoiceProfile(kit, bannedWords)`, update `brands` row for `getSession().brand.id`, `revalidatePath("/brand")`. Logo upload: if a file is present, upload to Storage bucket `media` at `${workspaceId}/brand/logo.${ext}` and set `logoUrl` to the public URL.
`web/src/app/(app)/brand/page.tsx`: server component form (name, tagline, description, audience, tone words, colours, fonts, logo file, sample posts textarea, banned words, default CTA, hashtag sets) with values from `brand.kit`; a read-only "Voice profile preview" block showing `brand.voice_profile`.

- [ ] **Step 4: Tests pass; manual check** — save the coffee-subscription fixture kit from the test above; preview updates. **Commit:** `feat(brand): brand kit form and voice profile`.

---

### Task 6: Campaign request form, uploads, n8n trigger

**Files:**
- Create: `web/src/lib/n8n/trigger.ts`, `web/src/lib/campaigns/create.ts`, `web/src/app/(app)/campaigns/new/page.tsx`, `web/src/app/api/campaigns/route.ts`
- Test: `web/tests/campaigns/create.test.ts`

**Interfaces:**
- Produces: `createCampaign(db, input: { workspaceId, brandId, prompt, references: Reference[], overrides: unknown, defaults: unknown }) → { id, settings }`; `type Reference = { kind: "image"|"video"|"url"; url: string; name?: string }`; `triggerWorkflow(path, payload)` POSTs JSON to `${N8N_BASE_URL}${path}` with the secret header.

- [ ] **Step 1: Test**

`web/tests/campaigns/create.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createCampaign } from "@/lib/campaigns/create";
describe("createCampaign", () => {
  it("resolves settings and inserts a queued campaign", async () => {
    const rows: unknown[] = [];
    const db = { from: () => ({ insert: (r: unknown) => { rows.push(r); return { select: () => ({ single: async () => ({ data: { id: "c1", ...(r as object) }, error: null }) }) }; } }) } as never;
    const out = await createCampaign(db, { workspaceId: "w", brandId: "b", prompt: "Launch our coffee subscription", references: [{ kind: "url", url: "https://example.com" }], overrides: { platforms: ["bluesky"], postsCount: 2 }, defaults: { tone: "witty" } });
    expect(out.id).toBe("c1");
    expect(out.settings.platforms).toEqual(["bluesky"]);
    expect(rows[0]).toMatchObject({ workspace_id: "w", brand_id: "b", status: "queued" });
  });
  it("rejects an empty prompt", async () => {
    await expect(createCampaign({} as never, { workspaceId: "w", brandId: "b", prompt: "  ", references: [], overrides: { platforms: ["x"] }, defaults: {} })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Implement**

`web/src/lib/campaigns/create.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { resolveSettings } from "./settings";
export const referenceSchema = z.object({ kind: z.enum(["image", "video", "url"]), url: z.string().url(), name: z.string().optional() });
export type Reference = z.infer<typeof referenceSchema>;
export async function createCampaign(db: SupabaseClient, input: { workspaceId: string; brandId: string; prompt: string; references: Reference[]; overrides: unknown; defaults: unknown }) {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Prompt is required");
  const settings = resolveSettings(input.defaults, input.overrides);
  const references = z.array(referenceSchema).parse(input.references);
  const { data, error } = await db.from("campaigns").insert({ workspace_id: input.workspaceId, brand_id: input.brandId, prompt, references, settings, status: "queued" }).select().single();
  if (error) throw error;
  return { id: data.id as string, settings };
}
```
`web/src/lib/n8n/trigger.ts`:
```ts
export async function triggerWorkflow(path: string, payload: unknown) {
  const res = await fetch(`${process.env.N8N_BASE_URL}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-postpilot-secret": process.env.APP_SECRET! }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`n8n ${path} responded ${res.status}`);
}
```
`web/src/app/api/campaigns/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createCampaign } from "@/lib/campaigns/create";
import { triggerWorkflow } from "@/lib/n8n/trigger";
export async function POST(req: Request) {
  const { workspace, brand, admin } = await getSession();
  const body = await req.json();
  const { id, settings } = await createCampaign(admin, { workspaceId: workspace.id, brandId: brand.id, prompt: body.prompt, references: body.references ?? [], overrides: body.settings ?? {}, defaults: workspace.default_settings });
  try {
    await triggerWorkflow(process.env.N8N_GENERATE_WEBHOOK_PATH!, { campaignId: id, platforms: settings.platforms, candidatesPerSlot: settings.candidatesPerSlot, postsCount: settings.postsCount });
    await admin.from("campaigns").update({ status: "generating" }).eq("id", id);
  } catch (e) {
    await admin.from("campaigns").update({ status: "failed", error: String(e) }).eq("id", id);
    return NextResponse.json({ id, error: String(e) }, { status: 502 });
  }
  return NextResponse.json({ id });
}
```

- [ ] **Step 3: Request form page**

`web/src/app/(app)/campaigns/new/page.tsx` (client form): textarea prompt; file input (images/video, multiple) uploaded client-side to Storage `media/${workspaceId}/refs/${uuid}-${name}` via `createBrowserSupabase().storage.from("media").upload`, producing `Reference[]` with public URLs; URL list input; settings panel with the fields from `campaignSettingsSchema` (platform checkboxes grouped Native / Via Late, counts, tone, language, CTA, hashtag count, video length, voice, AI b-roll toggle, candidates per slot) pre-filled from `workspace.default_settings`; "Save as defaults" checkbox that also PATCHes `/api/settings/defaults` (add a tiny route that updates `workspaces.default_settings`). Submit → `POST /api/campaigns` → `router.push("/inbox?campaign=" + id)`.

- [ ] **Step 4: Tests pass; commit** `feat(campaigns): request form, reference uploads, n8n trigger`.

---

### Task 7: Draft output schema and generation prompt builder

**Files:**
- Create: `web/src/lib/generation/schema.ts`, `web/src/lib/generation/prompt.ts`
- Test: `web/tests/generation/prompt.test.ts`

**Interfaces:**
- Produces:
  - `draftOutputSchema` zod: `{ hook, caption, hashtags: string[], firstComment: string|null, altText: string|null, mediaPlan: MediaPlan, changeNotes: string[] }` where `MediaPlan = {kind:"use_reference_image", index:number} | {kind:"generate_image", prompt:string} | {kind:"carousel", slides: {title:string, body:string}[]} | {kind:"video", scenes: {onScreenText:string, voiceover:string, visual:string}[]} | {kind:"none"}`
  - `RESPONSE_JSON_SCHEMA` (plain JSON schema object for Gemini `responseSchema`)
  - `buildGenerationPrompts(input: GenerationInput): PromptBundle[]` where `GenerationInput = { brand: { name, voiceProfile }, settings: CampaignSettings, prompt: string, references: string[] /* summaries */, preferenceSummary: string|null, feedback: FeedbackContext|null, platforms?: Platform[], candidatesPerSlot?: number }` and `PromptBundle = { platform, candidateIndex, system: string, user: string }`
  - `type FeedbackContext = { recentEvents: { action: string; note?: string; editDiff?: unknown }[]; positiveExamples: string[]; negativeExamples: string[]; hardInstruction?: string; requireChanges: boolean }`

- [ ] **Step 1: Tests**

`web/tests/generation/prompt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildGenerationPrompts } from "@/lib/generation/prompt";
import { draftOutputSchema } from "@/lib/generation/schema";
import { resolveSettings } from "@/lib/campaigns/settings";
const base = { brand: { name: "Beanpost", voiceProfile: "Voice: warm, witty." }, settings: resolveSettings({}, { platforms: ["x", "instagram"], candidatesPerSlot: 2 }), prompt: "Launch our coffee subscription", references: ["Image 1: a bag of coffee on a desk"], preferenceSummary: null, feedback: null };
describe("buildGenerationPrompts", () => {
  it("emits platforms × candidates bundles with platform limits in the user prompt", () => {
    const b = buildGenerationPrompts(base);
    expect(b).toHaveLength(4);
    const x = b.find((p) => p.platform === "x")!;
    expect(x.user).toContain("280 characters");
    expect(x.user).toContain("Beanpost");
    expect(x.system).toContain("warm, witty");
  });
  it("makes candidates deliberately different", () => {
    const [a, b] = buildGenerationPrompts(base).filter((p) => p.platform === "x");
    expect(a.user).not.toEqual(b.user);
    expect(b.user).toMatch(/different angle/i);
  });
  it("injects preference summary and hard instruction from feedback", () => {
    const b = buildGenerationPrompts({ ...base, preferenceSummary: "Prefers no emojis.", feedback: { recentEvents: [], positiveExamples: ["Monday, but make it Ethiopian."], negativeExamples: ["BUY NOW!!!"], hardInstruction: "Mention free shipping", requireChanges: false } });
    expect(b[0].system).toContain("Prefers no emojis.");
    expect(b[0].user).toContain("Mention free shipping");
    expect(b[0].user).toContain("Monday, but make it Ethiopian.");
    expect(b[0].user).toContain("BUY NOW!!!");
  });
  it("on bare regenerate demands at least two visible changes and change notes", () => {
    const b = buildGenerationPrompts({ ...base, feedback: { recentEvents: [{ action: "reject", note: "too salesy" }], positiveExamples: [], negativeExamples: [], requireChanges: true } });
    expect(b[0].user).toMatch(/change at least two/i);
    expect(b[0].user).toContain("changeNotes");
  });
});
describe("draftOutputSchema", () => {
  it("accepts a video media plan and rejects unknown kinds", () => {
    expect(draftOutputSchema.parse({ hook: "h", caption: "c", hashtags: ["#a"], firstComment: null, altText: null, mediaPlan: { kind: "video", scenes: [{ onScreenText: "t", voiceover: "v", visual: "desk" }] }, changeNotes: [] }).mediaPlan.kind).toBe("video");
    expect(() => draftOutputSchema.parse({ hook: "h", caption: "c", hashtags: [], firstComment: null, altText: null, mediaPlan: { kind: "hologram" }, changeNotes: [] })).toThrow();
  });
});
```

- [ ] **Step 2: Implement schema**

`web/src/lib/generation/schema.ts`:
```ts
import { z } from "zod";
export const mediaPlanSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("use_reference_image"), index: z.number().int().min(0) }),
  z.object({ kind: z.literal("generate_image"), prompt: z.string().min(1) }),
  z.object({ kind: z.literal("carousel"), slides: z.array(z.object({ title: z.string(), body: z.string() })).min(2).max(10) }),
  z.object({ kind: z.literal("video"), scenes: z.array(z.object({ onScreenText: z.string(), voiceover: z.string(), visual: z.string() })).min(1).max(12) }),
  z.object({ kind: z.literal("none") }),
]);
export const draftOutputSchema = z.object({
  hook: z.string().min(1), caption: z.string().min(1), hashtags: z.array(z.string()).default([]),
  firstComment: z.string().nullable().default(null), altText: z.string().nullable().default(null),
  mediaPlan: mediaPlanSchema, changeNotes: z.array(z.string()).default([]),
});
export type DraftOutput = z.infer<typeof draftOutputSchema>;
export type MediaPlan = z.infer<typeof mediaPlanSchema>;
export const RESPONSE_JSON_SCHEMA = {
  type: "object", required: ["hook", "caption", "hashtags", "firstComment", "altText", "mediaPlan", "changeNotes"],
  properties: {
    hook: { type: "string" }, caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } },
    firstComment: { type: "string", nullable: true }, altText: { type: "string", nullable: true },
    mediaPlan: { type: "object", required: ["kind"], properties: {
      kind: { type: "string", enum: ["use_reference_image", "generate_image", "carousel", "video", "none"] },
      index: { type: "integer" }, prompt: { type: "string" },
      slides: { type: "array", items: { type: "object", properties: { title: { type: "string" }, body: { type: "string" } }, required: ["title", "body"] } },
      scenes: { type: "array", items: { type: "object", properties: { onScreenText: { type: "string" }, voiceover: { type: "string" }, visual: { type: "string" } }, required: ["onScreenText", "voiceover", "visual"] } },
    } },
    changeNotes: { type: "array", items: { type: "string" } },
  },
};
```

- [ ] **Step 3: Implement prompt builder**

`web/src/lib/generation/prompt.ts`:
```ts
import { PLATFORM_RULES, type Platform } from "@/lib/platforms/rules";
import type { CampaignSettings } from "@/lib/campaigns/settings";
export interface FeedbackContext { recentEvents: { action: string; note?: string; editDiff?: unknown }[]; positiveExamples: string[]; negativeExamples: string[]; hardInstruction?: string; requireChanges: boolean; }
export interface GenerationInput { brand: { name: string; voiceProfile: string }; settings: CampaignSettings; prompt: string; references: string[]; preferenceSummary: string | null; feedback: FeedbackContext | null; platforms?: Platform[]; candidatesPerSlot?: number; }
export interface PromptBundle { platform: Platform; candidateIndex: number; system: string; user: string; }
const ANGLES = ["the most direct, benefit-first angle", "a different angle: story, contrast, or a surprising detail", "a third angle: a question or a bold claim the audience would argue with"];
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
    for (let i = 0; i < n; i++) {
      const parts = [
        `Platform: ${r.label}. Caption limit ${r.captionMax} characters. Use ${Math.min(Math.max(input.settings.hashtagCount, r.hashtagMin), r.hashtagMax)} hashtags${r.firstCommentHashtags ? " placed in firstComment, not the caption" : ""}. Hook style: ${r.hookStyle}. Aspect ratio ${r.aspect}.`,
        `Tone: ${input.settings.tone}. Language: ${input.settings.language}.${input.settings.cta ? ` CTA: ${input.settings.cta}.` : ""}`,
        `Brief from the owner:\n${input.prompt}`,
        input.references.length ? `Reference material:\n${input.references.map((s, k) => `${k + 1}. ${s}`).join("\n")}` : "",
        `Candidate ${i + 1} of ${n}: take ${ANGLES[i] ?? ANGLES[ANGLES.length - 1]}.`,
        `mediaPlan: ${input.settings.videosCount > 0 && r.supportsVideo && i === 0 ? `prefer kind "video" with ${input.settings.videoLength}s of scenes (each scene 3-6 seconds)` : `choose "use_reference_image" if a reference image fits, else "generate_image" with a detailed prompt, else "none"`}.`,
        "altText: describe the intended image in one sentence.",
      ];
      const f = input.feedback;
      if (f) {
        if (f.hardInstruction) parts.push(`Owner's explicit instruction (must follow): ${f.hardInstruction}`);
        if (f.positiveExamples.length) parts.push(`Posts the owner approved (match this feel):\n${f.positiveExamples.map((p) => `- ${p}`).join("\n")}`);
        if (f.negativeExamples.length) parts.push(`Posts the owner rejected (avoid this feel):\n${f.negativeExamples.map((p) => `- ${p}`).join("\n")}`);
        if (f.recentEvents.length) parts.push(`Recent feedback signals: ${f.recentEvents.map((e) => e.note ? `${e.action}: "${e.note}"` : e.action).join("; ")}`);
        if (f.requireChanges) parts.push("The owner asked for a new version without saying why. Infer what they disliked from the signals above and change at least two of: hook, angle, format, length, CTA. List each change as a short sentence in changeNotes.");
      }
      out.push({ platform, candidateIndex: i, system, user: parts.filter(Boolean).join("\n\n") });
    }
  }
  return out;
}
```

- [ ] **Step 4: Tests pass; commit** `feat(generation): draft schema and prompt builder`.

---

### Task 8: Gemini client, reference summaries, bundle + drafts + fail API routes

**Files:**
- Create: `web/src/lib/ai/gemini.ts`, `web/src/lib/generation/references.ts`, `web/src/lib/api/guard.ts`, `web/src/app/api/campaigns/[id]/bundle/route.ts`, `web/src/app/api/campaigns/[id]/drafts/route.ts`, `web/src/app/api/campaigns/[id]/fail/route.ts`
- Test: `web/tests/api/guard.test.ts`, `web/tests/generation/references.test.ts`

**Interfaces:**
- Produces: `requireSecret(req): void|Response`; `generateJson<T>(system, user, schema, parse)`, `embed(text): Promise<number[]>`; `summariseReferences(refs: Reference[], ai): Promise<string[]>`.
- Route contracts (all require `x-postpilot-secret`):
  - `GET /api/campaigns/:id/bundle` → `{ campaignId, model: "gemini-3.5-flash", responseSchema, bundles: PromptBundle[] }`
  - `POST /api/campaigns/:id/drafts` body `{ platform, candidateIndex, output: unknown, parentDraftId?: string }` → validates with `draftOutputSchema`, inserts a draft (version = parent.version+1 if parent), returns `{ draftId }`. When all expected drafts exist, sets campaign `status = "review"`.
  - `POST /api/campaigns/:id/fail` body `{ stage, error }` → campaign `status="failed", error`.

- [ ] **Step 1: Tests**

`web/tests/api/guard.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { requireSecret } from "@/lib/api/guard";
describe("requireSecret", () => {
  it("rejects a missing or wrong secret and accepts the right one", () => {
    process.env.APP_SECRET = "s3cret";
    expect(requireSecret(new Request("http://x", { headers: {} }))?.status).toBe(401);
    expect(requireSecret(new Request("http://x", { headers: { "x-postpilot-secret": "nope" } }))?.status).toBe(401);
    expect(requireSecret(new Request("http://x", { headers: { "x-postpilot-secret": "s3cret" } }))).toBeUndefined();
  });
});
```
`web/tests/generation/references.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { summariseReferences } from "@/lib/generation/references";
describe("summariseReferences", () => {
  it("describes images and videos through the vision model and pages through the fetcher", async () => {
    const ai = { describeMedia: async (url: string) => `desc of ${url}`, summariseText: async (t: string) => `sum:${t.slice(0, 5)}` };
    const fetchText = async () => "Hello world page text";
    const out = await summariseReferences([{ kind: "image", url: "https://a/i.png" }, { kind: "url", url: "https://a/page" }], ai, fetchText);
    expect(out).toEqual(["Image 1: desc of https://a/i.png", "Link 2 (https://a/page): sum:Hello"]);
  });
});
```

- [ ] **Step 2: Implement**

`web/src/lib/api/guard.ts`:
```ts
import { NextResponse } from "next/server";
export function requireSecret(req: Request) {
  if (req.headers.get("x-postpilot-secret") !== process.env.APP_SECRET) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
```
`web/src/lib/ai/gemini.ts`:
```ts
import { GoogleGenAI } from "@google/genai";
const ai = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
export const TEXT_MODEL = "gemini-3.5-flash";
export async function generateJson<T>(system: string, user: string, responseSchema: object, parse: (raw: unknown) => T): Promise<T> {
  const res = await ai().models.generateContent({ model: TEXT_MODEL, contents: user, config: { systemInstruction: system, responseMimeType: "application/json", responseSchema, temperature: 0.9 } });
  return parse(JSON.parse(res.text ?? "{}"));
}
export async function embed(text: string): Promise<number[]> {
  const res = await ai().models.embedContent({ model: "gemini-embedding-001", contents: text, config: { outputDimensionality: 768 } });
  return res.embeddings![0].values!;
}
export async function describeMedia(url: string): Promise<string> {
  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer()).toString("base64");
  const mime = url.match(/\.(mp4|mov)$/i) ? "video/mp4" : url.match(/\.png$/i) ? "image/png" : "image/jpeg";
  const res = await ai().models.generateContent({ model: TEXT_MODEL, contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime, data: bytes } }, { text: "Describe this for a social media copywriter in 2 sentences: subject, setting, mood, any text visible." }] }] });
  return res.text ?? "";
}
export async function summariseText(text: string): Promise<string> {
  const res = await ai().models.generateContent({ model: TEXT_MODEL, contents: `Summarise the key points of this page in 3 bullet points for a copywriter:\n\n${text.slice(0, 12000)}` });
  return res.text ?? "";
}
```
`web/src/lib/generation/references.ts`:
```ts
import type { Reference } from "@/lib/campaigns/create";
type Ai = { describeMedia: (url: string) => Promise<string>; summariseText: (t: string) => Promise<string> };
export async function fetchPageText(url: string): Promise<string> {
  const html = await (await fetch(url, { headers: { "user-agent": "PostpilotBot/1.0" } })).text();
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
export async function summariseReferences(refs: Reference[], ai: Ai, fetchText: (u: string) => Promise<string> = fetchPageText): Promise<string[]> {
  return Promise.all(refs.map(async (r, i) => {
    if (r.kind === "url") return `Link ${i + 1} (${r.url}): ${await ai.summariseText(await fetchText(r.url))}`;
    return `${r.kind === "image" ? "Image" : "Video"} ${i + 1}: ${await ai.describeMedia(r.url)}`;
  }));
}
```
`web/src/app/api/campaigns/[id]/bundle/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requireSecret } from "@/lib/api/guard";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildGenerationPrompts } from "@/lib/generation/prompt";
import { RESPONSE_JSON_SCHEMA } from "@/lib/generation/schema";
import { summariseReferences } from "@/lib/generation/references";
import { resolveSettings } from "@/lib/campaigns/settings";
import * as gemini from "@/lib/ai/gemini";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireSecret(req); if (denied) return denied;
  const { id } = await params;
  const db = createAdminSupabase();
  const { data: c } = await db.from("campaigns").select("*, brands(*), preference_summaries:brands(preference_summaries(summary))").eq("id", id).single();
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  const settings = resolveSettings({}, c.settings);
  const references = await summariseReferences(c.references, gemini);
  const summary = c.brands?.preference_summaries?.[0]?.summary || null;
  const bundles = buildGenerationPrompts({ brand: { name: c.brands.name, voiceProfile: c.brands.voice_profile }, settings, prompt: c.prompt, references, preferenceSummary: summary, feedback: null });
  return NextResponse.json({ campaignId: id, model: gemini.TEXT_MODEL, responseSchema: RESPONSE_JSON_SCHEMA, bundles });
}
```
(If the nested select for preference_summaries fails in practice, do a second query `from("preference_summaries").select("summary").eq("brand_id", c.brand_id).maybeSingle()` — simpler and fine.)

`web/src/app/api/campaigns/[id]/drafts/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requireSecret } from "@/lib/api/guard";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { draftOutputSchema } from "@/lib/generation/schema";
import { embed } from "@/lib/ai/gemini";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireSecret(req); if (denied) return denied;
  const { id } = await params;
  const body = await req.json();
  const parsed = draftOutputSchema.safeParse(body.output);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const o = parsed.data;
  const db = createAdminSupabase();
  const { data: c } = await db.from("campaigns").select("id, workspace_id, brand_id, settings").eq("id", id).single();
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  let version = 1, parent: string | null = null;
  if (body.parentDraftId) {
    const { data: p } = await db.from("drafts").select("version").eq("id", body.parentDraftId).single();
    version = (p?.version ?? 0) + 1; parent = body.parentDraftId;
  }
  const embedding = await embed(`${o.hook}\n${o.caption}`).catch(() => null);
  const { data: d, error } = await db.from("drafts").insert({ workspace_id: c.workspace_id, campaign_id: id, brand_id: c.brand_id, platform: body.platform, candidate_index: body.candidateIndex ?? 0, version, parent_draft_id: parent, hook: o.hook, caption: o.caption, hashtags: o.hashtags, first_comment: o.firstComment, alt_text: o.altText, media_plan: o.mediaPlan, change_notes: o.changeNotes, embedding }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const expected = (c.settings.platforms?.length ?? 1) * (c.settings.candidatesPerSlot ?? 2);
  const { count } = await db.from("drafts").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("version", 1);
  if ((count ?? 0) >= expected) await db.from("campaigns").update({ status: "review" }).eq("id", id);
  return NextResponse.json({ draftId: d.id });
}
```
`web/src/app/api/campaigns/[id]/fail/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requireSecret } from "@/lib/api/guard";
import { createAdminSupabase } from "@/lib/supabase/admin";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireSecret(req); if (denied) return denied;
  const { id } = await params; const { stage, error } = await req.json();
  await createAdminSupabase().from("campaigns").update({ status: "failed", error: `${stage}: ${error}` }).eq("id", id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Tests pass; curl check with the dev server**

```bash
curl -s -H "x-postpilot-secret: $APP_SECRET" localhost:3000/api/campaigns/<id>/bundle | head -c 600
```
Expected: JSON with `bundles` array.

- [ ] **Step 4: Commit** `feat(api): prompt bundle, drafts ingest and failure callback for n8n`.

---

### Task 9: n8n `generate` workflow

**Files:**
- Create: `n8n/workflows/postpilot-generate.json`, `n8n/README.md`

**Interfaces:**
- Consumes: the three routes from Task 8. Webhook path `/webhook/postpilot-generate`, POST body `{ campaignId, platforms, candidatesPerSlot, postsCount }`.

- [ ] **Step 1: Build the workflow in the n8n UI** (https://n8n.152-67-183-135.sslip.io), nodes in order:
  1. **Webhook** — POST, path `postpilot-generate`, respond "Immediately". Add a **Code** node right after that throws if `$json.headers['x-postpilot-secret'] !== $env.APP_SECRET` (set `APP_SECRET` in the VM's `~/n8n/.env` and pass it through `docker-compose.yml` environment).
  2. **HTTP Request "Get bundle"** — GET `{{$env.APP_BASE_URL}}/api/campaigns/{{$json.body.campaignId}}/bundle`, header `x-postpilot-secret: {{$env.APP_SECRET}}`.
  3. **Split Out** — field `bundles`, include other fields `campaignId, model, responseSchema`.
  4. **HTTP Request "Gemini"** — POST `https://generativelanguage.googleapis.com/v1beta/models/{{$json.model}}:generateContent?key={{$env.GEMINI_API_KEY}}`, JSON body:
     ```json
     { "systemInstruction": { "parts": [{ "text": "={{$json.system}}" }] },
       "contents": [{ "role": "user", "parts": [{ "text": "={{$json.user}}" }] }],
       "generationConfig": { "responseMimeType": "application/json", "responseSchema": "={{$json.responseSchema}}", "temperature": 0.9 } }
     ```
     Settings → Retry On Fail: 3 tries, 4000 ms wait. Batch: 2 items at a time, 1500 ms between batches (free-tier RPM).
  5. **Code "Parse"** — `return $input.all().map((it, i) => { const src = $('Split Out').all()[i].json; return { json: { campaignId: src.campaignId, platform: src.platform, candidateIndex: src.candidateIndex, output: JSON.parse(it.json.candidates[0].content.parts[0].text) } }; });`
  6. **HTTP Request "Post draft"** — POST `{{$env.APP_BASE_URL}}/api/campaigns/{{$json.campaignId}}/drafts` with the secret header and body `{{$json}}`.
  7. **Error Trigger** workflow branch → **HTTP Request "Fail"** POST `{{$env.APP_BASE_URL}}/api/campaigns/{{$json.execution.customData?.campaignId ?? $json.workflow?.campaignId}}/fail` body `{ "stage": "{{$json.execution.lastNodeExecuted}}", "error": "{{$json.execution.error.message}}" }`. In the Webhook's following Code node call `$execution.customData.set('campaignId', $json.body.campaignId)` so the error path can read it.
  Set the workflow to Active.

- [ ] **Step 2: Export and scrub**

Download the workflow JSON → save as `n8n/workflows/postpilot-generate.json`. Replace any literal secrets with `N8N_APP_SECRET_HERE` / `GEMINI_API_KEY_HERE` (there should be none if `$env` is used). `n8n/README.md`: how to import, required env vars (`APP_BASE_URL`, `APP_SECRET`, `GEMINI_API_KEY`), and the three app endpoints it calls.

- [ ] **Step 3: End-to-end check** — for local dev, expose the app with `npx --yes localtunnel --port 3000` (or Vercel preview) and set `APP_BASE_URL` in n8n to that URL. Submit the coffee campaign for Bluesky + Instagram with 2 candidates → expect 4 rows in `drafts` and campaign status `review` within ~60 s. If Gemini returns 429, confirm the Retry settings kick in.

- [ ] **Step 4: Commit** `feat(n8n): generate workflow (bundle → Gemini → drafts) with error callback`.

---

### Task 10: Review inbox with previews

**Files:**
- Create: `web/src/app/(app)/inbox/page.tsx`, `web/src/components/inbox/DraftCard.tsx`, `web/src/components/inbox/PlatformPreview.tsx`, `web/src/components/inbox/InboxLive.tsx`, `web/src/components/BrandSwitcher.tsx`
- Modify: `web/src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `drafts` rows; `POST /api/drafts/:id/action` (Task 11) with body `{ action: "approve"|"edit"|"reject"|"regenerate", note?: string, edits?: { hook, caption, hashtags, firstComment, altText } }`.

- [ ] **Step 1: Server page** — `inbox/page.tsx` loads campaigns for `brand.id` (latest 20) and their drafts with `status in ('draft')` plus the campaign's status/error; renders `<InboxLive initialDrafts campaigns brandId />`.
- [ ] **Step 2: Live updates** — `InboxLive.tsx` (client) subscribes with `createBrowserSupabase().channel("drafts").on("postgres_changes", { event: "*", schema: "public", table: "drafts", filter: \`brand_id=eq.${brandId}\` }, handler)` merging inserts/updates into state. Groups drafts by campaign → platform → candidate. Shows a "Generating…" skeleton row while campaign status is `generating`, and an error banner with a Retry button (re-POSTs `/api/campaigns` with the same prompt/settings) when `failed`.
- [ ] **Step 3: Card** — `DraftCard.tsx`: `<PlatformPreview>` (platform-specific frame: X = plain text with 280 counter; Instagram = square image placeholder/first reference image + caption with "more"; TikTok/YouTube = 9:16 frame with hook as on-screen text; LinkedIn/Facebook/Mastodon/Bluesky/Threads/Pinterest = simple card) on the left; right column: version badge (`v2 ↺` when `parent_draft_id`), `change_notes` list under a "What changed" label, editable fields (hook, caption, hashtags, first comment, alt text) toggled by an "Edit" button; action bar: **Approve**, **Save edits** (visible in edit mode), **Reject** (opens a note textarea; note optional but placeholder says "Tell it what's wrong, or leave blank to let it guess"), **Regenerate** (no note). Each posts to the action route and disables buttons while pending.
- [ ] **Step 4: Brand switcher** — `BrandSwitcher.tsx` select; on change calls server action `setBrandCookie(id)` (writes `pp_brand` cookie) and `router.refresh()`. Only rendered in agency mode. Add "Add brand" button in agency mode that inserts a brand row + preference summary row via a server action.
- [ ] **Step 5: Manual check** — with the drafts from Task 9 the inbox shows 4 cards under one campaign, previews differ per platform, a new insert appears without refresh. **Commit** `feat(inbox): live review inbox with platform previews and actions`.

---

### Task 11: Feedback events, preference memory, action route, regeneration

**Files:**
- Create: `web/src/lib/drafts/state.ts`, `web/src/lib/preferences/context.ts`, `web/src/lib/preferences/summary.ts`, `web/src/app/api/drafts/[id]/action/route.ts`
- Test: `web/tests/drafts/state.test.ts`, `web/tests/preferences/context.test.ts`, `web/tests/preferences/summary.test.ts`

**Interfaces:**
- Produces:
  - `canTransition(from: DraftStatus, to: DraftStatus): boolean`
  - `diffEdits(before: Editable, after: Editable): EditDiff` where `Editable = { hook, caption, hashtags: string[], firstComment: string|null, altText: string|null }` and `EditDiff = Partial<Record<keyof Editable, { from: unknown; to: unknown }>>`
  - `buildFeedbackContext(args: { events: FeedbackEventRow[]; positives: string[]; negatives: string[]; note?: string; bare: boolean }): FeedbackContext` (last 20 events; `hardInstruction = note`; `requireChanges = bare`)
  - `summariseFeedback(events: FeedbackEventRow[], previous: string, ai: { generateText(prompt: string): Promise<string> }): Promise<string>` and `shouldResummarise(eventCount: number): boolean` (every 10)
  - `type FeedbackEventRow = { action: "approve"|"edit"|"reject"|"regenerate"; note: string|null; edit_diff: EditDiff|null; snapshot: { hook: string; caption: string }; created_at: string }`

- [ ] **Step 1: Tests**

`web/tests/drafts/state.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { canTransition } from "@/lib/drafts/state";
describe("canTransition", () => {
  it.each([["draft","approved",true],["draft","rejected",true],["approved","scheduled",true],["scheduled","published",true],["scheduled","failed",true],["failed","scheduled",true],["draft","published",false],["published","draft",false],["rejected","approved",false]] as const)("%s → %s = %s", (a, b, ok) => expect(canTransition(a, b)).toBe(ok));
});
```
`web/tests/preferences/context.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildFeedbackContext, diffEdits } from "@/lib/preferences/context";
const ev = (action: "approve"|"edit"|"reject"|"regenerate", i: number) => ({ action, note: action === "reject" ? `too long ${i}` : null, edit_diff: null, snapshot: { hook: `h${i}`, caption: `c${i}` }, created_at: new Date(2026, 0, i + 1).toISOString() });
describe("buildFeedbackContext", () => {
  it("keeps only the last 20 events, newest first, and sets flags", () => {
    const events = Array.from({ length: 30 }, (_, i) => ev(i % 2 ? "reject" : "approve", i));
    const ctx = buildFeedbackContext({ events, positives: ["p"], negatives: ["n"], bare: true });
    expect(ctx.recentEvents).toHaveLength(20);
    expect(ctx.recentEvents[0].note).toBe("too long 29");
    expect(ctx.requireChanges).toBe(true);
    expect(ctx.hardInstruction).toBeUndefined();
  });
  it("turns a note into a hard instruction and disables inferred changes", () => {
    const ctx = buildFeedbackContext({ events: [], positives: [], negatives: [], note: "mention free shipping", bare: false });
    expect(ctx.hardInstruction).toBe("mention free shipping");
    expect(ctx.requireChanges).toBe(false);
  });
});
describe("diffEdits", () => {
  it("records only changed fields", () => {
    const d = diffEdits({ hook: "a", caption: "b", hashtags: ["#x"], firstComment: null, altText: null }, { hook: "a", caption: "B!", hashtags: ["#x", "#y"], firstComment: null, altText: null });
    expect(Object.keys(d)).toEqual(["caption", "hashtags"]);
    expect(d.caption).toEqual({ from: "b", to: "B!" });
  });
});
```
`web/tests/preferences/summary.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { shouldResummarise, summariseFeedback } from "@/lib/preferences/summary";
describe("preference summary", () => {
  it("resummarises every 10 events", () => {
    expect(shouldResummarise(10)).toBe(true); expect(shouldResummarise(20)).toBe(true); expect(shouldResummarise(13)).toBe(false); expect(shouldResummarise(0)).toBe(false);
  });
  it("feeds previous summary and events to the model and returns its text", async () => {
    let seen = "";
    const ai = { generateText: async (p: string) => { seen = p; return "Prefers short hooks."; } };
    const out = await summariseFeedback([{ action: "reject", note: "too salesy", edit_diff: null, snapshot: { hook: "BUY", caption: "now" }, created_at: "2026-01-01" }], "Old summary.", ai);
    expect(out).toBe("Prefers short hooks.");
    expect(seen).toContain("Old summary."); expect(seen).toContain("too salesy");
  });
});
```

- [ ] **Step 2: Implement**

`web/src/lib/drafts/state.ts`:
```ts
export type DraftStatus = "draft"|"approved"|"rejected"|"scheduled"|"published"|"failed";
const ALLOWED: Record<DraftStatus, DraftStatus[]> = { draft: ["approved","rejected"], approved: ["scheduled"], rejected: [], scheduled: ["published","failed"], published: [], failed: ["scheduled"] };
export const canTransition = (from: DraftStatus, to: DraftStatus) => ALLOWED[from].includes(to);
```
`web/src/lib/preferences/context.ts`:
```ts
import type { FeedbackContext } from "@/lib/generation/prompt";
export type Editable = { hook: string; caption: string; hashtags: string[]; firstComment: string | null; altText: string | null };
export type EditDiff = Partial<Record<keyof Editable, { from: unknown; to: unknown }>>;
export type FeedbackEventRow = { action: "approve"|"edit"|"reject"|"regenerate"; note: string | null; edit_diff: EditDiff | null; snapshot: { hook: string; caption: string }; created_at: string };
export function diffEdits(before: Editable, after: Editable): EditDiff {
  const out: EditDiff = {};
  for (const k of Object.keys(before) as (keyof Editable)[]) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) out[k] = { from: before[k], to: after[k] };
  }
  return out;
}
export function buildFeedbackContext(a: { events: FeedbackEventRow[]; positives: string[]; negatives: string[]; note?: string; bare: boolean }): FeedbackContext {
  const recent = [...a.events].sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, 20)
    .map((e) => ({ action: e.action, note: e.note ?? undefined, editDiff: e.edit_diff ?? undefined }));
  const note = a.note?.trim();
  return { recentEvents: recent, positiveExamples: a.positives, negativeExamples: a.negatives, hardInstruction: note || undefined, requireChanges: a.bare && !note };
}
```
`web/src/lib/preferences/summary.ts`:
```ts
import type { FeedbackEventRow } from "./context";
export const shouldResummarise = (n: number) => n > 0 && n % 10 === 0;
export async function summariseFeedback(events: FeedbackEventRow[], previous: string, ai: { generateText: (p: string) => Promise<string> }): Promise<string> {
  const lines = events.map((e) => `${e.action}${e.note ? ` ("${e.note}")` : ""}${e.edit_diff ? ` edits=${JSON.stringify(e.edit_diff)}` : ""}: "${e.snapshot.hook}" / "${e.snapshot.caption.slice(0, 120)}"`).join("\n");
  const prompt = `You maintain a short profile of what a brand owner likes and dislikes in social posts.\n\nPrevious profile:\n${previous || "(none)"}\n\nNew feedback events (newest last):\n${lines}\n\nRewrite the profile as one paragraph (max 120 words) of concrete, actionable preferences: hooks, length, emojis, tone, formats, topics, CTAs. Keep still-valid points from the previous profile. Output only the paragraph.`;
  return (await ai.generateText(prompt)).trim();
}
```
Add to `web/src/lib/ai/gemini.ts`:
```ts
export async function generateText(prompt: string): Promise<string> {
  const res = await ai().models.generateContent({ model: TEXT_MODEL, contents: prompt });
  return res.text ?? "";
}
```

- [ ] **Step 3: Action route**

`web/src/app/api/drafts/[id]/action/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canTransition } from "@/lib/drafts/state";
import { buildFeedbackContext, diffEdits, type Editable } from "@/lib/preferences/context";
import { shouldResummarise, summariseFeedback } from "@/lib/preferences/summary";
import { buildGenerationPrompts } from "@/lib/generation/prompt";
import { draftOutputSchema, RESPONSE_JSON_SCHEMA } from "@/lib/generation/schema";
import { resolveSettings } from "@/lib/campaigns/settings";
import * as gemini from "@/lib/ai/gemini";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { admin, brand } = await getSession();
  const { id } = await params;
  const body = await req.json() as { action: "approve"|"edit"|"reject"|"regenerate"; note?: string; edits?: Editable };
  const { data: d } = await admin.from("drafts").select("*").eq("id", id).eq("brand_id", brand.id).single();
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });
  const before: Editable = { hook: d.hook, caption: d.caption, hashtags: d.hashtags, firstComment: d.first_comment, altText: d.alt_text };
  const snapshot = { hook: d.hook, caption: d.caption };
  const embedding = await gemini.embed(`${d.hook}\n${d.caption}`).catch(() => null);

  if (body.action === "edit" && body.edits) {
    const diff = diffEdits(before, body.edits);
    await admin.from("drafts").update({ hook: body.edits.hook, caption: body.edits.caption, hashtags: body.edits.hashtags, first_comment: body.edits.firstComment, alt_text: body.edits.altText }).eq("id", id);
    await admin.from("feedback_events").insert({ workspace_id: d.workspace_id, brand_id: d.brand_id, draft_id: id, action: "edit", edit_diff: diff, snapshot, embedding });
  }
  if (body.action === "approve" || body.action === "reject") {
    const to = body.action === "approve" ? "approved" : "rejected";
    if (!canTransition(d.status, to)) return NextResponse.json({ error: `cannot ${body.action} a ${d.status} draft` }, { status: 409 });
    await admin.from("drafts").update({ status: to }).eq("id", id);
    await admin.from("feedback_events").insert({ workspace_id: d.workspace_id, brand_id: d.brand_id, draft_id: id, action: body.action, note: body.note ?? null, snapshot, embedding });
  }
  if (body.action === "regenerate" || body.action === "reject") {
    if (body.action === "regenerate") {
      await admin.from("drafts").update({ status: "rejected" }).eq("id", id);
      await admin.from("feedback_events").insert({ workspace_id: d.workspace_id, brand_id: d.brand_id, draft_id: id, action: "regenerate", snapshot, embedding });
    }
    // gather context
    const { data: events } = await admin.from("feedback_events").select("action, note, edit_diff, snapshot, created_at").eq("brand_id", d.brand_id).order("created_at", { ascending: false }).limit(20);
    const nearest = async (action: string) => embedding
      ? (await admin.rpc("nearest_feedback", { p_brand: d.brand_id, p_action: action, p_embedding: embedding, p_limit: 3 })).data?.map((r: { snapshot: { caption: string } }) => r.snapshot.caption) ?? []
      : [];
    const ctx = buildFeedbackContext({ events: events ?? [], positives: await nearest("approve"), negatives: await nearest("reject"), note: body.note, bare: body.action === "regenerate" });
    const { data: c } = await admin.from("campaigns").select("*").eq("id", d.campaign_id).single();
    const { data: ps } = await admin.from("preference_summaries").select("summary").eq("brand_id", d.brand_id).maybeSingle();
    const [bundle] = buildGenerationPrompts({ brand: { name: brand.name, voiceProfile: brand.voice_profile }, settings: resolveSettings({}, c.settings), prompt: c.prompt, references: [], preferenceSummary: ps?.summary || null, feedback: ctx, platforms: [d.platform], candidatesPerSlot: 1 });
    const out = await gemini.generateJson(bundle.system, bundle.user, RESPONSE_JSON_SCHEMA, (raw) => draftOutputSchema.parse(raw));
    const newEmbedding = await gemini.embed(`${out.hook}\n${out.caption}`).catch(() => null);
    await admin.from("drafts").insert({ workspace_id: d.workspace_id, campaign_id: d.campaign_id, brand_id: d.brand_id, platform: d.platform, candidate_index: d.candidate_index, version: d.version + 1, parent_draft_id: d.id, hook: out.hook, caption: out.caption, hashtags: out.hashtags, first_comment: out.firstComment, alt_text: out.altText, media_plan: out.mediaPlan, change_notes: out.changeNotes, embedding: newEmbedding });
  }
  // preference summary maintenance
  const { count } = await admin.from("feedback_events").select("id", { count: "exact", head: true }).eq("brand_id", d.brand_id);
  if (shouldResummarise(count ?? 0)) {
    const { data: last } = await admin.from("feedback_events").select("action, note, edit_diff, snapshot, created_at").eq("brand_id", d.brand_id).order("created_at", { ascending: true }).limit(10);
    const { data: ps } = await admin.from("preference_summaries").select("summary").eq("brand_id", d.brand_id).maybeSingle();
    const summary = await summariseFeedback(last ?? [], ps?.summary ?? "", gemini);
    await admin.from("preference_summaries").upsert({ brand_id: d.brand_id, workspace_id: d.workspace_id, summary, event_count: count ?? 0, updated_at: new Date().toISOString() });
  }
  return NextResponse.json({ ok: true });
}
```
Add migration `supabase/migrations/0002_nearest_feedback.sql`:
```sql
create or replace function nearest_feedback(p_brand uuid, p_action feedback_action, p_embedding vector(768), p_limit int)
returns table (snapshot jsonb, distance float) language sql stable as $$
  select snapshot, embedding <=> p_embedding as distance from feedback_events
  where brand_id = p_brand and action = p_action and embedding is not null
  order by embedding <=> p_embedding limit p_limit;
$$;
```
Apply with `npx supabase db push`. (Regeneration runs inline here rather than through n8n because it is one Gemini call and the user is waiting on the card; the Vercel hobby limit is 60 s per request, which is sufficient.)

- [ ] **Step 4: Tests pass; manual E2E** — reject a draft with note "mention free shipping" → v2 appears containing that; regenerate another with no note → v2 shows a "What changed" list with ≥2 items; after 10 actions `preference_summaries.summary` is non-empty. **Commit** `feat(feedback): preference memory, feedback-driven and inferred regeneration`.

---

### Task 12: Login-free approval links (email via n8n, Telegram optional)

**Files:**
- Create: `web/src/lib/approvals/token.ts`, `web/src/app/api/approvals/route.ts`, `web/src/app/api/approvals/[token]/route.ts`, `web/src/app/approve/[token]/page.tsx`, `n8n/workflows/postpilot-notify.json`
- Test: `web/tests/approvals/token.test.ts`

**Interfaces:**
- Produces: `issueApprovalToken({ draftId, draftVersion, channel, secret, now, ttlHours = 72 }) → { token, tokenHash, expiresAt }`; `verifyApprovalToken(token, secret, now) → { draftId, draftVersion } | null`; `hashToken(token) → sha256 hex`.
- Route contracts: `POST /api/approvals` (session) body `{ draftId, channel: "email"|"telegram", to }` → issues token, inserts `approval_tokens`, triggers n8n `/webhook/postpilot-notify` with `{ to, channel, link, preview }`. `POST /api/approvals/:token` (public) body `{ decision: "approve"|"reject", note? }` → verifies signature and expiry, checks `used_at is null` and `draft.version === draftVersion`, applies the same transition as Task 11 (approve → approved; reject → rejected + regeneration), marks `used_at`.

- [ ] **Step 1: Test**

`web/tests/approvals/token.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { issueApprovalToken, verifyApprovalToken } from "@/lib/approvals/token";
const now = new Date("2026-09-17T00:00:00Z");
describe("approval tokens", () => {
  it("round-trips and expires after 72h", () => {
    const t = issueApprovalToken({ draftId: "d1", draftVersion: 2, channel: "email", secret: "k", now });
    expect(verifyApprovalToken(t.token, "k", now)).toEqual({ draftId: "d1", draftVersion: 2 });
    expect(verifyApprovalToken(t.token, "k", new Date(now.getTime() + 73 * 3600e3))).toBeNull();
    expect(t.expiresAt.toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });
  it("rejects tampering and wrong secrets", () => {
    const t = issueApprovalToken({ draftId: "d1", draftVersion: 1, channel: "email", secret: "k", now });
    expect(verifyApprovalToken(t.token, "other", now)).toBeNull();
    expect(verifyApprovalToken(t.token.replace("d1", "d2"), "k", now)).toBeNull();
  });
});
```

- [ ] **Step 2: Implement**

`web/src/lib/approvals/token.ts`:
```ts
import { createHmac, createHash } from "node:crypto";
const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export function issueApprovalToken(a: { draftId: string; draftVersion: number; channel: string; secret: string; now?: Date; ttlHours?: number }) {
  const now = a.now ?? new Date(); const exp = new Date(now.getTime() + (a.ttlHours ?? 72) * 3600e3);
  const payload = b64(JSON.stringify({ d: a.draftId, v: a.draftVersion, c: a.channel, e: exp.getTime() }));
  const token = `${payload}.${sign(payload, a.secret)}`;
  return { token, tokenHash: hashToken(token), expiresAt: exp };
}
export function verifyApprovalToken(token: string, secret: string, now = new Date()): { draftId: string; draftVersion: number } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig || sign(payload, secret) !== sig) return null;
  const p = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (typeof p.e !== "number" || p.e < now.getTime()) return null;
  return { draftId: p.d, draftVersion: p.v };
}
```
Routes as per the contract above; the public route reuses the transition logic by extracting the approve/reject branch of Task 11 into `web/src/lib/drafts/actions.ts` (`applyDecision(admin, draft, decision, note, brand)`) and importing it from both routes. Approval page `approve/[token]/page.tsx`: server component that verifies the token, loads the draft, renders `<PlatformPreview>` read-only plus two buttons (client form) posting to the public route; shows "This link has expired or was already used" when invalid.

- [ ] **Step 3: n8n notify workflow** — Webhook `postpilot-notify` (secret check as in Task 9) → Switch on `channel` → Gmail node "Send" (credential already exists from ExpenseFlow; re-authorise if expired) with subject `Approve this ${platform} post for ${brand}` and an HTML body containing the preview text and a button to `link`; Telegram branch → Telegram node "Send message" (create bot via BotFather, chat id from the user's message) with the same content. Export → `n8n/workflows/postpilot-notify.json`, scrubbed.

- [ ] **Step 4: Tests pass; E2E** — send an approval email for a draft to the integration inbox, click Approve on the phone, the inbox card flips to approved without login. Reusing the link shows the "already used" message. **Commit** `feat(approvals): login-free approval links via email and Telegram`.

---

### Task 13: README, landing page, Vercel deploy, GitHub push

**Files:**
- Create: `README.md`, `web/src/app/page.tsx` (landing), `web/src/app/opengraph-image.tsx` optional
- Modify: `web/.env.example` if any var was added

- [ ] **Step 1: Landing page** — `web/src/app/page.tsx`: hero ("Give it an idea, a photo, or a video. It writes and renders platform-native posts and Shorts, learns your taste from every approval, publishes on your schedule, and tells you what actually worked."), three feature cards (Generate, Review & learn, Publish & measure), platform logo row (text badges), "Try the demo" → `/login`. No personal names.
- [ ] **Step 2: README** — delegate the first draft to `doc-writer` with the spec and this plan as input, then fact-check every command and env var yourself. Sections: What it does · Demo (URL placeholder until deployed) · How it works (diagram in mermaid: app ↔ Supabase ↔ n8n ↔ Gemini) · Features (with "native" vs "via Late" table) · Local setup · Environment variables · n8n workflows · Roadmap (Plans 2–4) · License. Product voice, no personal names.
- [ ] **Step 3: GitHub** — after the user creates the repo: `git remote add origin https://github.com/Muhammad-Athar/postpilot.git && git push -u origin main`. Confirm `git log --format=%an` shows only "Muhammad Athar".
- [ ] **Step 4: Vercel** — `cd web && npx vercel link` (root directory `web`), add env vars from `.env.local` via `npx vercel env add`, `npx vercel --prod`. Set `APP_BASE_URL` in n8n to the production URL. Re-run the Task 9 E2E against production.
- [ ] **Step 5: Commit** `docs: README and landing page` and push.

---

## Self-review

**Spec coverage (Plan 1 scope: §2 modes/brand kit/campaign/inbox/approval links, §3 app + n8n generate, §4 schema, §5 generation + feedback loop, §8 partial, §9 unit tests):**
- Modes + brand switcher → Tasks 3, 10. Brand kit + voice profile → Task 5. Campaign settings and references → Tasks 4, 6, 8. Candidates per slot with distinct angles → Task 7. Inbox with previews, edit in place, reject with note, bare regenerate with visible changes → Tasks 10, 11. Preference memory (events, embeddings, nearest examples, summary every 10) → Task 11 + migration 0002. Approval links (email/Telegram, 72 h, single-use, version-bound) → Task 12. n8n error branch → Task 9. Secret-guarded routes → Task 8. Realtime → Task 10. Storage bucket → Task 2.
- Deferred to later plans by design: render_jobs (Plan 2), schedule_slots/publish_jobs/adapters/Late (Plan 3), metric_snapshots/insights/safety pass/quota_usage checks (Plan 4). Tables exist now so no migration churn later.

**Placeholder scan:** none of "TBD/TODO/similar to". Every code step has code. UI tasks (3, 5, 6, 10, 12) describe components in prose with exact props and behaviours rather than full JSX; that is intentional to keep the plan readable, and each has a manual check step.

**Type consistency:** `FeedbackContext` defined once in `generation/prompt.ts`, imported by `preferences/context.ts`. `Editable` fields match `drafts` columns (`first_comment`/`alt_text` mapped explicitly). `Reference` from `campaigns/create.ts` used by `references.ts`. `PromptBundle` shape consumed by the n8n Split Out (`platform, candidateIndex, system, user`). `draftOutputSchema` used by both the n8n ingest route and inline regeneration.
