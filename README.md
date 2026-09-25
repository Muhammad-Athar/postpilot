# Postpilot

Postpilot turns a one-line brief into platform-ready social posts, learns from every approve, edit and reject, and publishes what you sign off on. It is built for small brands and the agencies that run their social accounts: one workspace, one or many brands, a review inbox, a calendar, and analytics that feed the next brief.

## How it works

1. **Brief.** Describe the campaign, drop in reference images or links, pick platforms and how many candidates you want.
2. **Generate.** n8n hands the brief to the app, which calls Gemini per platform and candidate with the brand kit, platform rules and the brand's preference memory. A model fallback chain and retries absorb rate limits.
3. **Review.** Drafts land in the inbox in about thirty seconds. Approve, edit, reject with a note, or regenerate. A bare regenerate lists what it changed. Every decision becomes a feedback event; every ten events the preference summary is rewritten and used in the next generation.
4. **Approve from anywhere.** Share a login-free approval link (single use, 72 hours, bound to that version of the post). Clients approve or request changes with a note; the revision shows up in the inbox.
5. **Schedule.** Approved posts take the next open slot from the workspace cadence, or the day you chose. Move, unschedule or publish now from the calendar.
6. **Publish.** Every five minutes the app publishes due posts through the platform adapters, after a pre-publish check for banned words and unverifiable claims. Transient errors retry with backoff; dead credentials flip the account to "reconnect" and the post to "failed" with the reason.
7. **Measure.** Every six hours account and post metrics are pulled into snapshots. Analytics shows followers, likes, reposts, replies, a per-platform table and the top post.

## Platforms

| Platform | Adapter | Publish | Metrics | Notes |
|---|---|---|---|---|
| Bluesky | Native (AT Protocol) | ✓ text + up to 4 images | ✓ likes, reposts, replies, followers | App password, entered on the Connections page |
| Mastodon | Native | ✓ text + up to 4 images | ✓ | Instance URL + access token |
| X, TikTok, YouTube Shorts, LinkedIn, Threads, Pinterest | Zernio (formerly Late) | ✓ via the aggregator | best effort | Link the account inside Zernio first, then one click here. Free tier: 2 accounts |
| Instagram, Facebook | Native (Meta Graph API) | pending | pending | Waiting on Meta app review |

Video and generated images arrive with the render pipeline (Plan 3). Today's posts are text and stored images.

## Architecture

```
Browser ──► Next.js on Vercel (UI + API routes)
               │  Supabase (Postgres + Auth + Storage + pgvector + Realtime)
               │
   n8n on a 1 GB Oracle VM ── clocks and long jobs ──► app API routes (shared secret)
     · generate   webhook   → /api/campaigns/:id/generate-one  (Gemini, fallback chain)
     · publish    every 5m  → /api/publish/run                 (claim slots → safety → adapters)
     · analytics  every 6h  → /api/analytics/sync              (metric snapshots)
     · notify     webhook   → SMTP                             (approval-link emails, optional)
               │
   Adapters: lib/publishers/{bluesky,mastodon,zernio}.ts behind one Publisher interface
```

The app never keeps platform tokens in the clear: connection credentials are sealed with AES-256-GCM under `APP_SECRET`. Every request to a user-supplied host (Mastodon instances, media URLs) goes through an SSRF guard that resolves DNS first and refuses private ranges and redirects. Every table is keyed by workspace; a request can only reach the rows of the workspace it is signed into.

## Running locally

```bash
git clone <this repo> && cd postpilot/web
cp .env.example .env.local        # fill in the values below
npm install
npx supabase link --project-ref <your project ref>
npx supabase db push              # applies supabase/migrations
npm run dev                       # http://localhost:3000
```

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API |
| `APP_SECRET` | 32+ random characters; shared with n8n as the `x-postpilot-secret` header |
| `APP_BASE_URL` | `http://localhost:3000` locally, your Vercel URL in production |
| `N8N_BASE_URL`, `N8N_GENERATE_WEBHOOK_PATH`, `N8N_NOTIFY_WEBHOOK_PATH` | your n8n instance and the webhook paths in `n8n/workflows` |
| `GEMINI_API_KEY` | Google AI Studio (free tier) |
| `ZERNIO_API_KEY` | zernio.com → API keys (formerly Late; `LATE_API_KEY` is also read) |
| `PEXELS_API_KEY`, `PIXABAY_API_KEY` | stock media for the render pipeline (Plan 3) |
| `SMTP_USER`, `SMTP_PASS` | optional: a Gmail address and app password for approval-link emails |

Deploy the n8n workflows with `APP_BASE_URL=https://your-app n8n/deploy.sh` (see `n8n/README.md`). Run the tests with `npm test`; type-check with `npx tsc --noEmit`.

## Security notes

- Connection credentials sealed with AES-256-GCM (`lib/publishers/credentials.ts`), key derived from `APP_SECRET`; only the ciphertext is stored.
- Approval links are HMAC-signed, single use, expire after 72 hours and are bound to the draft version; only the token hash is stored.
- SSRF guard on every user-supplied URL (`lib/net/safe-fetch.ts`): DNS resolved first, private and reserved ranges refused, redirects re-checked, response size capped.
- n8n callbacks and clocks authenticate with a constant-time secret comparison; committed workflow JSON contains no secrets.
- Draft state transitions are enforced by a database trigger, so a stale request can never move a post backwards.

## Roadmap

- **Plan 3** — render pipeline: TTS, word-timed subtitles, stock and user media, ffmpeg composition, thumbnail pick.
- **Plan 4** — closed-loop insights: plain-language read on what worked, fed into the next brief.
- Meta (Instagram, Facebook) once app review completes.
