import { getBackendUrl } from './newsService';

const CACHE_KEY = 'courage_robinhood_chain_snapshot_v2';
const MEMORY_TTL_MS = 30_000;
const STALE_LIMIT_MS = 24 * 60 * 60 * 1000;

let memorySnapshot = null;
let memoryTimestamp = 0;
let inFlightRequest = null;
const snapshotSubscribers = new Set();

const emptySnapshot = (status = 'unavailable') => ({
  stats: [],
  movers: { gainers: [], dumpers: [], top_gainer: null },
  metadata: {
    status,
    is_live: false,
    fetched_at: null,
    age_seconds: null,
    provider: 'DexScreener',
    chain: 'Robinhood Chain',
  },
});

function readStoredSnapshot({ allowStale = false } = {}) {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!parsed?.savedAt || !parsed?.snapshot) return null;
    const age = Date.now() - parsed.savedAt;
    if (age > STALE_LIMIT_MS || (!allowStale && age > MEMORY_TTL_MS)) return null;
    return {
      ...parsed.snapshot,
      metadata: {
        ...parsed.snapshot.metadata,
        status: age > MEMORY_TTL_MS ? 'stale-browser-cache' : 'browser-cache',
        is_live: false,
        age_seconds: Math.max(0, Math.floor(age / 1000)),
      },
    };
  } catch {
    return null;
  }
}

function storeSnapshot(snapshot) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), snapshot }));
  } catch {
    // Storage may be disabled or full; the in-memory snapshot still works.
  }
}

function publishSnapshot(snapshot, { persist = false } = {}) {
  memorySnapshot = snapshot;
  memoryTimestamp = Date.now();
  if (persist && snapshot.stats.length) storeSnapshot(snapshot);
  snapshotSubscribers.forEach((subscriber) => subscriber(snapshot));
  return snapshot;
}

export function subscribeTokenSnapshot(subscriber) {
  snapshotSubscribers.add(subscriber);
  return () => snapshotSubscribers.delete(subscriber);
}

export function getCachedTokenSnapshot() {
  if (memorySnapshot) return memorySnapshot;
  return readStoredSnapshot({ allowStale: true }) || emptySnapshot('idle');
}

export function resolveTokenLogoUrl(token) {
  if (!token?.logo_url) return null;
  if (/^https?:\/\//i.test(token.logo_url)) return token.logo_url;
  return `${getBackendUrl()}${token.logo_url.startsWith('/') ? '' : '/'}${token.logo_url}`;
}

export async function fetchRobinhoodTokenSnapshot({ force = false } = {}) {
  const now = Date.now();
  if (!force && memorySnapshot && now - memoryTimestamp < MEMORY_TTL_MS) {
    return memorySnapshot;
  }
  // A manual refresh may bypass the warm browser cache, but it must still join
  // an existing request instead of producing a second backend/API refresh.
  if (inFlightRequest) return inFlightRequest;

  inFlightRequest = (async () => {
    try {
      const response = await fetch(`${getBackendUrl()}/api/robinhood-crypto`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Robinhood Chain pulse ${response.status}`);
      const payload = await response.json();
      const snapshot = {
        stats: Array.isArray(payload.stats) ? payload.stats : [],
        movers: payload.movers || { gainers: [], dumpers: [], top_gainer: null },
        metadata: payload.metadata || emptySnapshot().metadata,
      };
      return publishSnapshot(snapshot, { persist: true });
    } catch (error) {
      const stale = memorySnapshot || readStoredSnapshot({ allowStale: true });
      if (stale) {
        const fallback = {
          ...stale,
          metadata: {
            ...stale.metadata,
            status: 'stale-browser-cache',
            is_live: false,
          },
        };
        snapshotSubscribers.forEach((subscriber) => subscriber(fallback));
        return fallback;
      }
      console.warn('[TokenService] Robinhood Chain pulse unavailable:', error.message);
      const unavailable = emptySnapshot();
      snapshotSubscribers.forEach((subscriber) => subscriber(unavailable));
      return unavailable;
    } finally {
      inFlightRequest = null;
    }
  })();

  return inFlightRequest;
}

export function getWorldEligibleTokens(snapshot) {
  return (snapshot?.stats || []).filter(token => token.world_eligible && token.logo_url);
}
