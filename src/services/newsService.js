/**
 * News Service — sourced crypto headlines with localStorage caching.
 *
 * Source priority (browser):
 *   1. Backend proxy GET /api/news (CoinDesk API/RSS, shared server cache)
 *   2. Stale localStorage cache (always prefer sourced stale data over invention)
 *
 * Cache TTL:
 *   - Backend results: 30 min
 *   - Stale cache is served indefinitely on fetch failure (better than empty)
 */

// ── Config ────────────────────────────────────────────────────────────────────

// Set VITE_BACKEND_URL in your .env to point at the running server.
// Production is served by the same FastAPI container, so same-origin avoids
// stale deployment hostnames and unnecessary CORS configuration.
const PRODUCTION_BACKEND = typeof window !== 'undefined'
  ? window.location.origin
  : 'https://hoodcourage.xyz';
const DEFAULT_BACKEND = import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.PROD ? PRODUCTION_BACKEND : 'http://localhost:8000');

export function getBackendUrl() {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:8000';
  }
  const stored = localStorage.getItem('courage_backend_url');
  // The production image serves frontend and backend together; reject stale
  // cross-origin overrides left behind by earlier deployments.
  if (import.meta.env.PROD && stored && stored !== PRODUCTION_BACKEND) {
    return DEFAULT_BACKEND;
  }
  return stored || DEFAULT_BACKEND;
}

const CACHE_TTL_MS = 30 * 60 * 1000;

// ── Country / category metadata ───────────────────────────────────────────────

export const NEWS_COUNTRIES = {
  crypto: 'Robinhood Crypto',
};

export const NEWS_CATEGORIES = [
  'crypto', 'memes', 'bitcoin', 'ethereum', 'macro', 'defi',
];

// ── localStorage cache helpers ────────────────────────────────────────────────

function cacheKey(tag) { return `courage_news_${tag}`; }

function readCache(tag) {
  try {
    const raw = localStorage.getItem(cacheKey(tag));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(tag));
      return null;
    }
    return data;
  } catch { return null; }
}

/** Read cache regardless of TTL — used as last-resort stale fallback. */
function readStaleCache(tag) {
  try {
    const raw = localStorage.getItem(cacheKey(tag));
    if (!raw) return null;
    return JSON.parse(raw).data;
  } catch { return null; }
}

function writeCache(tag, data) {
  try {
    localStorage.setItem(cacheKey(tag), JSON.stringify({ ts: Date.now(), data }));
  } catch { /* storage full — skip silently */ }
}

// ── API key / config helpers ──────────────────────────────────────────────────

export function getStoredKeys() {
  try { return JSON.parse(localStorage.getItem('courage_api_keys') || '{}'); }
  catch { return {}; }
}

export function saveApiKey(provider, key) {
  const keys = getStoredKeys();
  keys[provider] = key;
  localStorage.setItem('courage_api_keys', JSON.stringify(keys));
}

export function getApiKey(provider) {
  return getStoredKeys()[provider] || '';
}

export function saveBackendUrl(url) {
  localStorage.setItem('courage_backend_url', url.replace(/\/$/, ''));
}

/** Map the server's shared article schema to the Chronicle component contract. */
function normaliseBackend(article) {
  return {
    ...article,
    image: article.image || article.image_url || null,
    publishedAt: article.publishedAt || article.published_at || null,
    source: article.source || {
      name: article.source_name || 'CoinDesk',
      url: article.source_url || '',
    },
  };
}

// ── Backend proxy fetch ───────────────────────────────────────────────────────

let _backendAvailable = null;   // null = untested, true/false = tested

async function checkBackend() {
  if (_backendAvailable !== null) return _backendAvailable;
  try {
    const res = await fetch(`${getBackendUrl()}/health`, { signal: AbortSignal.timeout(2000) });
    _backendAvailable = res.ok;
  } catch {
    _backendAvailable = false;
  }
  // Re-check every 5 minutes
  setTimeout(() => { _backendAvailable = null; }, 5 * 60 * 1000);
  return _backendAvailable;
}

async function fetchFromBackend({ country = 'crypto', category = 'crypto', max = 10 } = {}) {
  const tag = `backend_${country}_${category}`;
  const cached = readCache(tag);
  if (cached) return cached;

  if (!(await checkBackend())) throw new Error('Backend unavailable');

  const url = `${getBackendUrl()}/api/news?country=${country}&category=${category}&limit=${max}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Backend /api/news ${res.status}`);

  const articles = (await res.json()).map(normaliseBackend);
  if (articles.length) writeCache(tag, articles);
  return articles;
}

export async function searchViaBackend(query) {
  if (!(await checkBackend())) return [];
  try {
    const res = await fetch(
      `${getBackendUrl()}/api/news/search?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    return (await res.json()).map(normaliseBackend);
  } catch { return []; }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch top news for a country/category.
 *
 * Priority:
 *   1. Backend proxy (shared CoinDesk cache, API/RSS fallback)
 *   2. Stale localStorage cache (any age — sourced data is better than invention)
 */
export async function fetchTopNews({ country = 'crypto', category = 'crypto', max = 10 } = {}) {
  const staleTag = `backend_${country}_${category}`;

  // 1. Backend proxy
  try {
    const articles = await fetchFromBackend({ country, category, max });
    if (articles.length) return articles;
  } catch (err) {
    console.info('[NewsService] Crypto backend unavailable:', err.message);
  }

  // 2. Stale cache (any age)
  const stale = readStaleCache(staleTag);
  if (stale?.length) {
    console.info('[NewsService] Serving stale cache');
    return stale;
  }

  return [];
}

/**
 * Keyword search over the server's shared sourced-crypto cache.
 * If backend is down, returns empty (no direct browser fallback for search).
 */
export async function searchNews(query) {
  const results = await searchViaBackend(query);
  return results.length ? results : [];
}

export function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
