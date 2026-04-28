/**
 * News Service — GNews API with localStorage caching
 * Free tier: 100 requests/day. User provides their own API key.
 * Sign up free at: https://gnews.io
 *
 * Fallback: The Guardian API (unlimited free, requires key from open-platform.theguardian.com)
 */

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const GNEWS_BASE = 'https://gnews.io/api/v4';
const GUARDIAN_BASE = 'https://content.guardianapis.com';

const GNEWS_COUNTRIES = {
  us: 'United States', gb: 'United Kingdom', au: 'Australia',
  ca: 'Canada', de: 'Germany', fr: 'France', jp: 'Japan',
  br: 'Brazil', in: 'India', za: 'South Africa',
};

const GNEWS_CATEGORIES = [
  'general', 'world', 'nation', 'business', 'technology',
  'entertainment', 'sports', 'science', 'health',
];

export const NEWS_COUNTRIES = GNEWS_COUNTRIES;
export const NEWS_CATEGORIES = GNEWS_CATEGORIES;

// ── Storage helpers ──────────────────────────────────────────────────────────

function cacheKey(tag) {
  return `courage_news_${tag}`;
}

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
  } catch {
    return null;
  }
}

function writeCache(tag, data) {
  try {
    localStorage.setItem(cacheKey(tag), JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // storage full — silently skip
  }
}

// ── API key helpers ──────────────────────────────────────────────────────────

export function getStoredKeys() {
  try {
    return JSON.parse(localStorage.getItem('courage_api_keys') || '{}');
  } catch {
    return {};
  }
}

export function saveApiKey(provider, key) {
  const keys = getStoredKeys();
  keys[provider] = key;
  localStorage.setItem('courage_api_keys', JSON.stringify(keys));
}

export function getApiKey(provider) {
  return getStoredKeys()[provider] || '';
}

// ── Normalise articles to a common shape ─────────────────────────────────────

function normaliseGNews(article) {
  return {
    title: article.title || '',
    description: article.description || '',
    content: article.content || article.description || '',
    url: article.url || '',
    image: article.image || null,
    publishedAt: article.publishedAt || new Date().toISOString(),
    source: {
      name: article.source?.name || 'Unknown',
      url: article.source?.url || '',
    },
  };
}

function normaliseGuardian(result) {
  return {
    title: result.webTitle || '',
    description: result.fields?.trailText || '',
    content: result.fields?.bodyText || result.fields?.trailText || '',
    url: result.webUrl || '',
    image: result.fields?.thumbnail || null,
    publishedAt: result.webPublicationDate || new Date().toISOString(),
    source: { name: 'The Guardian', url: 'https://www.theguardian.com' },
  };
}

// ── GNews fetch ──────────────────────────────────────────────────────────────

async function fetchFromGNews(apiKey, { country = 'us', category = 'general', max = 10 } = {}) {
  const tag = `gnews_${country}_${category}`;
  const cached = readCache(tag);
  if (cached) return cached;

  const params = new URLSearchParams({
    token: apiKey,
    lang: 'en',
    country,
    topic: category === 'general' ? 'breaking-news' : category,
    max,
  });

  const res = await fetch(`${GNEWS_BASE}/top-headlines?${params}`);
  if (!res.ok) throw new Error(`GNews error ${res.status}: ${await res.text()}`);

  const json = await res.json();
  const articles = (json.articles || []).map(normaliseGNews);
  writeCache(tag, articles);
  return articles;
}

// ── Guardian fetch ───────────────────────────────────────────────────────────

async function fetchFromGuardian(apiKey, { category = 'news', max = 10 } = {}) {
  const section = category === 'general' ? 'news' : category;
  const tag = `guardian_${section}`;
  const cached = readCache(tag);
  if (cached) return cached;

  const params = new URLSearchParams({
    'api-key': apiKey || 'test', // 'test' key works for low-volume dev use
    section,
    'page-size': max,
    'show-fields': 'trailText,thumbnail,bodyText',
    'order-by': 'newest',
  });

  const res = await fetch(`${GUARDIAN_BASE}/search?${params}`);
  if (!res.ok) throw new Error(`Guardian error ${res.status}`);

  const json = await res.json();
  const articles = (json.response?.results || []).map(normaliseGuardian);
  writeCache(tag, articles);
  return articles;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch top news articles.
 * Tries GNews first (if key present), falls back to Guardian.
 */
export async function fetchTopNews({ country = 'us', category = 'general', max = 10 } = {}) {
  const gnewsKey = getApiKey('gnews');
  const guardianKey = getApiKey('guardian');

  if (gnewsKey) {
    try {
      return await fetchFromGNews(gnewsKey, { country, category, max });
    } catch (err) {
      console.warn('[NewsService] GNews failed, trying Guardian:', err.message);
    }
  }

  // Guardian fallback (also works with 'test' key for low-volume)
  try {
    return await fetchFromGuardian(guardianKey, { category, max });
  } catch (err) {
    console.warn('[NewsService] Guardian failed:', err.message);
    return getSampleArticles();
  }
}

/**
 * Search news by keyword.
 */
export async function searchNews(query) {
  const gnewsKey = getApiKey('gnews');
  if (!gnewsKey) return getSampleArticles();

  const tag = `gnews_search_${query.slice(0, 30)}`;
  const cached = readCache(tag);
  if (cached) return cached;

  const params = new URLSearchParams({
    token: gnewsKey,
    lang: 'en',
    q: query,
    max: 10,
  });

  try {
    const res = await fetch(`${GNEWS_BASE}/search?${params}`);
    if (!res.ok) throw new Error(`GNews search error ${res.status}`);
    const json = await res.json();
    const articles = (json.articles || []).map(normaliseGNews);
    writeCache(tag, articles);
    return articles;
  } catch (err) {
    console.warn('[NewsService] Search failed:', err.message);
    return [];
  }
}

// ── Sample articles (shown before API key is configured) ─────────────────────

export function getSampleArticles() {
  return [
    {
      title: "Courage Checks The Trenches: No API Key Yet, Ser",
      description: "Configure your free GNews or Guardian API key to get real news. It takes 30 seconds and it's completely free.",
      content: "Go to gnews.io or open-platform.theguardian.com, grab a free key, and paste it in the Settings panel. Courage will start reacting to REAL news immediately after!",
      url: '#',
      image: null,
      publishedAt: new Date().toISOString(),
      source: { name: '$COURAGE News Network', url: '#' },
    },
    {
      title: "Courage Spotted Living In A Browser, Witnesses Confirm",
      description: "The cowardly dog has been seen trembling at world events, unable to look away from the TV.",
      content: "Sources close to Courage report he has been living in a web server since early 2024, surviving on a diet of memes and news headlines. He is doing his best.",
      url: '#',
      image: null,
      publishedAt: new Date().toISOString(),
      source: { name: '$COURAGE News Network', url: '#' },
    },
    {
      title: "Solana Meme Dog Refuses To Leave TV, Demands Snacks",
      description: "Local dog continues to watch the news 24/7. Experts say this is normal behaviour for a Solana blockchain mascot.",
      content: "Courage, the self-aware CSS dog, has reportedly not moved from his TV spot in weeks. When asked for comment, he said: 'The things I do for you people...'",
      url: '#',
      image: null,
      publishedAt: new Date().toISOString(),
      source: { name: '$COURAGE News Network', url: '#' },
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
