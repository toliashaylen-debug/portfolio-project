// Front-end-only persistence: swaps the original Claude.ai `window.storage`
// key-value API for plain localStorage. Signatures are kept async/shaped the
// same as the original so call sites didn't need to change.

export async function safeGet(key: string): Promise<string | null> {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function safeSet(key: string, value: string): Promise<boolean> {
  try {
    window.localStorage.setItem(key, value);
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
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
