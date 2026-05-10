-- delete_my_account: lets a user delete their own account atomically.
-- Deletes from auth.users (which cascades to public.accounts via FK on delete cascade,
-- and from there to all character data via cascade).
-- SECURITY DEFINER so we can write to auth.users; auth.uid() scopes it to the caller.
-- NOTE: search_path = '' to prevent search_path injection; all references are fully qualified.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Only authenticated users can call this (they can only delete themselves)
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
