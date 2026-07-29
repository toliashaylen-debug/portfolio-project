// Public by design: Supabase's anon key is meant to be embedded in
// client-side code (same trust model as the app's existing password gate —
// this table has an open "anon full access" RLS policy, see
// supabase/migrations/20260729152717_create_kv_store.sql).
export const SUPABASE_URL = 'https://pjrjrggyohuilvpueedb.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqcmpyZ2d5b2h1aWx2cHVlZWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMzYxODcsImV4cCI6MjEwMDkxMjE4N30.irQU5gk64XmKU5nAOiBxQ0DwD807QT-hDf0ajpnnsLg';
