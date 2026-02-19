-- Backfill profiles for users who existed before the profiles table was created.
-- The trigger only fires on new signups, so existing users need a manual insert.
INSERT INTO public.profiles (user_id, display_name, email)
SELECT
  id,
  COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    split_part(email, '@', 1)
  ),
  email
FROM auth.users
ON CONFLICT (user_id) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email;
