-- =============================================================================
-- TheraSuite baseline schema
-- Reconstructed from the live Supabase project (nkobjmahyfkkbxeqafww) via MCP.
-- This captures the base tables, enums, constraints, RLS policies, functions,
-- and triggers that were created in the dashboard and never committed to git.
--
-- Run order: this file first, then the existing numbered migrations
-- (001_add_push_subscriptions.sql already creates the notification tables, so
-- those blocks are guarded / kept here for completeness — dedupe as needed).
--
-- 🔴 SECURITY: the two `USING (true)` public SELECT policies below are copied
-- as-is to match production, but they over-expose data. See THERASUITE_SPEC.md
-- §6/§20 before deploying to a new project — scope them down.
-- =============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.professional_type as enum ('psychologist','therapist','coach');
exception when duplicate_object then null; end $$;

-- NOTE: 'group' exists in production but is blocked by the profiles CHECK below.
do $$ begin
  create type public.session_type as enum ('video','in_person','hybrid','group');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_type as enum ('video','in_person');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum ('scheduled','completed','cancelled','expired');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id),
  email text unique,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now()),
  full_name text,
  photo_url text,
  professional_type public.professional_type
    check (professional_type = any (array['psychologist'::public.professional_type,'therapist'::public.professional_type,'coach'::public.professional_type])),
  session_type public.session_type
    check (session_type = any (array['video'::public.session_type,'in_person'::public.session_type,'hybrid'::public.session_type])),
  is_onboarding_complete boolean default false,
  currency text not null default 'INR',
  location jsonb,
  payment_details text,
  username varchar unique check (username::text ~ '^[a-zA-Z0-9_-]+$'),
  phone_number text,
  holidays jsonb default '[]'::jsonb
);
alter table public.profiles enable row level security;

-- ----------------------------------------------------------------------------
-- clients  (name/email stored AES-GCM encrypted with 'enc:' prefix)
-- ----------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  therapist_id uuid not null references auth.users(id),
  name text not null,
  email text not null,
  avatar_color text not null,
  initials text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  phone_number text,
  diagnosis text,
  ai_summary text,
  timezone varchar not null default 'Asia/Kolkata',
  constraint therapist_client_email unique (therapist_id, email)
);
comment on column public.clients.timezone is 'Client timezone in IANA timezone format (e.g., Asia/Kolkata, America/New_York)';
alter table public.clients enable row level security;

-- ----------------------------------------------------------------------------
-- appointments  (client_name/client_email/notes encrypted)
-- ----------------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default uuid_generate_v4(),
  therapist_id uuid not null references auth.users(id),
  client_id uuid not null references public.clients(id),
  client_name text not null,
  client_email text not null,
  session_date timestamptz not null,
  session_length integer not null check (session_length = any (array[30,45,60,75,90,105,120,135,150,165,180])),
  session_type public.appointment_type not null,
  price numeric not null,
  notes text,
  status public.appointment_status default 'scheduled',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  video_meeting_id text,
  video_therapist_token text,
  video_client_token text,
  call_summary text,                                   -- unused (abandoned recording feature)
  payment_status text default 'pending' check (payment_status = any (array['pending','invoice_sent','received'])),
  payment_date timestamptz,
  video_provider text check (video_provider = any (array['therasuite','google_meet','zoom'])),
  custom_meeting_link text,
  pdf_invoice text
);
alter table public.appointments enable row level security;

-- ----------------------------------------------------------------------------
-- appointment_requests  (public booking inbox)
-- ----------------------------------------------------------------------------
create table if not exists public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid references public.profiles(id),
  client_name varchar not null,
  client_email varchar not null,
  client_message text,
  preferred_dates jsonb,
  session_length integer,
  status varchar default 'pending' check (status::text = any (array['pending','approved','declined','expired']::text[])),
  therapist_response text,
  appointment_id uuid references public.appointments(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '7 days')
);
alter table public.appointment_requests enable row level security;

-- ----------------------------------------------------------------------------
-- notification stack (also created by 001_add_push_subscriptions.sql — guarded)
-- ----------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_active boolean default true
);
alter table public.push_subscriptions enable row level security;

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  appointment_reminder_enabled boolean default true,
  reminder_minutes_before integer default 15,
  daily_reminder_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.notification_preferences enable row level security;

create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  notification_type text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text default 'pending',
  retry_count integer default 0,
  error_message text,
  created_at timestamptz default now()
);
alter table public.notification_queue enable row level security;

-- ----------------------------------------------------------------------------
-- Functions
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end; $$;

create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.upsert_push_subscription(
  user_id uuid, endpoint text, p256dh text, auth text, is_active boolean default true
) returns void language plpgsql security definer as $$
begin
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, is_active)
  values (user_id, endpoint, p256dh, auth, is_active)
  on conflict (user_id) do update set
    endpoint = excluded.endpoint, p256dh = excluded.p256dh,
    auth = excluded.auth, is_active = excluded.is_active, updated_at = now();
end; $$;

-- The only public write path for booking requests (no anon INSERT policy exists).
create or replace function public.create_public_appointment_request(
  p_therapist_id uuid, p_client_name text, p_client_email text,
  p_client_message text default null, p_preferred_dates jsonb default null,
  p_session_length integer default 60
) returns table(id uuid, created_at timestamptz)
language plpgsql security definer set search_path to 'public' as $$
begin
  return query
  insert into appointment_requests (therapist_id, client_name, client_email, client_message, preferred_dates, session_length)
  values (p_therapist_id, p_client_name, p_client_email, p_client_message, p_preferred_dates, p_session_length)
  returning appointment_requests.id, appointment_requests.created_at;
end; $$;

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user_profile();

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
  before update on public.profiles for each row execute function public.update_updated_at_column();

drop trigger if exists appointments_updated_at on public.appointments;
create trigger appointments_updated_at
  before update on public.appointments for each row execute function public.update_updated_at_column();

drop trigger if exists notification_preferences_updated_at on public.notification_preferences;
create trigger notification_preferences_updated_at
  before update on public.notification_preferences for each row execute function public.handle_updated_at();

drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions for each row execute function public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- RLS policies (copied to match production; see 🔴 notes before reusing verbatim)
-- ----------------------------------------------------------------------------

-- profiles
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true); -- 🔴 over-exposes email/phone/payment_details
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- clients
create policy "Users can view their own clients"   on public.clients for select using (auth.uid() = therapist_id);
create policy "Users can insert their own clients" on public.clients for insert with check (auth.uid() = therapist_id);
create policy "Users can update their own clients" on public.clients for update using (auth.uid() = therapist_id);
create policy "Users can delete their own client"  on public.clients for delete using (auth.uid() = therapist_id);

-- appointments
create policy "Allow public read access to video meeting details" on public.appointments for select to public using (true); -- 🔴 world-readable; scope to video_* by id instead
create policy "Users can view their own appointments"   on public.appointments for select using (auth.uid() = therapist_id);
create policy "Users can insert their own appointments" on public.appointments for insert with check (auth.uid() = therapist_id);
create policy "Users can update their own appointments" on public.appointments for update using (auth.uid() = therapist_id);
create policy "Users can delete their own appointments" on public.appointments for delete using (auth.uid() = therapist_id);

-- appointment_requests (writes only via create_public_appointment_request RPC)
create policy "Therapists can view their appointment requests"   on public.appointment_requests for select to authenticated using (therapist_id = auth.uid());
create policy "Therapists can update their appointment requests" on public.appointment_requests for update to authenticated using (therapist_id = auth.uid());

-- push_subscriptions
create policy "Users can view their own push subscriptions"   on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "Users can insert their own push subscriptions" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "Users can update their own push subscriptions" on public.push_subscriptions for update using (auth.uid() = user_id);
create policy "Users can delete their own push subscriptions" on public.push_subscriptions for delete using (auth.uid() = user_id);
create policy "Service role can manage push subscriptions"    on public.push_subscriptions for all using (auth.role() = 'service_role');

-- notification_preferences
create policy "Users can view their own notification preferences"   on public.notification_preferences for select using (auth.uid() = user_id);
create policy "Users can insert their own notification preferences" on public.notification_preferences for insert with check (auth.uid() = user_id);
create policy "Users can update their own notification preferences" on public.notification_preferences for update using (auth.uid() = user_id);
create policy "Service role can manage notification preferences"    on public.notification_preferences for all using (auth.role() = 'service_role');

-- notification_queue
create policy "Users can view their own notification queue"   on public.notification_queue for select using (auth.uid() = user_id);
create policy "Users can update their own notification queue" on public.notification_queue for update using (auth.uid() = user_id);
create policy "Service role can manage notification queue"    on public.notification_queue for all using (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- Storage buckets (both public)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('invoices','invoices',true)
  on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('profile-photos','profile-photos',true)
  on conflict (id) do update set public = true;

create policy "Allow public access to profile photos" on storage.objects for select using (bucket_id = 'profile-photos');
create policy "Allow authenticated users to upload profile photos" on storage.objects for insert to authenticated with check (bucket_id = 'profile-photos' and auth.role() = 'authenticated');
create policy "Allow users to update their own photos" on storage.objects for update to authenticated using (bucket_id = 'profile-photos' and owner = auth.uid());
create policy "Allow users to delete their own photos" on storage.objects for delete to authenticated using (bucket_id = 'profile-photos' and owner = auth.uid());
