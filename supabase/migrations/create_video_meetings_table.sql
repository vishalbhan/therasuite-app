create table video_meetings (
  id uuid default uuid_generate_v4() primary key,
  appointment_id uuid references appointments(id) on delete cascade not null,
  meeting_id text not null,
  therapist_token text not null,
  client_token text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table video_meetings enable row level security;

-- Create policies
create policy "Users can view their own video meetings"
  on video_meetings for select
  using (
    auth.uid() in (
      select therapist_id 
      from appointments 
      where id = appointment_id
    )
  ); 