-- Create enums if they don't exist
do $$ begin
    create type professional_type as enum ('psychologist', 'therapist', 'coach');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type session_type as enum ('video', 'in_person', 'hybrid');
exception
    when duplicate_object then null;
end $$;

-- Add new columns to existing profiles table
alter table if exists profiles
  add column if not exists full_name text,
  add column if not exists photo_url text,
  add column if not exists professional_type professional_type,
  add column if not exists working_hours jsonb,
  add column if not exists session_length integer,
  add column if not exists session_type session_type,
  add column if not exists collect_payments boolean default false,
  add column if not exists price_per_session decimal(10,2),
  add column if not exists location jsonb,
  add column if not exists is_onboarding_complete boolean default false,
  add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());

-- Drop the existing constraint if it exists
alter table if exists profiles
  drop constraint if exists phone_number_format;

-- Drop the phone_number column and its constraint
alter table if exists profiles
  drop column if exists phone_number;

-- Create updated_at trigger if it doesn't exist
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

do $$ begin
    create trigger update_profiles_updated_at
        before update on profiles
        for each row
        execute function update_updated_at_column();
exception
    when duplicate_object then null;
end $$;

-- Enable RLS if not already enabled
alter table if exists profiles enable row level security;

-- Drop existing policies if any
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;

-- Create new policies
create policy "Users can view own profile"
  on profiles for select
  using ( auth.uid() = id );

create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

create policy "Users can insert own profile"
  on profiles for insert
  with check ( auth.uid() = id ); 