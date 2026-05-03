/**
 * News Service — multi-source with localStorage caching and rate-limit protection.
 *
 * Source priority (browser):
 *   1. Backend proxy  GET /api/news  (all 3 APIs behind it, Redis-cached)
 *   2. Guardian direct               (5 000/day, generous, no CORS issue)
 *   3. Stale localStorage cache      (always prefer stale over nothing)
 *   ✗  GNews direct                  (NOT called from browser — shared 100/day budget
 *                                     with the backend; protect it)
 *   ✗  NewsAPI direct                (CORS blocked on developer plan — server-side only)
 *
 * Cache TTL:
 *   - Backend results: 30 min  (matches server Redis TTL)
 *   - Guardian direct: 30 min
 *   - Stale cache is served indefinitely on fetch failure (better than empty)
 */

// ── Config ────────────────────────────────────────────────────────────────────

// Set VITE_BACKEND_URL in your .env to point at the running server.
// Falls back to Sliplane in production, or localhost dev URL in dev.
const DEFAULT_BACKEND = import.meta.env.VITE_BACKEND_URL || 
  (import.meta.env.PROD ? 'https://runcouragerun.life' : 'http://localhost:8000');

export function getBackendUrl() {
  const stored = localStorage.getItem('courage_backend_url');
  // In production, ignore any stale localhost overrides in localStorage
  if (import.meta.env.PROD && stored && stored.includes('localhost')) {
    return DEFAULT_BACKEND;
  }
  return stored || DEFAULT_BACKEND;
}

const CACHE_TTL_MS  = 30 * 60 * 1000;  // 30 minutes — matches server Redis TTL
const GUARDIAN_BASE = 'https://content.guardianapis.com';

// ── Country / category metadata ───────────────────────────────────────────────

export const NEWS_COUNTRIES = {
  us: 'United States', gb: 'United Kingdom', au: 'Australia',
  ca: 'Canada',        de: 'Germany',         fr: 'France',
  jp: 'Japan',         br: 'Brazil',          in: 'India',
  za: 'South Africa',  sg: 'Singapore',       nl: 'Netherlands',
};

export const NEWS_CATEGORIES = [
  'general', 'technology', 'business', 'science',
  'health', 'sports', 'entertainment',
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

// ── Article normalisation ─────────────────────────────────────────────────────

function normaliseGuardian(result) {
  return {
    title:       result.webTitle || '',
    description: result.fields?.trailText || '',
    content:     result.fields?.bodyText || result.fields?.trailText || '',
    url:         result.webUrl || '',
    image:       result.fields?.thumbnail || null,
    publishedAt: result.webPublicationDate || new Date().toISOString(),
    source:      { name: 'The Guardian', url: 'https://www.theguardian.com' },
    provider:    'guardian',
  };
}

/** Backend returns already-normalised articles — pass through. */
function normaliseBackend(article) { return article; }

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

async function fetchFromBackend({ country = 'us', category = 'general', max = 10 } = {}) {
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

// ── Guardian direct fetch (browser-safe, generous limits) ────────────────────

async function fetchFromGuardian({ category = 'general', max = 10 } = {}) {
  const section = category === 'general' ? 'news' : category;
  const tag = `guardian_${section}`;
  const cached = readCache(tag);
  if (cached) return cached;

  const guardianKey = getApiKey('guardian');
  const params = new URLSearchParams({
    'api-key':     guardianKey || 'test',
    section,
    'page-size':   max,
    'show-fields': 'trailText,thumbnail,bodyText',
    'order-by':    'newest',
  });

  const res = await fetch(`${GUARDIAN_BASE}/search?${params}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Guardian ${res.status}`);

  const articles = (await res.json()).response?.results?.map(normaliseGuardian) || [];
  if (articles.length) writeCache(tag, articles);
  return articles;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch top news for a country/category.
 *
 * Priority:
 *   1. Backend proxy (Redis-cached, all 3 APIs, budget-managed)
 *   2. Guardian direct (browser-safe, 5000/day)
 *   3. Stale localStorage cache (any age — better than empty)
 *   4. Sample placeholder articles
 */
export async function fetchTopNews({ country = 'us', category = 'general', max = 10 } = {}) {
  const staleTag = `backend_${country}_${category}`;

  // 1. Backend proxy
  try {
    const articles = await fetchFromBackend({ country, category, max });
    if (articles.length) return articles;
  } catch (err) {
    console.info('[NewsService] Backend unavailable, trying Guardian:', err.message);
  }

  // 2. Guardian direct
  try {
    const articles = await fetchFromGuardian({ category, max });
    if (articles.length) return articles;
  } catch (err) {
    console.warn('[NewsService] Guardian failed:', err.message);
  }

  // 3. Stale cache (any age)
  const stale = readStaleCache(staleTag) || readStaleCache(`guardian_${category === 'general' ? 'news' : category}`);
  if (stale?.length) {
    console.info('[NewsService] Serving stale cache');
    return stale;
  }

  // 4. Sample placeholder
  return getSampleArticles();
}

/**
 * Keyword search — routes through backend (which uses NewsAPI + GNews).
 * If backend is down, returns empty (no direct browser fallback for search).
 */
export async function searchNews(query) {
  const results = await searchViaBackend(query);
  return results.length ? results : [];
}

// ── Sample articles ───────────────────────────────────────────────────────────

export function getSampleArticles() {
  return [
    {
      title: 'Courage Checks The Trenches: No News Yet, Ser',
      description: 'The backend is starting up or no API keys are configured. Real news incoming shortly.',
      content: 'Add your Guardian API key in Settings, or start the backend server to get live news from all 3 sources.',
      url: '#', image: null, publishedAt: new Date().toISOString(),
      source: { name: '$COURAGE News Network', url: '#' }, provider: 'sample',
    },
    {
      title: 'Courage Spotted Living In A Browser, Witnesses Confirm',
      description: 'The cowardly dog has been seen trembling at world events, unable to look away from the TV.',
      content: 'Sources close to Courage report he has been living in a web server since early 2024, surviving on a diet of memes and news headlines.',
      url: '#', image: null, publishedAt: new Date().toISOString(),
      source: { name: '$COURAGE News Network', url: '#' }, provider: 'sample',
    },
    {
      title: 'Solana Meme Dog Refuses To Leave TV, Demands Snacks',
      description: 'Local dog continues to watch the news 24/7. Experts say this is normal behaviour.',
      content: "Courage, the self-aware CSS dog, has reportedly not moved from his TV spot in weeks. 'The things I do for you people...'",
      url: '#', image: null, publishedAt: new Date().toISOString(),
      source: { name: '$COURAGE News Network', url: '#' }, provider: 'sample',
    },
  ];
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
