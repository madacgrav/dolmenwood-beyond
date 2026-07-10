-- Outbound delivery outbox for notifications.
--
-- One row per (notification, channel): the app-level dispatch path enqueues
-- pending rows and marks them sent/failed after calling the provider
-- (Resend for email; Twilio for SMS/WhatsApp later). The unique key makes
-- enqueueing idempotent — overlapping drain runs cannot double-send.
--
-- Deliberately NOT driven by a Postgres trigger: the project is migrating
-- off Supabase, so dispatch is plain app code over a portable table.
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('email','sms','whatsapp')),
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  sent_at timestamptz,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  unique (notification_id, channel)
);

create index idx_notification_deliveries_status on public.notification_deliveries(status);

-- Service-role-only: all reads/writes go through the dispatch path.
-- RLS enabled with no user policies, mirroring proposal_availability.
alter table public.notification_deliveries enable row level security;
