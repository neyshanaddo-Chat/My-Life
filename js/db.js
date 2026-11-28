// Local database (IndexedDB). Your data stays on this device.
// Every record carries sync-ready fields so the future Personal Data Hub
// can take it as-is: id, created_at, updated_at, deleted_at, source, rev.

const DB_NAME = 'life-manager';
const DB_VERSION = 1;
const SOURCE = 'life-manager';
export const COLLECTIONS = ['tasks', 'goals', 'notes', 'wellbeing', 'events'];

let dbPromise = null;
const listeners = new Set();

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of COLLECTIONS) {
        if (!db.objectStoreNames.contains(name)) {
          const s = db.createObjectStore(name, { keyPath: 'id' });
          s.createIndex('updated_at', 'updated_at');
        }
      }
      if (!db.objectStoreNames.contains('activity')) {
        const a = db.createObjectStore('activity', { keyPath: 'id', autoIncrement: true });
        a.createIndex('at', 'at');
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(stores, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result;
    Promise.resolve(fn(t)).then((r) => { result = r; })
      .catch((e) => { try { t.abort(); } catch (_) {} reject(e); });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }));

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function changed(collection) { listeners.forEach((fn) => fn(collection)); }

function logInto(t, action, collection, record, summary) {
  t.objectStore('activity').add({
    at: new Date().toISOString(), action, collection,
    record_id: record?.id ?? null, summary: summary ?? record?.title ?? '',
  });
}

/** All live (not deleted) records in a collection. */
export async function all(collection) {
  const rows = await tx([collection], 'readonly', (t) => reqP(t.objectStore(collection).getAll()));
  return rows.filter((r) => !r.deleted_at);
}

export async function get(collection, id) {
  const r = await tx([collection], 'readonly', (t) => reqP(t.objectStore(collection).get(id)));
  return r && !r.deleted_at ? r : null;
}

/** Create or update. Pass `action`/`summary` to control the activity entry. */
export async function save(collection, data, { action, summary, silent } = {}) {
  const now = new Date().toISOString();
  let rec;
  await tx([collection, 'activity'], 'readwrite', async (t) => {
    const store = t.objectStore(collection);
    const existing = data.id ? await reqP(store.get(data.id)) : null;
    rec = existing
      ? { ...existing, ...data, updated_at: now, rev: (existing.rev || 1) + 1 }
      : { ...data, id: data.id || uuid(), created_at: now, updated_at: now, deleted_at: null, source: SOURCE, rev: 1 };
    store.put(rec);
    if (!silent) logInto(t, action || (existing ? 'updated' : 'created'), collection, rec, summary);
  });
  changed(collection);
  return rec;
}

/** Soft delete (kept for sync + history). */
export async function remove(collection, id) {
  const now = new Date().toISOString();
  await tx([collection, 'activity'], 'readwrite', async (t) => {
    const store = t.objectStore(collection);
    const r = await reqP(store.get(id));
    if (!r) return;
    store.put({ ...r, deleted_at: now, updated_at: now, rev: (r.rev || 1) + 1 });
    logInto(t, 'deleted', collection, r);
  });
  changed(collection);
}

export async function recentActivity(limit = 10) {
  return tx(['activity'], 'readonly', (t) => new Promise((resolve) => {
    const out = [];
    const cur = t.objectStore('activity').index('at').openCursor(null, 'prev');
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c || out.length >= limit) return resolve(out);
      out.push(c.value); c.continue();
    };
  }));
}

export async function getSetting(key, fallback = null) {
  const r = await tx(['settings'], 'readonly', (t) => reqP(t.objectStore('settings').get(key)));
  return r ? r.value : fallback;
}

export async function setSetting(key, value) {
  await tx(['settings'], 'readwrite', (t) => { t.objectStore('settings').put({ key, value }); });
  changed('settings');
}

// ---------- Backup (data portability) ----------

export async function exportAll() {
  const out = { app: 'life-manager', format: 1, exported_at: new Date().toISOString(), data: {} };
  const stores = [...COLLECTIONS, 'activity', 'settings'];
  await tx(stores, 'readonly', async (t) => {
    for (const s of stores) out.data[s] = await reqP(t.objectStore(s).getAll());
  });
  return out;
}

/** Merge a backup: newer `updated_at` wins, so importing twice is safe. */
export async function importAll(backup) {
  if (!backup || backup.app !== 'life-manager' || !backup.data) throw new Error('This is not a Life Manager backup file.');
  let count = 0;
  await tx([...COLLECTIONS, 'settings', 'activity'], 'readwrite', async (t) => {
    for (const s of COLLECTIONS) {
      const store = t.objectStore(s);
      for (const rec of backup.data[s] || []) {
        if (!rec || !rec.id) continue;
        const cur = await reqP(store.get(rec.id));
        if (!cur || (rec.updated_at || '') > (cur.updated_at || '')) { store.put(rec); count++; }
      }
    }
    for (const kv of backup.data.settings || []) if (kv && kv.key) t.objectStore('settings').put(kv);
    logInto(t, 'imported', 'backup', null, `${count} records from backup`);
  });
  COLLECTIONS.forEach(changed); changed('settings');
  return count;
}

export async function eraseAll() {
  await tx([...COLLECTIONS, 'activity', 'settings'], 'readwrite', (t) => {
    [...COLLECTIONS, 'activity', 'settings'].forEach((s) => t.objectStore(s).clear());
  });
  COLLECTIONS.forEach(changed); changed('settings');
}
