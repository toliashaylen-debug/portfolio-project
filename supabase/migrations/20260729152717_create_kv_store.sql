-- Shared key-value store backing "The Desk" app's storage.ts abstraction.
-- Mirrors the original localStorage keys 1:1 (desk-config, history-p1/p2/p3,
-- raw-p1/p2/p3, commentary-log) so no other app code needs to change shape.
create table if not exists public.kv_store (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.kv_store enable row level security;

-- Single shared-password trust model (matches the app's existing client-side
-- gate) rather than per-user auth: anyone with the public anon key can read
-- and write. This is a deliberate, accepted tradeoff, not an oversight.
create policy "anon full access" on public.kv_store
  for all
  to anon
  using (true)
  with check (true);
