-- Contact number + per-channel notification opt-ins for outbound notifications.
--
-- email_opt_in defaults on (users provided email at signup; transactional mail
-- to our own users). sms/whatsapp default off — they require explicit consent,
-- recorded via whatsapp_consent_at when the WhatsApp opt-in is enabled.
--
-- No new RLS policy needed: the existing "Users can update their own account"
-- policy (20260512000014_review_fixes.sql) permits self-updates to any column
-- except is_admin, which covers these.
alter table public.accounts
  add column phone text,
  add column email_opt_in boolean not null default true,
  add column sms_opt_in boolean not null default false,
  add column whatsapp_opt_in boolean not null default false,
  add column whatsapp_consent_at timestamptz;
