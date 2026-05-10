-- A3: Enhanced Notes - add session_notes and people_of_note columns to characters table
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS session_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS people_of_note jsonb NOT NULL DEFAULT '[]'::jsonb;
