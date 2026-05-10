-- Add extra_languages column to characters for user-added learned languages
-- Native languages come from the kindred data (rules-engine), not stored here.
-- This column stores any ADDITIONAL languages learned (via INT modifier bonus slots, training, etc.)
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS extra_languages jsonb NOT NULL DEFAULT '[]'::jsonb;
