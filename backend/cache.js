// Tiny in-memory TTL cache for hot read endpoints (members list, stats).
// These endpoints are read far more than they are written, and at our hosting
// region each DB round-trip is costly, so caching the result for a few seconds
// turns repeat page loads from seconds into milliseconds. The cache is cleared
// on ANY write (see clear() calls in the member/repayment routes), so a reader
// never sees data older than the last change.
const store = new Map();

function get(key) {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { store.delete(key); return null; }
  return e.val;
}

// Default 2 minutes. This is safe because every write clears the whole cache,
// so the only thing the TTL guards against is data changed OUTSIDE the app
// (e.g. a manual SQL edit in Supabase) - which is rare and tolerable for 2 min.
function set(key, val, ttlMs = 120000) {
  store.set(key, { val, exp: Date.now() + ttlMs });
}

// Drop everything. Called after any create/update/delete/disburse/repayment so
// the next read rebuilds from fresh data.
function clear() { store.clear(); }

module.exports = { get, set, clear };
