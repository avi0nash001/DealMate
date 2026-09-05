-- Adds support for caching live-searched products alongside seed products.
-- Run this against your Supabase/Lovable Cloud database (via the Lovable
-- editor's database/migration tool, or however you've been applying the
-- existing migrations in drizzle/migrations/).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS external_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS image_url text;
