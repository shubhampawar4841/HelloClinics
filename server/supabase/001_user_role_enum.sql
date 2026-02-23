-- Run this in Supabase SQL Editor if profiles.role enum does not exist.
-- Creates user_role enum for profiles.role (admin, doctor, staff).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('admin', 'doctor', 'staff');
  END IF;
END$$;

-- If your profiles table already has a different enum name, alter the column instead:
-- ALTER TABLE public.profiles
--   ALTER COLUMN role TYPE public.user_role USING role::text::public.user_role;
