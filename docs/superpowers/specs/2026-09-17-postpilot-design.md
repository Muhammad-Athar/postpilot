# Postpilot — Design Spec

Date: 2026-09-17 · Status: approved in brainstorm, pending written review
Purpose: Upwork portfolio project. AI generates platform-native posts and short videos from a prompt or reference media, the user reviews and approves, the system publishes on a schedule and reports analytics. Ships as a complete base product configurable for a single brand or an agency.

Related: market research and gap analysis in `~/Desktop/Upwork/docs/2026-09-17-social-automation-market-research.md`.

## 1. Goals and non-goals

Goals
- Idea/reference in → 2–3 candidate posts per platform out, including rendered 9:16 short videos.
- Review loop: approve, edit in place, reject with a note, or bare regenerate. Bare regenerate makes inferred, visible changes driven by stored preferences. Loop until approved.
- Publish approved items on the workspace cadence across configured platforms.
- Per-platform analytics dashboard with AI "what worked" insights that feed back into generation.
- One codebase serves both single-brand and agency use via a `mode` setting.
- Free tiers only. No personal names anywhere in UI, README, or assets.

Non-goals for v1
- Comment/DM auto-replies, lead capture to CRM, evergreen recycling, multilingual variants, team roles beyond owner and client-approver, Web3/decentralised platforms beyond Bluesky and Mastodon.

## 2. Product surface

### Modes
`workspaces.mode ∈ {single, agency}`.
- single: one brand, no brand switcher, owner approves in-app (approval links still available).
- agency: brand switcher in sidebar, per-brand kit and connected accounts, client approval links without login.
All rows carry `workspace_id`; switching mode is a setting, not a migration.

### Brand kit
Logo, colour palette, fonts, tone descriptors, language, 5–10 sample posts, banned words, default CTA, default hashtag sets. Produces a `voice_profile` text block used in every prompt.

### Campaign request
Free-text prompt plus optional references: images, one video file, URLs.
Settings, resolved as workspace defaults merged with per-request overrides:
posts_count, videos_count, platforms[], tone, language, cta, hashtag_count, video_length (15|30|60), voice, allow_ai_broll (bool), candidates_per_slot (2|3).

### Outputs
Per platform variant per candidate: hook, caption, hashtags, first_comment, alt_text, media_plan.
media_plan ∈ use_reference_image(n) | generate_image(prompt) | carousel(slides[]) | video(script scenes[]).
Platform rules table defines caption limits, hashtag norms, aspect ratios, hook style per platform.

### Review inbox
Cards grouped by campaign, platform-accurate previews. Actions: approve, edit (inline), reject with note, regenerate (no note). Regenerated drafts show a "What changed" list. Realtime updates as n8n inserts drafts.

### Scheduling
Cadence per workspace: daily | weekdays | weekly | custom cron-like rule. Posting windows per platform with timezone. Calendar (week/month) with drag-to-reschedule. Queue pulls next approved draft into the next free slot for its platform.

### Approval links
Signed, single-use, 72-hour tokens bound to a draft version. Channels: email (Gmail via n8n, reuse ExpenseFlow Send-and-Wait pattern) and Telegram bot; WhatsApp via Twilio sandbox optional. Link page shows preview and approve / reject-with-note.

### Analytics
Per-platform tiles: followers, reach, views, likes, comments, shares, saves. Cross-platform timeline. Top posts table. "What worked" panel: Gemini analyses top/bottom 10 posts of last 30 days by attributes (hook type, length, format, hour, hashtags) and returns 3–5 findings, each with a "Generate more like this" button that pre-fills a campaign.

### Platforms (v1)
Native adapters: Bluesky (AT Protocol), Mastodon, Meta (Instagram + Facebook Pages via Graph API test app).
Via self-hosted Postiz adapter: TikTok, YouTube Shorts, LinkedIn, X, Threads, Pinterest.
UI lists all; README states which are native. File Meta, TikTok, YouTube app reviews on day 1.

## 3. Architecture

Deployables
1. Web app — Next.js 15 (App Router, TypeScript, Tailwind, shadcn/ui) on Vercel. All UI plus API routes that n8n calls back with a shared secret.
2. Supabase (free) — Postgres, Auth (magic link), Storage (public bucket for uploads and renders; satisfies Instagram public-URL requirement), pgvector, Realtime.
3. n8n on Oracle VM (existing, https://n8n.152-67-183-135.sslip.io) — workflows: `generate`, `render`, `publish`, `analytics-sync`, each webhook-triggered, each with an error branch that reports `{job_id, stage, error}` back to the app.
4. Render worker — Node service on the VM (localhost only, called by n8n): Remotion composition + ffmpeg encode. Providers: Gemini TTS / Edge-TTS (voice), Groq Whisper (word timings), Pexels + Pixabay (stock video/images/music), Kling (optional b-roll), Gemini vision (thumbnail pick).
5. Postiz — self-hosted via Docker on the VM; used through its API as one adapter.

App modules (one folder each, one responsibility)
- `brand` — kit CRUD, sample posts, voice_profile builder.
- `campaigns` — request form, settings resolution, kicks off generate.
- `drafts` — inbox, previews, edit/approve/reject/regenerate, emits feedback events.
- `preferences` — stores feedback events + embeddings, builds taste context, maintains preference_summary.
- `schedule` — cadence rules, slot allocation, calendar, queue.
- `publishers` — `Publisher` interface: `publish(post) → {externalId, url}`, `fetchMetrics(ref) → metrics`, `healthcheck()`. Implementations: bluesky, mastodon, meta, postiz.
- `analytics` — snapshots, aggregations, insight generation.
- `approvals` — token issue/verify, email and Telegram senders.

## 4. Data model (all tables have workspace_id, created_at, updated_at)

- workspaces(id, name, mode, timezone, cadence_rule, posting_windows JSON)
- brands(id, workspace_id, name, kit JSON, voice_profile TEXT, banned_words TEXT[])
- connected_accounts(id, brand_id, platform, adapter ∈ native|postiz, external_id, tokens_encrypted, status ∈ ok|reconnect|error)
- campaigns(id, brand_id, prompt, references JSON, settings JSON, status ∈ queued|generating|review|done|failed)
- drafts(id, campaign_id, brand_id, platform, candidate_index, version, parent_draft_id, hook, caption, hashtags TEXT[], first_comment, alt_text, media_plan JSON, media_urls TEXT[], change_notes TEXT[], status ∈ draft|approved|rejected|scheduled|published|failed, embedding VECTOR(768))
- feedback_events(id, brand_id, draft_id, action ∈ approve|edit|reject|regenerate, note, edit_diff JSON, embedding VECTOR(768))
- preference_summaries(brand_id PK, summary TEXT, event_count INT, updated_at)
- render_jobs(id, draft_id, spec JSON, status, output_url, thumbnail_url, error, attempts)
- schedule_slots(id, brand_id, platform, scheduled_at, draft_id NULL, status ∈ open|filled|done)
- publish_jobs(id, draft_id, account_id, attempts, external_id, permalink, error, status)
- metric_snapshots(id, account_id, draft_id NULL, captured_at, metrics JSON)
- approval_tokens(id, draft_id, draft_version, channel, token_hash, expires_at, used_at)
- quota_usage(provider, day, units_used, units_limit)

State machine on drafts enforced by a CHECK + trigger: draft→approved|rejected; approved→scheduled; scheduled→published|failed; rejected→(new draft version). Publish requires status=scheduled and an unexpired account.

## 5. Generation and feedback loop

Generation (n8n `generate`):
1. Load brand kit, voice_profile, platform rules, resolved settings, preference_summary.
2. References: images/video frames as Gemini vision input; URLs fetched and summarised.
3. For each platform × candidate: one Gemini call with structured JSON output (schema above). Groq Llama fallback on rate limit.
4. Insert drafts; Realtime pushes to inbox.

Feedback events → prompt context:
- approve: positive example (embedding stored).
- edit: diff stored as "this, not that" pair.
- reject + note: negative example; note included verbatim as a hard instruction on regeneration.
- regenerate (no note): prompt includes last 20 events, nearest 3 positive and 3 negative examples by cosine similarity, and an instruction to change at least two of {hook, angle, format, length, CTA} and to list what changed. The list is stored in `change_notes` and shown under the draft.
- Every 10 events per brand: Gemini rewrites `preference_summaries.summary` (one paragraph). Used in every subsequent generation.

## 6. Video pipeline (n8n `render` → render worker)

Script scenes → TTS per scene → Whisper word timings → per scene media: user media if provided, else stock by scene keywords, else Kling clip if allow_ai_broll and quota remains → Remotion composition 1080×1920: platform safe zones, word-highlight subtitles, brand colours/logo, music ducked under voice → ffmpeg H.264/AAC → upload to Storage → Gemini vision picks thumbnail frame → render_jobs updated → draft media_urls set. Target < 60 s per render; inbox shows progress.

## 7. Publishing and analytics

`publish` (n8n cron every 5 min): claim due schedule_slots → adapter.publish → 3 retries with backoff on transient errors → on success store external_id + permalink, status=published → on final failure status=failed with reason, email notification. Token expiry → account status=reconnect, badge in UI, never silent.

`analytics-sync` (every 6 h): for each account, adapter.fetchMetrics for account and last-30-day posts → metric_snapshots. Dashboard reads aggregated views. Insights generated on demand and cached 24 h.

## 8. Error handling and safety

- Provider wrappers with retry and fallback: text Gemini→Groq; image Gemini→Pollinations; video b-roll Kling→stock-only.
- quota_usage checked before renders; UI warns instead of failing mid-job.
- n8n error branches report to `/api/jobs/:id/fail`; UI shows reason and retry button.
- Approval tokens single-use, 72 h, bound to draft_version.
- Pre-publish safety pass: Gemini checks for unverifiable factual claims, banned words, platform policy issues; flags block auto-publish and return the draft to review with reasons.
- Secrets only in Vercel env and n8n credentials; committed workflow JSON scrubbed.

## 9. Testing

- Unit: settings resolution, slot allocation, state transitions, feedback→prompt builder (fixtures).
- Adapter contract tests on recorded responses; one live smoke test per native adapter on test accounts.
- Fixture campaign "launch of a coffee subscription" for all manual runs.
- E2E before recording: request → 3 candidates → reject with note → bare regenerate → approve → render → publish to Bluesky + Mastodon → metrics visible after one sync.

## 10. Ship package and timeline

Package: Vercel live URL · public GitHub repo under Muhammad-Athar (MIT, product-style README) · 6–9 captioned screenshots · 60–90 s voice-over video + .srt · one metric line · BD PDF · in-app landing page. No personal names.

Timeline (10–12 working days): D1–2 schema, brand kit, campaign form, n8n generate · D3–4 inbox, feedback loop, preference memory · D5–7 render worker + video pipeline · D8–9 adapters, Postiz, scheduling, publish · D10 analytics + insights · D11–12 polish, tests, assets. App reviews (Meta, TikTok, YouTube) filed D1.
