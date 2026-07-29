// Shared persistence: backs the app's key-value storage.ts abstraction with
// a Supabase Postgres table (kv_store) instead of per-browser localStorage,
// so everyone who opens the deployed site reads/writes the same data. See
// supabase/migrations/20260729152717_create_kv_store.sql for the schema.
// Signatures are kept async/shaped the same as before so call sites didn't
// need to change.
import { createClient } from '@supabase/supabase-js';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface KvRow {
  key: string;
  value: string;
}

type KeyChangeListener = (value: string | null) => void;

const keyListeners = new Map<string, Set<KeyChangeListener>>();
let realtimeStarted = false;

function ensureRealtimeChannel() {
  if (realtimeStarted) return;
  realtimeStarted = true;
  supabase
    .channel('kv_store-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kv_store' }, (payload: RealtimePostgresChangesPayload<KvRow>) => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Partial<KvRow>;
      if (!row || !row.key) return;
      const value = payload.eventType === 'DELETE' ? null : (row.value ?? null);
      const listeners = keyListeners.get(row.key);
      if (listeners) listeners.forEach((cb) => cb(value));
    })
    .subscribe();
}

// Live sync: calls `callback` with the new value (or null if deleted)
// whenever another browser/device changes this key, on top of a single
// shared realtime channel. Returns an unsubscribe function.
export function onKeyChange(key: string, callback: KeyChangeListener): () => void {
  ensureRealtimeChannel();
  if (!keyListeners.has(key)) keyListeners.set(key, new Set());
  keyListeners.get(key)!.add(callback);
  return () => {
    keyListeners.get(key)?.delete(callback);
  };
}

export async function safeGet(key: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('kv_store').select('value').eq('key', key).maybeSingle();
    if (error) { console.error('storage.get failed for', key, error); return null; }
    return data ? data.value : null;
  } catch (e) {
    console.error('storage.get failed for', key, e);
    return null;
  }
}

export async function safeSet(key: string, value: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('kv_store').upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) { console.error('storage.set failed for', key, error); return false; }
    return true;
  } catch (e) {
    console.error('storage.set failed for', key, e);
    return false;
  }
}

export async function verifiedSet(key: string, value: string): Promise<boolean> {
  const ok = await safeSet(key, value);
  if (!ok) return false;
  const readBack = await safeGet(key);
  return readBack === value;
}

export async function safeDelete(key: string): Promise<void> {
  try {
    const { error } = await supabase.from('kv_store').delete().eq('key', key);
    if (error) console.error('storage.delete failed for', key, error);
  } catch (e) {
    console.error('storage.delete failed for', key, e);
  }
}
