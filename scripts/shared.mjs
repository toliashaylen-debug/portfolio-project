// Shared helpers for the offline Bloomberg pipeline scripts. These run on your
// machine (Node), never in the browser.
export const SUPABASE_URL = 'https://pjrjrggyohuilvpueedb.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqcmpyZ2d5b2h1aWx2cHVlZWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMzYxODcsImV4cCI6MjEwMDkxMjE4N30.irQU5gk64XmKU5nAOiBxQ0DwD807QT-hDf0ajpnnsLg';

export const PORTFOLIO_IDS = ['p1', 'p2', 'p3'];

// Mirrors PORTFOLIO_SOURCING in src/lib/constants.ts — kept here for the
// human-readable export spec.
export const SOURCE_SHEETS = {
  p1: 'Cover Page only',
  p2: 'Active Portfolio only',
  p3: 'its single sheet (unrestricted)',
};

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export async function kvGet(key) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers });
  if (!res.ok) throw new Error(`kvGet ${key} failed: HTTP ${res.status}`);
  const rows = await res.json();
  return rows.length ? rows[0].value : null;
}

export async function kvSet(key, value) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`kvSet ${key} failed: HTTP ${res.status} ${await res.text()}`);
}

export async function fetchHistory(id) {
  const raw = await kvGet(`history-${id}`);
  return raw ? JSON.parse(raw) : null;
}
