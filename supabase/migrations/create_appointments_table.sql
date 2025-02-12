create type appointment_type as enum ('video', 'in_person');
create type appointment_status as enum ('scheduled', 'completed', 'cancelled');

create table appointments (
  id uuid default uuid_generate_v4() primary key,
  therapist_id uuid references auth.users on delete cascade not null,
  client_name text not null,
  client_email text not null,
  session_date timestamp with time zone not null,
  session_length integer not null, -- in minutes
  session_type appointment_type not null,
  price decimal(10,2) not null,
  notes text,
  status appointment_status default 'scheduled',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Add constraints
  constraint valid_session_length check (session_length in (30, 60, 90, 120)),
  constraint valid_email check (client_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create updated_at trigger
create trigger appointments_updated_at
  before update on appointments
  for each row
  execute function update_updated_at_column();

-- Enable RLS
alter table appointments enable row level security;

-- Create policies
create policy "Users can view their own appointments"
  on appointments for select
  using (auth.uid() = therapist_id);

create policy "Users can insert their own appointments"
  on appointments for insert
  with check (auth.uid() = therapist_id);

create policy "Users can update their own appointments"
  on appointments for update
  using (auth.uid() = therapist_id);

create policy "Users can delete their own appointments"
  on appointments for delete
  using (auth.uid() = therapist_id); 