# TheraSuite v2 — Product Requirements Document

A ground-up rebuild of TheraSuite: same product (solo-practice management for therapists, psychologists, and coaches), modern architecture, and every known security flaw designed out rather than patched. This PRD is self-contained — it does not assume the reader has seen the v1 codebase. Where a v1 behavior is referenced, it's to explain *what changed and why*.

Companion documents: `THERASUITE_SPEC.md` (reverse-engineered v1 behavior) and `supabase/migrations/000_baseline_schema.sql` (v1 live schema). Use those only as a feature checklist; **do not** port v1's data-access patterns.

---

## 1. Goals & non-goals

### Goals
1. Recreate all v1 features (auth, onboarding, clients, appointments, public booking, video, notes, invoicing, notifications, AI summaries) with cleaner UX.
2. **Security-first**: no world-readable tables, no PII or meeting tokens exposed to the anon key, no secrets in the client bundle, least-privilege throughout.
3. **A real data layer**: typed, cached, optimistic — no `window.location.reload()`, no per-row network round-trips.
4. **Server-authoritative business logic**: scheduling, overlap checks, status transitions, and billing enforced in one place, not in the browser.
5. Keep it deployable by a solo developer (managed backend, minimal ops).

### Non-goals (v2 scope line)
- Multi-therapist practices / org accounts / role hierarchies (single therapist per account, as today).
- Insurance claims, EHR interop, e-prescribing.
- Native mobile apps (PWA only; keep the push architecture mobile-ready).
- Real-time collaborative note editing.

## 2. Recommended stack

| Concern | v1 | v2 recommendation | Why |
|---|---|---|---|
| Framework | Vite SPA + React Router | **Next.js (App Router) + React Server Components** | Server-side data access keeps the anon key and PII off the client; API routes/route handlers give one place for business logic; SSR for the public booking page (SEO + speed). |
| Language | TS | TS, `strict: true` | Catch the class of bugs v1's `as any` hid. |
| Backend | Supabase (direct client calls) | **Supabase (Postgres + Auth + Storage), accessed only server-side** | Keep the managed backend, but the browser never holds a service role and rarely the anon key. |
| Data access | raw `useEffect` + supabase-js | **Server Actions / route handlers + TanStack Query on the client** | Typed, cached, invalidation instead of full reload. React Query is already a dep in v1 but unused. |
| Validation | zod (client only) | **zod shared client+server**, parsed at every trust boundary | Client validation is UX; server validation is the actual guard. |
| ORM/types | hand-written, stale | **`supabase gen types` in CI** (or Drizzle/Kysely if you want query-time safety) | v1 had three conflicting hand-written `Database` types; generate from the DB instead. |
| Video | Cloudflare RealtimeKit | **Keep RealtimeKit**, tokens minted server-side per-join | Works well; only the token-exposure model changes. |
| Email | Resend via edge function | **Resend via server route**, React Email templates | Consolidate 7 inline HTML strings into typed components. |
| AI | OpenAI gpt-4o via Cloudflare AI Gateway | Keep, but move to a queue/job (see §12) | Summaries shouldn't block a request. |
| Encryption | per-field AES-GCM via edge function, decrypted per-row in browser | **Postgres `pgsodium`/Vault or a server-side crypto helper; decrypt in the data layer, batched** | Eliminates the N-round-trips-per-list problem and keeps keys server-side. |
| Push | web-push + VAPID + custom SW | Keep, with a hardened subscription model | Architecture is fine. |
| Hosting | Vercel (SPA) | Vercel (Next.js) | Native fit. |
| Monitoring | Sentry, DSN hardcoded | Sentry via env, PII scrubbing on | Same tool, configured safely. |

If you'd rather stay a pure SPA, the security requirements in §4 can still be met by putting **all** privileged operations behind Supabase Edge Functions and never shipping the anon key with broad RLS. But Next.js server components make the secure path the default path, which is the whole point of the rebuild.

## 3. Roles & trust boundaries

- **Therapist** — the only authenticated principal. Owns all their clients/appointments/notes/invoices.
- **Client (prospect/patient)** — never authenticates. Interacts only through: (a) the public booking page, (b) transactional emails, (c) a single-purpose video-join link. Every client-facing surface must work with **zero standing read access to application tables**.
- **System (cron/jobs)** — reminder scheduling, digest sends, PDF generation, AI summaries. Runs with service credentials, server-side only.

**Hard rule:** the browser (authenticated or not) never receives the service role key, never receives another therapist's data, and never receives raw PII it shouldn't display. The anon key, if used at all, is paired with RLS that denies public reads by default.

## 4. Security requirements (the core of this rebuild)

These are requirements, not suggestions. Each maps to a specific v1 flaw.

### 4.1 No world-readable tables
- v1 had `appointments` and `profiles` with `FOR SELECT TO public USING (true)` — the entire tables were readable by anyone with the anon key (encrypted client names/emails/notes, video tokens, therapist email/phone/payment details).
- v2: **default-deny RLS on every table.** No policy may use `USING (true)` for `public`/`anon`. Authenticated therapists can read only rows where `therapist_id = auth.uid()`.

### 4.2 Public booking reads go through a narrow server surface
- The public booking page needs exactly: therapist display name, avatar, professional type, default session length, and blocked/holiday dates — for one therapist, by username.
- v2: expose this via a **`SECURITY DEFINER` function or a server route** returning only those fields (a `public_therapist_profile` view/RPC). No direct table read from the browser. Therapist email, phone, and `payment_details` are never in the public payload.

### 4.3 Video join tokens are minted per-join, server-side
- v1 stored long-lived `video_client_token`/`video_therapist_token` on the appointment row and let the unauthenticated client page read them (via the world-readable policy).
- v2:
  - The client receives a **short, unguessable, single-appointment join link** (signed token or opaque per-appointment `join_code`, not the appointment UUID).
  - A server route validates the code, checks the appointment is joinable (correct time window, not cancelled), and **mints a fresh RealtimeKit participant token at join time**. Tokens are never persisted in a browser-readable column.
  - Therapist join is gated by their authenticated session.

### 4.4 No secrets in the client bundle
- v1 shipped: Supabase anon key hardcoded as a fallback in source, a Sentry DSN hardcoded, and `VITE_RESEND_API_KEY` exposed to the browser (a Resend client was instantiated client-side though emails actually went through an edge function). `.env` and `vapid-keys.env` were committed.
- v2:
  - Only genuinely public values may use the `NEXT_PUBLIC_` prefix (Supabase URL, VAPID **public** key). Everything else stays server-side.
  - Resend, OpenAI, Cloudflare API tokens, service role, and the encryption key are **server-only env vars**, never imported into a client component.
  - `.gitignore` covers all `.env*` and key files; add a secret-scanning pre-commit hook (e.g. gitleaks) and rotate the v1 keys that were committed.

### 4.5 PII encryption without the round-trip tax
- v1 encrypted `clients.name/email` and `appointments.client_name/client_email/notes` with AES-GCM, but decrypted **one HTTP call per field per row** from the browser — every list page fanned out dozens of edge-function calls.
- v2: keep encryption at rest, but:
  - Decrypt **in the data layer on the server**, in bulk, as part of the query that fetches the list. The client receives already-decrypted display data over an authenticated connection.
  - Prefer **`pgsodium` transparent column encryption / Supabase Vault** or a single server-side crypto helper, so the key lives in the DB/secret manager, not in a function the browser calls.
  - Keep the `enc:`-prefix detection for backward-compat when migrating v1 data.

### 4.6 Server-authoritative writes & business rules
- v1 did overlap checks, recurring-appointment loops, auto-completion, and stats in the browser (race-prone; a determined client could bypass them).
- v2: all mutations go through **server actions/route handlers** that re-validate with zod and enforce invariants transactionally:
  - Overlap/double-booking check inside a DB transaction (or a Postgres exclusion constraint on `(therapist_id, tstzrange(session_date, session_date + length))`).
  - Recurring series created in one transaction.
  - Status transitions (`scheduled → completed`, etc.) via a scheduled job or a DB function, not a browser reload side-effect.

### 4.7 Storage least-privilege
- v1 buckets `invoices` and `profile-photos` were both fully public.
- v2:
  - **`invoices` private**; serve PDFs via short-lived signed URLs to the owning therapist (and, if a client link is needed, via a scoped signed URL, not a public path).
  - `profile-photos` may stay public-read (they're shown on the public booking page) but keep owner-scoped write/delete.

### 4.8 Least-privilege functions & audit
- Every `SECURITY DEFINER` function pins `search_path` and does exactly one thing (v1's `create_public_appointment_request` is a good model — keep that shape).
- Rate-limit the public booking submission and the video-join endpoints (per IP + per therapist) to prevent spam/enumeration.
- Add an `audit_log` for sensitive actions (invoice sent, client deleted, note edited, data exported).

## 5. Data model changes

Start from the v1 baseline (`000_baseline_schema.sql`) and apply these:

- **Add a real default session length/price to `profiles`** (v1 had none persisted; booking silently fell back to 60 min). Fields: `default_session_length int`, `default_price numeric`, `collect_payments bool`.
- **Appointments**
  - Add `join_code` (opaque, unique, indexed) for the client video link; **drop** browser exposure of `video_client_token`/`video_therapist_token` (keep server-side or mint on demand).
  - Replace client-side overlap checks with an **exclusion constraint** preventing overlapping `scheduled` appointments per therapist.
  - Keep `call_summary` only if the recording/transcription feature is actually rebuilt; otherwise drop it.
  - Consider splitting billing into an `invoices` table (invoice number, status, pdf_url, sent_at, paid_at, amount) rather than overloading appointment columns — cleaner history and multi-session invoices later.
- **Clients**: keep encrypted name/email; add the `updated_at` trigger v1 forgot.
- **Enums**: drop the unused `group` value from `session_type` (or actually implement group sessions). Convert `payment_status`/`video_provider` CHECK-text columns to real enums for consistency.
- **Remove duplicate RLS policies** (v1 had two identical insert/update policy pairs on `profiles`).
- **Types generated from the DB** in CI; delete all hand-written `Database` types.

## 6. Feature requirements

Each feature must reach v1 parity unless marked *changed*. Behaviors are described so an implementer needs no v1 access.

### 6.1 Auth & onboarding
- Email/password sign up + sign in. **Add** password reset (email link) — v1 had none. Session via Supabase Auth cookies (server-readable).
- On first sign-in, a `profiles` row is auto-provisioned (DB trigger on `auth.users`, as in v1).
- Onboarding wizard collects: full name, photo, professional type (psychologist/therapist/coach), session delivery (video/in-person/hybrid), practice location (if not video-only), currency, default session length + price. Marks `is_onboarding_complete`. Unfinished onboarding redirects here.
- *Changed*: persist and use the working-hours input (v1 collected it but never stored it) to drive booking availability.

### 6.2 Dashboard
- Stat cards: today's sessions (total + remaining), weekly hours, total clients, revenue this month. *Changed*: compute **server-side** in one query; format revenue in the therapist's actual currency (v1 hardcoded ₹).
- Mini month calendar highlighting days with appointments; selecting a day loads that day's list.
- Quick "create appointment".

### 6.3 Schedule (week calendar)
- Week grid, current-time indicator, click-empty-slot to create, drag-to-reschedule.
- *Changed*: reschedule persists via a server action with the same overlap/holiday checks as create — not a `sessionStorage` handoff + full reload. Cancelled sessions hidden. Optimistic update + query invalidation instead of `window.location.reload()`.

### 6.4 Clients
- List (avatar, name, email, last-appointment) sorted by recency; create client (name/email/timezone, encrypted).
- Detail: editable profile (name/email re-encrypted, phone, diagnosis, timezone), month-paginated appointment history, per-session note view/edit, delete (confirm).
- **AI notes summary**: generate a progress summary across the client's notes; cache on the client record; regenerate on demand. *Changed*: run as a background job (§12), decrypt notes server-side, never expose the OpenAI key to the browser.

### 6.5 Appointments
- Create with: new-or-existing client, date/time, length (30–180 in 15-min steps), type (video/in-person), price, notes, video provider (TheraSuite/Google Meet/Zoom), recurring (2–52 sessions; weekly/biweekly/monthly/bimonthly).
- Server enforces: no past dates, no overlaps, holiday warning surfaced to UI (non-blocking). *Changed*: recurring series + any TheraSuite meeting provisioning + confirmation emails happen in **one server transaction with batched/parallel side-effects**, not a sequential per-session browser loop; fix month recurrence end-of-month drift (use a proper date library rule).
- Actions: edit/reschedule, cancel (+ email), send reminder (+ email), copy client join link, start call, add-to-Google-Calendar.
- Auto-complete past `scheduled` sessions via a **scheduled job**, not an on-load browser mutation + reload.

### 6.6 Public booking & requests
- Public page at `/[username]` (SSR): therapist card + request form (name, email, optional message, one or more preferred date/time/duration slots within 90 days, excluding holidays).
- Submits through the narrow public surface (§4.2) → creates an `appointment_request`. Rate-limited. Success screen.
- Therapist "Requests" inbox: approve (opens prefilled create-appointment; on success marks request approved + links appointment) or decline (optional message + email with a link back to rebook). Pending count badge in nav.

### 6.7 Video sessions
- Provider = TheraSuite: create a RealtimeKit meeting server-side; therapist joins from an authed page; client joins via the signed `join_code` link (§4.3). Setup/preview screen drives the join (do **not** call `join()` manually — this was a real v1 regression). Therapist gets a floating live-notes panel; on room-leave, a **mandatory** post-session modal captures notes + final price + final duration and marks the session completed.
- Provider = external (Meet/Zoom): store the link; "start call" opens it and emails the client the link.
- Suppress benign RealtimeKit audio-device errors in Sentry (as v1 did).

### 6.8 Session notes
- Add at creation, live during a call, in the post-call modal, or edit later. Encrypted at rest. Notes list is paginated, client-filterable, searchable; decrypt server-side in bulk.

### 6.9 Invoicing & payments
- Monthly view of scheduled+completed sessions grouped Today/Recent/Upcoming; totals (received/pending) in the therapist's currency.
- Lifecycle: pending → send invoice (email with amount + payment instructions; requires payment details set) → invoice_sent → mark paid (records date) → undo. Resend + update-price supported.
- **PDF invoices**: generated server-side, stored **private**, delivered via signed URL (§4.7). Optional backfill job. *Changed*: consider the dedicated `invoices` table (§5).

### 6.10 Settings
- Profile (photo, name, phone, username with uniqueness check + regex), professional/session type, practice location, currency + payment details, default session length/price, working hours.
- Holidays: multi-select future dates, grouped-range chips, block booking + warn on create.
- Notification preferences (reminders on/off, lead time, daily digest on/off).
- Update password; sign out.

### 6.11 Notifications
- **Transactional email** (Resend, React Email templates): confirmation, cancellation, reminder, video-call-link, invoice, reschedule, request-declined. Rendered in the client's timezone.
- **Web push (PWA)**: subscription (one per user), permission prompt, service worker with push + click handlers. Cron pipeline: schedule reminders → send due queue → deliver via VAPID (deactivate dead subscriptions). Daily therapist digest gated by preference.

## 7. Non-functional requirements
- **Performance**: list pages issue O(1) network requests (no per-row fan-out). Server-rendered first paint for dashboard and booking page.
- **Type safety**: `strict` TS, DB-generated types, zod at every boundary. No `as any` on Supabase results.
- **Testing**: unit tests for scheduling/billing logic; an integration test asserting **anon cannot read** `appointments`/`profiles`/`clients` (guards against a v1-style RLS regression); e2e for booking → approve → session → invoice.
- **Observability**: Sentry with PII scrubbing; structured logs on server actions; the `audit_log`.
- **Accessibility & responsive**: keep the Dialog/Drawer responsive pattern; meet WCAG AA on booking + core flows.
- **Data migration**: one-time script to move v1 rows, preserving `enc:`-prefixed values and generating `join_code`s.

## 8. Migration & rollout
1. Stand up v2 schema from the corrected baseline (§5). Rotate all v1 secrets that were committed to git.
2. Backfill data from v1 (encryption-compatible).
3. Ship read-only parity, verify RLS with the anon-cannot-read test, then cut writes over.
4. Keep v1 edge functions running until v2 server routes replace them; download the three live-only v1 functions first (`add-dyte-participant`, `process-call-recording`, `send-daily-therapist-notifications`) if their behavior is still wanted.

## 9. Open questions
1. **Group sessions** — build the feature (the `group` enum hints at intent) or drop it?
2. **Invoices table vs. appointment columns** — worth the refactor now, or keep the denormalized columns for v2 and revisit?
3. **Recording/transcription** — is `process-call-recording` / `call_summary` a feature to revive, or dead weight to delete?
4. **Encryption approach** — pgsodium/Vault (DB-native, transparent) vs. an app-layer server crypto helper? Affects the migration path for existing `enc:` data.
5. **SPA vs. Next.js** — confirm the framework move; the security model is easiest with server components but achievable either way.
