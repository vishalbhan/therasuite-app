# TheraSuite — Full Feature & Architecture Specification

A reference document for rebuilding TheraSuite with a modern architecture. It describes every feature in the current app, how it works today, the data model, integrations, and known quirks worth fixing in the rewrite.

---

## 1. What the app is

TheraSuite is a **solo-practice management platform for therapists, psychologists, and coaches**. The therapist is the only authenticated user type; clients interact only through emails and two public pages (the booking page and the video-call join page). Core loops:

1. Therapist onboards → sets up profile, session preferences, currency, payment details.
2. Clients request appointments via a public booking page (`therasuite.app/<username>`), or the therapist creates appointments directly.
3. Sessions happen (built-in video via Cloudflare RealtimeKit, external Google Meet/Zoom links, or in person).
4. Therapist takes session notes (encrypted), marks sessions complete, sends invoices, tracks payments.
5. Automated emails (confirmation, reminder, cancellation, reschedule, invoice) and web-push reminders.

## 2. Current tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, React Router v6 (SPA) |
| UI | Tailwind CSS + shadcn/ui (Radix primitives), lucide-react icons, sonner + shadcn toasts |
| Forms | react-hook-form + zod |
| Backend | Supabase (Postgres + RLS, Auth, Storage, Edge Functions on Deno) |
| Video | Cloudflare RealtimeKit (`@cloudflare/realtimekit-react`, `-react-ui`) — migrated from Dyte; many files still named "Dyte" |
| Email | Resend, sent from Supabase edge function `send-email` |
| AI | OpenAI `gpt-4o` via Cloudflare AI Gateway (client-notes summary) |
| Push | Web Push (VAPID) + PWA service worker (`vite-plugin-pwa`, Workbox, injectManifest) |
| PDF | `@react-pdf/renderer` in edge function, stored in Supabase Storage `invoices` bucket |
| Monitoring | Sentry (`@sentry/react`), DSN hardcoded in `App.tsx`, with filters for benign RealtimeKit audio errors |
| Hosting | Vercel (SPA rewrite in `vercel.json`); production origin `https://www.therasuite.app` |

Notes: React Query is in dependencies but **not actually used** — all data fetching is raw `useEffect` + supabase-js. `express`/`cors`/`web-push` deps in package.json are leftovers from an abandoned local server.

## 3. Routing map

| Route | Access | Page |
|---|---|---|
| `/` | public | Auth (sign in / sign up, marketing panel) |
| `/onboarding` | authed | Onboarding form |
| `/:username` | public | Public booking page |
| `/video/:appointmentId` | authed | Therapist video session |
| `/client-video/:appointmentId` | public (unauthenticated) | Client video session |
| `/dashboard` | protected + onboarded | Dashboard |
| `/schedule` | protected | Week-grid calendar |
| `/requests` | protected | Appointment requests inbox |
| `/clients`, `/clients/:clientId` | protected | Client list / detail |
| `/notes` | protected | All session notes |
| `/invoices` | protected | Billing / payments |
| `/settings` | protected | Settings |

`ProtectedRoute` checks the Supabase session, sets Sentry user, and redirects to `/onboarding` if `profiles.is_onboarding_complete` is false. Layout = top `Navbar` (desktop) + `BottomNavigation` (mobile), both showing a pending-requests count badge. Nearly every modal has a Dialog (desktop) / Drawer (mobile) variant switched by a `useIsMobile` hook.

## 4. Data model

> **Source of truth:** This section reflects the **live Supabase schema** (project `nkobjmahyfkkbxeqafww`, Postgres 15, region ap-south-1), fetched via MCP. The repo's `supabase/migrations/` only covers push-notification tables + a few column adds; the base tables, enums, RLS policies, DB functions, and triggers were created in the dashboard and were **not** in git. A complete, runnable baseline is now checked in at [`supabase/migrations/000_baseline_schema.sql`](supabase/migrations/000_baseline_schema.sql). Postgres enums, exact RLS, functions, and triggers are enumerated in §21.

Column types below are exact. 🔒 = stored AES-GCM-encrypted with an `enc:` prefix (see §12). All base tables have RLS enabled.

### Postgres enum types
- `professional_type`: `psychologist | therapist | coach`
- `session_type`: `video | in_person | hybrid | group` — **note `group` exists in the enum but is blocked by the `profiles.session_type` CHECK, which only allows the first three.**
- `appointment_type` (used by `appointments.session_type`): `video | in_person`
- `appointment_status`: `scheduled | completed | cancelled | expired`

`payment_status`, `video_provider`, and `appointment_requests.status` are **plain `text`/`varchar` with CHECK constraints**, not enums.

### `profiles` (PK `id` = `auth.users.id`; row auto-created by trigger on signup)
- `id` uuid PK → `auth.users.id`
- `email` text UNIQUE, `full_name` text, `phone_number` text, `photo_url` text
- `username` varchar UNIQUE, CHECK `~ '^[a-zA-Z0-9_-]+$'` (powers public booking URL; app lowercases it)
- `professional_type` enum (nullable)
- `session_type` enum (nullable, CHECK limits to video/in_person/hybrid)
- `currency` text NOT NULL default `'INR'` (app offers INR/USD/EUR/GBP/AUD/CAD)
- `payment_details` text (UPI/bank info, embedded in invoice emails)
- `location` jsonb (address/city/state/country/postal_code — for in-person)
- `holidays` jsonb default `'[]'` (array of `yyyy-MM-dd` strings)
- `is_onboarding_complete` bool default `false`
- `created_at` / `updated_at` timestamptz default `timezone('utc', now())`
- **Not in DB** (were guessed earlier from stale code): `session_length`, `price_per_session`, `collect_payments` — these do **not** exist as profile columns. Per-session length/price live on each appointment; the public booking page reads the therapist's default length from... nowhere persistent (it falls back to 60). Worth adding a real default in the rewrite.

### `clients` (10 rows live)
- `id` uuid PK, `therapist_id` uuid → `auth.users.id`
- `name` 🔒 text, `email` 🔒 text — **UNIQUE `(therapist_id, email)`** (constraint `therapist_client_email`)
- `phone_number` text, `diagnosis` text
- `timezone` varchar NOT NULL default `'Asia/Kolkata'` (IANA; DB comment documents this)
- `avatar_color` text, `initials` text
- `ai_summary` text (cached AI notes summary)
- `created_at` / `updated_at` timestamptz

### `appointments` (1,035 rows live)
- `id` uuid PK (`uuid_generate_v4()`), `therapist_id` uuid → `auth.users.id`, `client_id` uuid → `clients.id`
- `client_name` 🔒 text, `client_email` 🔒 text (denormalized snapshot)
- `session_date` timestamptz
- `session_length` int, CHECK `IN (30,45,60,75,90,105,120,135,150,165,180)`
- `session_type` `appointment_type` enum (`video | in_person`)
- `price` numeric
- `notes` 🔒 text
- `status` `appointment_status` enum default `scheduled` (`scheduled | completed | cancelled | expired`)
- `payment_status` text default `'pending'`, CHECK `IN ('pending','invoice_sent','received')`
- `payment_date` timestamptz
- `video_provider` text, CHECK `IN ('therasuite','google_meet','zoom')` (null for in-person)
- `custom_meeting_link` text (external providers)
- `video_meeting_id` / `video_therapist_token` / `video_client_token` text (RealtimeKit meeting + participant tokens)
- `pdf_invoice` text (public URL of generated PDF)
- `call_summary` text — **exists in DB, unused by the current frontend** (leftover from the abandoned call-recording/transcription feature; see §18)
- `created_at` / `updated_at` timestamptz

### `appointment_requests` (public booking; 0 rows live)
- `id` uuid PK, `therapist_id` uuid → **`profiles.id`** (note: FK targets `profiles`, not `auth.users`)
- `client_name` / `client_email` varchar, `client_message` text
- `preferred_dates` jsonb (array of ISO datetimes — client can propose multiple slots)
- `session_length` int
- `status` varchar default `'pending'`, CHECK `IN ('pending','approved','declined','expired')`
- `therapist_response` text, `appointment_id` uuid → `appointments.id`
- `created_at` / `updated_at` timestamptz, `expires_at` timestamptz default `now() + interval '7 days'`
- Inserted by anonymous visitors via **SECURITY DEFINER RPC `create_public_appointment_request(...)`** (full definition in §21). There is **no anon INSERT policy** on the table — the RPC is the only public write path.

### Push / notification tables
- `push_subscriptions` — `user_id` UNIQUE → auth.users, `endpoint`, `p256dh`, `auth`, `is_active` bool default true. Upserted via `upsert_push_subscription` RPC. (0 rows live.)
- `notification_preferences` — `user_id` UNIQUE, `appointment_reminder_enabled` bool default true, `reminder_minutes_before` int default 15, **`daily_reminder_enabled` bool default true** (drives the daily therapist digest — see §18). (0 rows live.)
- `notification_queue` — `user_id`, `appointment_id` → appointments, `notification_type` text, `scheduled_for` timestamptz, `sent_at`, `status` text default `'pending'`, `retry_count` int default 0, `error_message` text. (469 rows live.)

### Storage buckets (both **public**)
- `invoices` — generated PDFs at `therapists/<id>/appointments/<appointment_id>.pdf`
- `profile-photos` — therapist profile photos (uploaded by `PhotoUpload`)

## 5. Auth & onboarding

- Email/password only (`signInWithPassword` / `signUp`); password update from Settings (min 6 chars). No OAuth, no password reset flow in code.
- Onboarding form collects: full name, photo, professional type, session type (video/in-person/hybrid), practice location (unless video-only), currency. Upserts profile with `is_onboarding_complete = true`, then redirects to dashboard. (A `WorkingHoursInput` component exists but working hours are not actually persisted/used anywhere.)

## 6. Dashboard

- Four stat cards computed client-side from queries: **Today's sessions** (total + remaining, excluding cancelled), **Weekly hours** (sum of session_length / 60), **Total clients** (distinct client_ids across all appointments), **Revenue this month** (sum of price for scheduled+completed; hardcoded INR formatting bug — ignores currency setting).
- Mini month calendar with bolded days that have appointments; selecting a day loads that day's appointment list.
- Day appointment list is the shared `AppointmentsList` component (see §8).
- "Create appointment" opens the shared modal via `?modal=create` URL param (this URL-param pattern is used on Dashboard, Schedule, and Clients).

## 7. Schedule (week calendar)

- Custom-built week grid (Mon-start), 6:00–22:00 in 30-min rows, current-time red line, auto-scrolls to now.
- Appointment blocks sized by duration, colored by session type (video = dark blue, in-person = light blue); cancelled hidden.
- Click empty slot → opens Create modal pre-filled with that date/time.
- **Drag & drop reschedule**: dragging a block to a new slot opens the Edit modal pre-filled with the new date/time (stashed in `sessionStorage`), rather than saving directly.
- Click block → details modal with Cancel (confirm dialog → status `cancelled`) and Reschedule (Edit modal) actions. Uses `window.location.reload()` after mutations.
- FullCalendar packages are installed but this page doesn't use them.

## 8. Appointments

### Create (`CreateAppointmentModal`, used from Dashboard/Schedule/Clients/Requests)
- Client selection: **New client** (name+email → encrypt → upsert into `clients` with random avatar color, initials, default timezone `Asia/Kolkata`) or **Existing client** (dropdown of decrypted client names).
- Fields: date, time, length (30–180 min), type (video/in-person), price (currency symbol from profile currency), optional notes.
- Video sessions choose a **provider**: TheraSuite Video (built-in), Google Meet, or Zoom; external providers require a valid meeting URL.
- In-person shows the therapist's saved practice location (read-only; edited in Settings).
- **Recurring appointments**: toggle → number of sessions (2–52) + frequency (weekly / biweekly / monthly / bimonthly). Creates them in a loop; recurring forces TheraSuite Video.
- Validations: no past dates; **overlap check** against same-day scheduled appointments before each insert; **holiday warning** (non-blocking) if the chosen date is in profile holidays.
- Per appointment created: insert row → if TheraSuite video, call `create-dyte-meeting` edge function (creates RealtimeKit meeting + host/participant tokens, stores them on the row) → send `appointment_confirmation` email (in client's timezone, includes video link `/client-video/<id>` or the external link, and an "Add to Google Calendar" link). Email failure is non-fatal (shows warning).
- Success overlay offers "Add to Google Calendar" (prebuilt `calendar.google.com/render` URL) for the therapist.

### Edit / reschedule (`EditAppointmentModal`)
- Changes date/time/length/notes; updates any queued reminder's `scheduled_for`; sends `appointment_rescheduled` email (old vs new time).

### List actions (`AppointmentsList`, shared by Dashboard)
- Auto-completion: any `scheduled` appointment whose end time has passed is bulk-updated to `completed` on load (then `window.location.reload()`).
- Per-appointment menu: Edit, Add to Google Calendar, **Send reminder email** (with video link), **Cancel** (status → cancelled + `appointment_cancellation` email), mark completed/cancelled.
- **Copy join link** (client link or external URL).
- **Start call** (only enabled within the session window): external provider → opens link + emails `video_call_link` to client; TheraSuite → (re)creates the RealtimeKit meeting via the edge function, emails client their join link, navigates therapist to `/video/<id>`.

## 9. Public booking & requests

### Public page `/:username`
- Loads therapist by `username` where `is_onboarding_complete = true`; shows avatar, name, type.
- Form: client name, email, optional message, and **one or more preferred slots** (date within next 90 days, excluding therapist holidays; time; duration 30/45/60/90/120 — defaults to the therapist's `session_length`).
- Submits via the `create_public_appointment_request` RPC. Success screen with "send another request".

### Requests inbox `/requests`
- Prompts to set a username first if missing; "Share booking page" copies `https://therasuite.app/<username>`.
- Lists requests with status badges; pending count badges appear in the nav.
- **Approve** → opens the Create Appointment modal pre-filled with the client's info and (chosen) preferred slot; on creation the request is marked `approved` and linked via `appointment_id`.
- **Decline** → optional message; marks `declined`, sends `appointment_request_declined` email including a link back to the booking page to pick new times.

## 10. Clients

### List `/clients`
- Table (desktop) / cards (mobile) with avatar (color+initials), decrypted name/email, last-appointment date; sorted by most recent appointment. Actions: New Appointment (pre-filled modal), View History.
- `CreateClientModal`: name + email (+ timezone), encrypts and inserts.

### Detail `/clients/:clientId`
- Editable client profile: name, email (re-encrypted on save), phone, diagnosis, timezone (searchable IANA selector with ~70 curated options in `lib/timezone.ts`).
- Month-paginated appointment history grouped Today / Upcoming / Recent, with note viewing/editing per appointment.
- Delete client (confirm modal).
- **AI notes summary** (`AIClientNotesSummary`): fetches all of the client's decrypted notes → calls `generate-ai-summary` edge function (OpenAI gpt-4o through Cloudflare AI Gateway, therapy-assistant system prompt) → renders markdown → caches result in `clients.ai_summary` with regenerate button.

## 11. Video sessions (Cloudflare RealtimeKit)

- Edge function `create-dyte-meeting` (name is legacy): calls Cloudflare REST API `accounts/<acct>/realtime/kit/<app>/meetings` to create a meeting, then creates two participant tokens — therapist preset `group_call_host`, client preset `group_call_participant` — and stores `video_meeting_id` + both tokens on the appointment row.
- **Therapist** (`/video/:id`, authed): initializes RealtimeKit with the stored therapist token; renders `<RtkMeeting showSetupScreen>` — the setup screen acts as the waiting room / device preview and performs the join itself (important regression lesson: do **not** call `join()` manually). Extras: a draggable floating "Session Notes" panel to take notes live (saved to `appointments.notes`), and on `roomLeft` a **mandatory post-session `NotesModal`** capturing notes + final price + final duration, which marks the appointment `completed` and redirects to dashboard. Call start/end times captured from `roomJoined`/`roomLeft` events.
- **Client** (`/client-video/:id`, public, no auth): fetches `video_client_token` by appointment id and joins the same way. ⚠️ This means anon read access to those columns — in the rewrite, gate this behind a server endpoint/token instead.
- Sentry filters suppress known-benign RealtimeKit audio-device errors (ERR1608 / "No audio output devices" / LocalMediaHandler).

## 12. Session notes

- Notes can be added at creation, during a video call (floating panel), in the post-call modal, or edited later.
- **Encrypted at rest**: `encryptSingleValue` before save; decrypted per-row for display.
- `/notes` page: paginated (10/page "load more") list of all appointments having notes, client filter, truncated preview, click to view/edit in `NotesModal` (edit-only mode hides price/duration), link to client history.

## 13. Invoicing & payments

- Monthly view (prev/next month) of scheduled+completed appointments, grouped Today / Recent / Upcoming; summary strip: Monthly Total / Received / Pending (formatted in profile currency).
- Filters: payment status and client (searchable dropdown).
- Payment lifecycle per appointment: `pending` → **Send Invoice** (`payment_invoice` email with price + therapist's `payment_details` text; requires payment details set) → `invoice_sent` → **Mark as Paid** (`received` + `payment_date`) → undo back to pending. Resend invoice supported; Update Price modal for pending ones.
- **PDF invoices**: edge function `generate-invoice-pdf` renders a PDF (`@react-pdf/renderer`) with invoice number derived from session date + id, uploads to public `invoices` bucket, saves URL to `appointments.pdf_invoice` (skips if already generated). `generate-missing-invoices` backfills PDFs for completed appointments missing one (from a hardcoded start date).

## 14. Emails (Resend via `send-email` edge function)

All from `appointments@therasuite.app` (invoices from `payments@therasuite.app`), shared branded HTML template (purple TheraSuite header/footer). Dates are formatted in the **client's timezone** with tz abbreviation. Types:

1. `appointment_confirmation` — booking details, video link, Add-to-Google-Calendar link
2. `appointment_cancellation`
3. `appointment_reminder` — manual "send reminder" action; includes calendar link + video link
4. `video_call_link` — "your session is starting" when therapist starts a call
5. `payment_invoice` — price + payment instructions
6. `appointment_rescheduled` — old vs new time
7. `appointment_request_declined` — optional therapist message + link to booking page

## 15. Push notifications (web push, PWA)

- PWA via `vite-plugin-pwa` injectManifest; custom `public/sw.js` (Workbox precache, SPA nav fallback, push + notification-click handlers with View/Dismiss actions).
- `usePushNotifications` hook: permission flow, subscribes with VAPID public key, saves subscription via `upsert_push_subscription` RPC (one subscription per user), unsubscribe support. Settings section (`PushNotificationSettings`) toggles it + reminder lead time; `NotificationPermissionPrompt` nudges users.
- Pipeline (designed to run on cron): `schedule-appointment-reminders` finds appointments in the next 2h and queues per-user reminders at `session_date − reminder_minutes_before` respecting preferences → `send-queued-notifications` processes due queue rows → `send-push-notification` (web-push + VAPID) delivers, deactivating dead subscriptions. `send-expo-push` exists for a mobile (Expo) companion.
- **Daily therapist digest**: `send-daily-therapist-notifications` (live-only function, not in repo) pushes each therapist a daily summary of their day's appointments, gated by `notification_preferences.daily_reminder_enabled`.
- See `PUSH_NOTIFICATIONS.md` / `PUSH_SETUP_GUIDE.md` in repo root; `scripts/generate-vapid-keys.js` generates keys.

## 16. Field-level encryption

- Edge function `encrypt-client-data`: AES-256-GCM via Web Crypto, key from `ENCRYPTION_KEY` env (hex), random 12-byte IV prepended, base64, `enc:` prefix. Actions: `encrypt`, `decrypt`, `encrypt_single`, `decrypt_single`. Accepts user JWTs or the service-role key.
- Frontend `lib/encryption.ts` wraps it; decryption **falls back to returning the raw value** on any failure, and `enc:` prefix detection makes it backward-compatible with legacy plaintext rows.
- Encrypted fields: `clients.name/email`, `appointments.client_name/client_email/notes`.
- ⚠️ Cost: every list view makes **one HTTP round-trip per encrypted field per row** (`Promise.all` of decrypt calls). In the rewrite, batch decrypt server-side (or decrypt in an API layer / use pgsodium) — this is the app's biggest performance problem.

## 17. Settings

- Profile: photo upload, full name, phone, **username** (regex `[a-zA-Z0-9_-]{3,50}`, lowercased, uniqueness check button + on save).
- Professional type; session type (video / in-person / hybrid); practice location fields shown for in-person/hybrid.
- Currency (6 options; stored on profile, propagated app-wide via `CurrencyContext`) + payment details textarea.
- Push notification settings (see §15).
- **Holidays**: multi-select calendar popover (future dates only) with pending add/remove confirmation; displayed as chips grouped into consecutive-date ranges with one-click removal. Holidays block dates on the public booking page and warn on the create-appointment modal.
- Update password modal; sign out (confirm modal).

## 18. Supabase edge functions inventory

**All 13 live functions are deployed with `verify_jwt: true`.** The three marked ⚠️ are **deployed in the live project but their source is NOT in the repo** — you'll need to pull them (`supabase functions download <slug>`) before rebuilding, or reimplement from the descriptions here. `generate-invoice-pdf` and `generate-missing-invoices` are in the repo but were **not** in the live deployment list at fetch time (either undeployed or renamed) — verify before relying on them.

| Function (live slug) | In repo? | Purpose |
|---|---|---|
| `create-dyte-meeting` | ✅ | Create RealtimeKit meeting + host/client tokens, save to appointment. CORS locked to prod origin + localhost:8080 |
| `add-dyte-participant` | ⚠️ live-only | Add a participant token to an existing RealtimeKit meeting (legacy join path) |
| `process-call-recording` | ⚠️ live-only | Post-call recording/transcription → populates `appointments.call_summary` (abandoned feature; explains the unused column) |
| `encrypt-client-data` | ✅ | AES-GCM encrypt/decrypt of PII fields; accepts user JWT or service key |
| `send-email` | ✅ | All 7 Resend email types |
| `generate-ai-summary` | ✅ | OpenAI gpt-4o via Cloudflare AI Gateway over session notes |
| `manage-push-subscription` | ✅ | Push subscription CRUD helper |
| `schedule-appointment-reminders` | ✅ | Queue push reminders (cron) |
| `send-queued-notifications` | ✅ | Process due notification queue (cron) |
| `send-push-notification` | ✅ | Web-push (VAPID) delivery |
| `send-daily-therapist-notifications` | ⚠️ live-only | Daily digest of the therapist's appointments (cron; gated by `daily_reminder_enabled`) |
| `send-expo-push` | ✅ | Expo push for a mobile companion app |
| `generate-invoice-pdf` | ✅ (repo only) | Render + store invoice PDF (`@react-pdf/renderer` → `invoices` bucket) |
| `generate-missing-invoices` | ✅ (repo only) | Backfill invoice PDFs for completed appointments |

## 19. Environment variables

Frontend (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_FUNCTIONS_URL`, `VITE_VAPID_PUBLIC_KEY`, (`VITE_RESEND_API_KEY` — legacy, see quirks).
Edge functions: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `RESEND_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_APP_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_AI_GATEWAY_ID`, `OPENAI_API_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `VITE_VAPID_PUBLIC_KEY`.

## 20. Known quirks / debt to fix in the rewrite

1. **Per-row decrypt HTTP calls** (§16) — the dominant latency source on every list page.
2. **Stale/duplicated types**: three conflicting `Database` type files plus inline redefinitions in components; none match the real schema. Generate types from the live DB.
3. ~~Base schema not in migrations~~ — **RESOLVED**: full live schema exported to [`supabase/migrations/000_baseline_schema.sql`](supabase/migrations/000_baseline_schema.sql) and enumerated in §21. Three edge functions remain live-only (§18) — download them too.
4. **No data-fetching layer**: raw useEffect fetching, `window.location.reload()` after mutations, duplicated fetch logic. React Query is installed but unused.
5. **Business logic in the client**: overlap checks, recurring-appointment loops, auto-complete status transitions, stats — all client-side and race-prone. Move to DB functions / API routes.
6. **🔴 CRITICAL — appointments are world-readable.** The live RLS policy `"Allow public read access to video meeting details"` on `appointments` is `FOR SELECT TO public USING (true)` — it grants read access to **every column of every appointment row for anyone with the anon key**, including encrypted client name/email/notes and the RealtimeKit tokens. It exists so the unauthenticated `/client-video/:id` page can fetch its join token, but it leaks the entire table. In the rewrite, replace it with a narrow server endpoint (edge function returning only that appointment's client token by id), or a security-definer RPC scoped to `video_*` columns — never a blanket `USING (true)`. Same applies to `profiles` (`"Public profiles are viewable by everyone" USING (true)`), which exposes every therapist's email/phone/payment_details; scope public reads to booking-relevant columns only.
7. **Secrets hygiene**: Supabase anon key hardcoded as fallback in `client.ts`; Sentry DSN hardcoded; `VITE_RESEND_API_KEY` was exposed to the browser (frontend instantiates a Resend client it doesn't need — emails already go through the edge function); `vapid-keys.env` and `.env` committed to repo.
8. Dashboard revenue card hardcodes INR formatting instead of using the currency setting.
9. Invoices client filter matches on decrypted display name instead of `client_id`.
10. New clients default to `Asia/Kolkata` timezone with no picker at creation time in the appointment modal.
11. Recurring appointments email + create Dyte meeting **sequentially per session** (slow for many sessions), and monthly recurrence uses `setMonth` (end-of-month drift).
12. Naming: "Dyte" survives in file/function/column names post-Cloudflare migration.
13. FullCalendar, express, ts-node, web-push (frontend) are unused dependencies.
14. **Duplicate RLS policies** on `profiles` (two identical "insert own profile", two "update own profile" pairs) — dashboard-era cruft; consolidate.
15. **`profiles.session_type` enum includes `group`** but the CHECK blocks it — either finish the group-sessions feature or drop the value.

---

## 21. Live database objects (exact)

Reference dump of the RLS policies, functions, and triggers as they exist in production. The runnable version is [`supabase/migrations/000_baseline_schema.sql`](supabase/migrations/000_baseline_schema.sql).

### RLS policies

**`profiles`** — SELECT `"Public profiles are viewable by everyone."` `USING (true)` 🔴; SELECT `"Users can view own profile"` `(auth.uid() = id)`; INSERT×2 (dupes) `WITH CHECK (auth.uid() = id)`; UPDATE×2 (dupes) `USING (auth.uid() = id)`.

**`clients`** — SELECT/INSERT/UPDATE/DELETE all scoped to `auth.uid() = therapist_id`.

**`appointments`** — SELECT `"Allow public read access to video meeting details"` `TO public USING (true)` 🔴; SELECT/INSERT/UPDATE/DELETE scoped to `auth.uid() = therapist_id`.

**`appointment_requests`** — SELECT + UPDATE for `authenticated` where `therapist_id = auth.uid()`. **No public INSERT policy** (writes go only through the SECURITY DEFINER RPC).

**`push_subscriptions` / `notification_preferences` / `notification_queue`** — per-user (`auth.uid() = user_id`) SELECT/INSERT/UPDATE(/DELETE for subs), plus a `service_role` ALL policy on each. `notification_queue` has no user-facing INSERT/DELETE (only the queue processor writes).

**`storage.objects`** — bucket `profile-photos`: public SELECT; authenticated INSERT; owner-scoped UPDATE/DELETE. (No explicit policies on the `invoices` bucket beyond it being public; PDFs are written by the service role.)

### Functions
- `create_public_appointment_request(p_therapist_id uuid, p_client_name text, p_client_email text, p_client_message text=null, p_preferred_dates jsonb=null, p_session_length int=60) → (id uuid, created_at timestamptz)` — SECURITY DEFINER, `search_path=public`; single INSERT into `appointment_requests`. **Only public write path for booking requests.**
- `handle_new_user_profile()` — SECURITY DEFINER trigger; inserts `(id, email)` into `profiles` on new `auth.users` row.
- `upsert_push_subscription(user_id, endpoint, p256dh, auth, is_active=true)` — SECURITY DEFINER; upsert on `user_id`.
- `handle_updated_at()` / `update_updated_at_column()` — two functionally identical `updated_at` touch triggers (consolidate in rewrite).

### Triggers
- `auth.users` → `on_auth_user_created` AFTER INSERT → `handle_new_user_profile()` (auto-provisions the profile row — the app never inserts profiles directly, only upserts to fill them in during onboarding).
- `profiles` → `update_profiles_updated_at` (uses `update_updated_at_column`)
- `appointments` → `appointments_updated_at` (uses `update_updated_at_column`)
- `notification_preferences` → `notification_preferences_updated_at` (uses `handle_updated_at`)
- `push_subscriptions` → `push_subscriptions_updated_at` (uses `handle_updated_at`)
- `clients` has **no** `updated_at` trigger despite having the column (app doesn't touch it).
