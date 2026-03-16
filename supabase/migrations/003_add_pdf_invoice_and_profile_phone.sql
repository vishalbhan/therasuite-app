alter table public.appointments
add column if not exists pdf_invoice text;

alter table public.profiles
add column if not exists phone_number text;

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', true)
on conflict (id)
do update set public = true;
