-- Adds kv_store to the realtime publication so the app can subscribe to
-- postgres_changes and push live updates to every open tab/device instead
-- of requiring a manual refresh.
alter publication supabase_realtime add table public.kv_store;
