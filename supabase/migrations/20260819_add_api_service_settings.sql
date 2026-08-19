create table if not exists public.api_service_settings (
  service_id text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.api_service_settings enable row level security;

insert into public.api_service_settings (service_id, enabled)
values ('api_electricity_enabled', false)
on conflict (service_id) do nothing;
