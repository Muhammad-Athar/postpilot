# Postpilot Plan 1b — UX polish, account, calendar, connections

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the working Plan 1 build into something that looks and behaves like a finished product: full-width app layout with a top bar and account menu, tooltips and smoother motion on the landing page, onboarding after sign-up, a bento-style brand kit, a real month calendar with a day panel and scheduling flow, an honest "no accounts connected" analytics state with a Connections page, tabbed settings with profile, password and brand-name changes.

**Architecture:** No new services. Profile data lives in Supabase Auth user metadata (`display_name`, `avatar_url`) with avatars in the existing `media` bucket. Scheduling writes to the existing `schedule_slots` table (Plan 3 will consume it for publishing). Connections page reads `connected_accounts` and shows platform cards; real OAuth connect buttons arrive with Plan 3, so for now each card deep-links to the adapter's setup and shows "Connect" as disabled with a tooltip, except Bluesky and Mastodon which accept app-password / token entry (native adapters, no app review).

**Tech Stack:** Same as Plan 1. Adds `@radix-ui/react-tooltip`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `date-fns`.

**Spec:** `docs/superpowers/specs/2026-09-17-postpilot-design.md` §2 (product surface), plus the user's review of 2026-09-26 (this plan is the spec for those items).

## Global Constraints

- Free tiers only; no personal names in UI or seed data; commits authored as Muhammad Athar, no Claude trailer.
- Keep the warm editorial system: tokens in `globals.css`, primitives in `src/components/ui`, Framer Motion for motion, `prefers-reduced-motion` respected.
- Every interactive element: pointer cursor, hover, focus-visible ring, active, disabled states. Tooltips on anything whose purpose isn't obvious from its label.
- Pages are full-width: remove `max-w-*` caps on app pages; use responsive grids instead. Gutters stay (`p-5 md:p-8`).
- `npm test`, `tsc --noEmit`, `eslint` green before every commit. Manual check in Chrome (light + dark) for every UI task.

---

## File structure (created or modified)

```
web/src/
  components/ui/
    Tooltip.tsx            Radix tooltip wrapped in our tokens (Task 1)
    DropdownMenu.tsx       Radix dropdown wrapped (Task 4)
    Dialog.tsx             Radix dialog wrapped, motion in/out (Task 4, 8, 9)
    Tabs.tsx               Radix tabs, vertical variant (Task 7)
    Avatar.tsx             initials fallback, image when avatar_url (Task 4)
    Icon.tsx               lucide-react icons at 18px/20px (Task 3)
  components/landing/
    Sections.tsx           tooltips on loop steps, smoother step cards (Task 2)
    Hero.tsx               hover-to-front with tilt tween (Task 2)
  app/(auth)/login/page.tsx   remove theme toggle; signup → /brand?onboarding=1 (Task 2, 6)
  app/(app)/layout.tsx        top bar + sidebar, full width (Task 3, 4)
  components/TopBar.tsx       breadcrumb/title, theme toggle, account menu (Task 3, 4)
  components/AccountMenu.tsx  avatar + name → menu (Task 4)
  components/AppNav.tsx       bigger icons via lucide (Task 3)
  components/BrandNameInline.tsx  sidebar brand box → rename with confirm dialog (Task 9)
  lib/auth/profile.ts         getProfile/updateProfile/changePassword server actions (Task 5)
  app/(app)/settings/page.tsx tabs: Workspace · Profile · Password · Brand (Task 7)
  app/(app)/settings/*Tab.tsx one client component per tab (Task 7)
  app/(app)/brand/page.tsx    bento layout; onboarding banner when ?onboarding=1 (Task 6)
  app/(app)/campaigns/new/…   taller brief, redesigned dropzone, full width, ?date= prefill (Task 8, 11)
  components/campaigns/Dropzone.tsx  drag-and-drop with previews (Task 8)
  app/(app)/calendar/page.tsx month grid + day panel (Task 10, 11)
  components/calendar/*       MonthGrid, DayPanel, EventPill (Task 10)
  lib/schedule/slots.ts       listMonthEvents, scheduleDraft, nextSlots (Task 10, 11) + tests
  app/api/schedule/route.ts   POST schedule approved drafts to a date (Task 11)
  app/(app)/analytics/page.tsx "no accounts connected" state (Task 12)
  app/(app)/connections/page.tsx platform cards; Bluesky/Mastodon credential entry (Task 12)
  lib/publishers/credentials.ts  encrypt/decrypt tokens with APP_SECRET (Task 12) + tests
supabase/migrations/0003_schedule_and_profiles.sql (Task 5, 10)
```

---

### Task 1: Tooltip primitive and install UI deps

**Files:** Create `web/src/components/ui/Tooltip.tsx`; modify `web/package.json`.

- [ ] Install: `npm i @radix-ui/react-tooltip @radix-ui/react-dropdown-menu @radix-ui/react-dialog @radix-ui/react-tabs date-fns lucide-react`
- [ ] `Tooltip.tsx`:
```tsx
"use client";
import * as T from "@radix-ui/react-tooltip";
import { motion } from "framer-motion";
export function TooltipProvider({ children }: { children: React.ReactNode }) { return <T.Provider delayDuration={150}>{children}</T.Provider>; }
export function Tooltip({ label, children, side = "top" }: { label: React.ReactNode; children: React.ReactElement; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={8} asChild>
          <motion.div initial={{ opacity: 0, y: 4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.18 }}
            className="z-50 max-w-[260px] rounded-xl border border-line bg-fg px-3 py-2 text-[13px] leading-snug text-bg shadow-lift">
            {label}<T.Arrow className="fill-fg" />
          </motion.div>
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
```
- [ ] Wrap the root layout children in `<TooltipProvider>`.
- [ ] Commit: `feat(ui): tooltip primitive and UI deps`.

---

### Task 2: Landing and login fixes

**Files:** `Sections.tsx`, `Hero.tsx`, `login/page.tsx`.

- [ ] **Loop diagram** (`LoopDiagram`): each pill gets `cursor-pointer`, `whileHover={{ y: -2 }}`, and a `<Tooltip>` with one sentence each:
  - Brief: "One sentence, a photo, a video or a link, plus how many posts and where."
  - Generate: "Two or three candidates per platform, each with a different angle, in your voice."
  - Review: "Approve, edit in place, reject with a note, or just ask again."
  - Learn: "Every decision is stored and shapes the next generation."
  - Publish: "Approved drafts fill your cadence on each platform."
  - Measure: "Metrics explain what worked and feed the next brief."
- [ ] **Step cards** (`HowItWorks`): replace CSS `hover:-translate-y-1` with Framer `whileHover={{ y: -6 }}` and `transition={{ type: "spring", stiffness: 260, damping: 22 }}`; reveal uses `duration: 0.7` with stagger `0.1`.
- [ ] **Hero cards**: the hovered card must rise to the front smoothly, with the un-tilt running alongside. Replace `whileHover={{ y:-6, rotate:0, zIndex:10 }}` with state-driven animation:
```tsx
const [active, setActive] = useState<number | null>(null);
// per card:
animate={{ y: active === i ? -10 : 0, rotate: active === i ? 0 : BASE_ROT[i], scale: active === i ? 1.02 : 1, zIndex: active === i ? 10 : i }}
transition={{ type: "spring", stiffness: 220, damping: 24, mass: 0.8 }}   // zIndex is discrete; put it in `style` and tween the rest
onHoverStart={() => setActive(i)} onHoverEnd={() => setActive(null)}
```
  Put `zIndex` in `style` (updated on hover) so the tween covers `y/rotate/scale` only; add `will-change-transform`.
- [ ] **Login/register**: remove `<ThemeToggle />` from the auth page (both columns). Auth pages follow the stored theme silently.
- [ ] Manual check: hover each hero card in both themes; no jump; tooltips readable on cream and charcoal. Commit `fix(landing): loop tooltips, smoother hero and step motion; drop toggle on auth`.

---

### Task 3: App shell: top bar, full width, bigger icons

**Files:** `app/(app)/layout.tsx`, `components/TopBar.tsx`, `components/AppNav.tsx`, `components/ui/Icon.tsx`, all app pages (remove `max-w-*`).

- [ ] `AppNav` icons from `lucide-react` at 20px: Inbox, PenLine, Gem, CalendarDays, BarChart3, Link2 (Connections), Settings. Nav rows `py-2.5`, label `text-[15px]`.
- [ ] Layout becomes `grid-cols-[240px_1fr]` with a sticky `TopBar` inside the main column: left = page title (from a small map on pathname) and brand chip; right = `<ThemeToggle />` then `<AccountMenu />` (Task 4). Remove the toggle and the email/sign-out row from the sidebar. Add "Connections" to nav.
- [ ] Every app page: delete `max-w-5xl/6xl/2xl/4xl` wrappers; grids use `xl:grid-cols-[…]`. Settings uses a two-column grid `md:grid-cols-[220px_1fr]` (tabs + content).
- [ ] Manual check at 1440px and 1920px: no dead space right of content. Commit `feat(shell): top bar, full-width pages, larger nav icons`.

---

### Task 4: Account menu with avatar

**Files:** `components/AccountMenu.tsx`, `components/ui/Avatar.tsx`, `components/ui/DropdownMenu.tsx`, `components/ui/Dialog.tsx`.

- [ ] `Avatar`: circle 32px; shows `avatar_url` image if present else initials from `display_name` or email on `bg-accent-soft text-accent-strong`.
- [ ] `AccountMenu`: trigger = avatar + display name (email local part when no name) + chevron. Menu items: Profile (→ `/settings?tab=profile`), Settings (→ `/settings`), Connections (→ `/connections`), divider, Theme (sub-row with the toggle), divider, Sign out (posts to `/api/auth/signout`). Menu animates in with `scale 0.96→1, opacity`. Keyboard navigable (Radix).
- [ ] Commit `feat(shell): account menu with avatar`.

---

### Task 5: Profile data, avatar upload, password change (backend)

**Files:** `lib/auth/profile.ts`, `supabase/migrations/0003_schedule_and_profiles.sql` (profile part), tests `tests/auth/profile.test.ts`.

**Interfaces:**
- `getProfile(user)` → `{ displayName: string; email: string; avatarUrl: string | null }` from `user.user_metadata`.
- Server actions: `updateProfile(formData)` (name, email, avatar file) and `changePassword(formData)` (current, next, confirm).

- [ ] Migration adds a storage policy so users can write `avatars/<user_id>/…` in bucket `media` (path prefix keyed by `auth.uid()`), alongside the existing workspace-prefixed rule.
- [ ] `updateProfile`: validate (`displayName` 2–60 chars, email format); upload avatar (≤2 MB, image/*) to `media/avatars/<uid>/avatar.<ext>` with `upsert`; call `admin.auth.admin.updateUserById(uid, { email, user_metadata: { display_name, avatar_url } })`. Email change through the admin API takes effect immediately (no confirmation mail), which is what the demo needs; document that in the README.
- [ ] `changePassword`: verify current password via `supabase.auth.signInWithPassword({ email, password: current })` on a throwaway client; on success `admin.auth.admin.updateUserById(uid, { password: next })`; reject if `next !== confirm` or length < 8. Return `{ ok }` or `{ error }`.
- [ ] Unit tests for the pure validators (`validateProfileInput`, `validatePasswordInput`) with the cases above.
- [ ] Commit `feat(account): profile and password server actions`.

---

### Task 6: Onboarding after sign-up + bento brand kit

**Files:** `login/page.tsx`, `brand/page.tsx`, `brand/BrandKitForm.tsx` (new client component).

- [ ] After `signUp` succeeds → `router.replace("/brand?onboarding=1")`. After `signIn` → `/inbox` (unchanged).
- [ ] Brand page becomes a bento grid, no single tall column: `grid-cols-12` with cards: Identity (name, tagline, description: span 7), Voice profile preview (span 5, contrast card, sticky), Audience & tone (span 4), CTA & hashtags (span 4), Colours, fonts & logo (span 4, with colour swatches rendered from the hex list and the logo preview), Sample posts (span 8), Banned words (span 4). Each card is a `Card` with stagger reveal. One Save button in a sticky bottom bar that appears when the form is dirty.
- [ ] When `?onboarding=1`: a banner at top "Welcome. Fill in your brand kit so every post sounds like you. You can skip and come back." with "Skip for now → Inbox".
- [ ] Manual check: 1440px shows every field without scrolling past one screen height (sample posts may be a taller textarea). Commit `feat(brand): bento brand kit and onboarding`.

---

### Task 7: Settings with sidebar tabs

**Files:** `settings/page.tsx`, `settings/WorkspaceTab.tsx`, `ProfileTab.tsx`, `PasswordTab.tsx`, `BrandTab.tsx`, `components/ui/Tabs.tsx`.

- [ ] Vertical tabs (Radix) on the left: Workspace · Profile · Password · Brand. Active tab read from `?tab=`; updates the URL on change (`router.replace`).
- [ ] Workspace tab = existing form. Profile tab: avatar preview with "Change photo", display name, email; Save. Password tab: current, new, confirm, Save; success toast inline. Brand tab: brand name with confirm dialog (reuses Task 9 dialog), plus "Delete brand" only in agency mode with confirm.
- [ ] Avatar in TopBar updates after save (`revalidatePath("/", "layout")`).
- [ ] Commit `feat(settings): tabbed settings with profile, password, brand`.

---

### Task 8: Campaign page: taller brief, real dropzone, full width

**Files:** `NewCampaignForm.tsx`, `components/campaigns/Dropzone.tsx`.

- [ ] Layout: `grid-cols-12`; brief card spans 8 and has `min-h-[560px]`; textarea `rows={10}` with serif text; settings aside spans 4.
- [ ] `Dropzone`: drag-and-drop area (`onDragOver/onDrop`) plus click to browse; shows thumbnails for images and a film icon with filename for video; remove buttons per file; count and total size; error for >20 MB per file. Styled: dashed `border-line-strong`, on drag-over `border-accent bg-accent-soft/30` with a subtle scale pulse.
- [ ] Reads `?date=YYYY-MM-DD` and shows a "Scheduled for {date}" chip with an inline date input (Task 11 uses it).
- [ ] Commit `feat(campaign): taller brief, dropzone with previews, full width`.

---

### Task 9: Rename brand from the sidebar with confirmation

**Files:** `components/BrandNameInline.tsx`, `app/(app)/actions.ts` (`renameBrand`).

- [ ] The sidebar brand box becomes a button with a pencil icon on hover; click opens a Dialog: input prefilled, "Rename" (accent) and "Cancel". Confirm copy: "Rename “{old}” to “{new}”? This name is used in every prompt from now on." Server action `renameBrand(brandId, name)` validates 2–60 chars and updates `brands.name` scoped by workspace; `revalidatePath("/", "layout")`.
- [ ] Commit `feat(brand): inline rename with confirmation`.

---

### Task 10: Calendar month view with day panel

**Files:** `calendar/page.tsx`, `components/calendar/MonthGrid.tsx`, `DayPanel.tsx`, `EventPill.tsx`, `lib/schedule/slots.ts`, `tests/schedule/slots.test.ts`, migration (index on `schedule_slots(brand_id, scheduled_at)`).

**Interfaces:**
- `listMonthEvents(admin, brandId, monthStart: Date, tz: string)` → `{ [yyyy-mm-dd]: CalendarEvent[] }` where `CalendarEvent = { id, kind: "scheduled" | "published" | "review" | "campaign", platform?, title, time?, draftId?, campaignId? }`. Sources: `schedule_slots` joined to drafts (scheduled/published), drafts in `draft` status grouped as one "N to review" event on their campaign's creation day, campaigns as "Campaign created" events.
- `monthMatrix(monthStart: Date, weekStartsOn = 1)` → 6×7 `Date[][]` (pure, tested).

- [ ] Page: header with month name, prev/next/today, and a "+" that goes to `/campaigns/new?date=<selected>`. Left: `MonthGrid` (7 columns, 6 rows, each cell shows day number, up to 3 `EventPill`s + "+N", today ring in accent, selected cell filled `bg-accent-soft`, days with events get a dot row like Google Calendar). Right: `DayPanel` (sticky, 340px) showing the selected date in serif, its events grouped by time with platform badges, and an empty state "Nothing scheduled. Press + to create content for this day."
- [ ] Selection: single click selects; a second click on the already-selected day navigates to `/campaigns/new?date=…`. Keyboard: arrows move selection, Enter opens.
- [ ] Default selection: today. Grid animates month changes with a horizontal slide.
- [ ] Commit `feat(calendar): month grid with day panel and events`.

---

### Task 11: Scheduling flow from campaign → calendar

**Files:** `lib/schedule/slots.ts` (`scheduleDraft`, `nextSlots`), `app/api/schedule/route.ts`, `NewCampaignForm.tsx`, `InboxLive.tsx`/`DraftCard.tsx` (approve → schedule), `campaigns` settings gain `scheduledFor?: string`.

- [ ] `nextSlots(cadenceRule, postingWindows, from: Date, count, tz)` → `Date[]` (pure, tested: daily/weekdays/weekly at the given times).
- [ ] `scheduleDraft(admin, draft, at: Date)` inserts a `schedule_slots` row `{ platform, scheduled_at, draft_id, status: "filled" }` and moves the draft `approved → scheduled`.
- [ ] Approve in the inbox: if the campaign has `scheduledFor`, schedule at that date's first posting time; otherwise at `nextSlots(...)[0]`. The card shows "Scheduled for {date}" after approval, with a link to the calendar day.
- [ ] Campaign form: submitting with a date stores `settings.scheduledFor`; after the request is created, if `scheduledFor` is set, redirect to `/calendar?date=<scheduledFor>` (the calendar opens with that day selected and shows "N drafts generating for this day"); otherwise to the inbox as today.
- [ ] Commit `feat(schedule): approve-to-slot scheduling and calendar redirect`.

---

### Task 12: Analytics empty state and Connections page

**Files:** `analytics/page.tsx`, `connections/page.tsx`, `components/connections/PlatformCard.tsx`, `lib/publishers/credentials.ts` + tests, `app/api/connections/route.ts`.

- [ ] Analytics: if `connected_accounts` for the brand is empty → replace tiles with a single centred card: serif headline "No accounts connected yet.", one sentence explaining what will appear, and a `Button variant="accent"` "Connect a platform" → `/connections`. Otherwise show tiles (real data arrives in Plan 4).
- [ ] Connections page: a card per platform from `PLATFORM_RULES` with logo initial, adapter badge (native / via Late), status (Not connected / Connected as @handle / Reconnect), and an action. Bluesky: form for handle + app password. Mastodon: instance URL + access token. Meta / Late-backed platforms: button disabled with tooltip "Arrives with publishing (Plan 3)". Credentials are encrypted with AES-256-GCM using a key derived from `APP_SECRET` before being stored in `connected_accounts.tokens_encrypted`; `credentials.ts` exposes `seal(obj)`/`open(str)` with round-trip and tamper tests.
- [ ] Commit `feat(connections): platform connections page; analytics empty state`.

---

### Task 13: Full-width pass, tooltips audit, final motion pass

- [ ] Walk every page in both themes at 1440px; remove any remaining `max-w` caps; add tooltips to icon-only controls (theme toggle, "+" in calendar, rename pencil, dropzone remove); check every button has all interaction states; check reduced-motion.
- [ ] Update README screenshots list; commit `chore(ui): full-width audit and tooltip pass`.

---

## Self-review

**Coverage of the user's 15 items:** loop tooltips + cursor (T2) · step-card smoothness (T2) · hero hover-to-front with tilt (T2) · no toggle on auth (T2) · top navbar with theme on the right (T3) · bigger icons (T3) · avatar + name → menu (T4) · settings tabs with profile/password/info + avatar in sidebar (T5, T7) · analytics not-connected state + connect navigation (T12) · full calendar with day panel, "+", double-click, scheduled redirect (T10, T11) · signup → brand screen + bento cards (T6) · campaign left box bigger (T8) · dropzone section styled + page attractive (T8) · full-width pages (T3, T13) · brand rename with confirmation from sidebar (T9).

**Order of execution:** T1 → T3 → T4 → T5 → T7 → T2 → T6 → T8 → T9 → T10 → T11 → T12 → T13. Shell first so every later screen is reviewed in its final frame.

**Estimate:** 3–4 working days.
