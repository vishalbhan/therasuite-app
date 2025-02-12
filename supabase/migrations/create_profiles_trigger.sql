-- Create a trigger to create profile on user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, is_onboarding_complete)
  values (new.id, false);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user(); 