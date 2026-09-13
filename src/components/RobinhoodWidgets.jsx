import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaChartLine, FaNewspaper, FaBrain, FaSync, FaExternalLinkAlt } from 'react-icons/fa';
import { getBackendUrl } from '../services/newsService';
import {
  fetchRobinhoodTokenSnapshot,
  getCachedTokenSnapshot,
  resolveTokenLogoUrl,
  subscribeTokenSnapshot,
} from '../services/tokenService';

const API_BASE = getBackendUrl();
const LANDING_TOKEN_LIMIT = 10;

// ── Widget 1: Robinhood Chain discovery pulse (sorted live data) ─────────────
export const LiveMarketWidget = () => {
  const [data, setData] = useState(getCachedTokenSnapshot);
  const [loading, setLoading] = useState(false);

  const fetchStats = async (force = false) => {
    setLoading(true);
    try {
      setData(await fetchRobinhoodTokenSnapshot({ force }));
    } catch (err) {
      console.warn('Failed to fetch Robinhood stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeTokenSnapshot(setData);
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const rawStats = data?.stats || [];
  const sortedStats = [...rawStats].sort((a, b) => {
    if (b.is_trending !== a.is_trending) return b.is_trending ? 1 : -1;
    return (b.change_24h || 0) - (a.change_24h || 0);
  });
  const visibleStats = sortedStats.slice(0, LANDING_TOKEN_LIMIT);

  return (
    <div className="glass-card-v2 market-pulse-card">
      <div className="market-pulse-header">
        <div>
          <h2 className="market-pulse-title">
            <FaChartLine color="#ccff00" /> 🟢 LIVE ROBINHOOD CHAIN DISCOVERY PULSE
          </h2>
          <p className="market-pulse-subtitle">
            Robinhood Chain discovery pulse via DexScreener · {data?.metadata?.status || 'connecting'}
          </p>
        </div>
        <button
          className="market-pulse-refresh"
          onClick={() => fetchStats(true)}
          disabled={loading}
        >
          <FaSync className={loading ? 'spin' : ''} /> {loading ? 'FETCHING...' : 'REFRESH PULSE'}
        </button>
      </div>

      <div className="market-token-grid" aria-label={`Top ${LANDING_TOKEN_LIMIT} token signals`}>
        {sortedStats.length === 0 ? (
          <div className="market-token-empty">
            Waiting for a Robinhood Chain discovery snapshot...
          </div>
        ) : (
          visibleStats.map((coin) => {
            const isPos = (coin.change_24h || 0) >= 0;
            return (
              <motion.div
                key={coin.id || coin.symbol}
                className={`market-token-card market-token-card--${isPos ? 'positive' : 'negative'}`}
                whileHover={{ scale: 1.03, translateY: -4 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div className="market-token-topline">
                  <div className="market-token-identity">
                    {coin.logo_url && (
                      <img
                        src={resolveTokenLogoUrl(coin)}
                        alt=""
                        className="market-token-logo"
                        onError={(event) => { event.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <span className="market-token-symbol">
                      {coin.symbol}
                    </span>
                    {coin.is_boosted && (
                      <span className="market-token-boosted">
                        🔥 BOOSTED
                      </span>
                    )}
                  </div>
                  <span className={`market-token-change market-token-change--${isPos ? 'positive' : 'negative'}`}>
                    {isPos ? '+' : ''}{Number(coin.change_24h || 0).toFixed(2)}%
                  </span>
                </div>

                <div className="market-token-price">
                  ${Number(coin.price || 0) < 0.01
                    ? Number(coin.price || 0).toFixed(6)
                    : Number(coin.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>

                <div className="market-token-meta">
                  <span>Vol: ${coin.volume_24h ? (coin.volume_24h / 1e6).toFixed(1) + 'M' : '—'}</span>
                  <span>MCap: ${coin.market_cap ? (coin.market_cap / 1e9).toFixed(2) + 'B' : '—'}</span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ── Widget 2: Latest Generated Breaking News Card (From Local DB) ────────────
export const LatestNewsCardWidget = () => {
  const [latestCard, setLatestCard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/news-posters?limit=1`);
        if (res.ok) {
          const posters = await res.json();
          if (posters && posters.length > 0) {
            const first = posters[0];
            const url = typeof first === 'string' ? `${API_BASE}${first}` : `${API_BASE}${first.url}`;
            setLatestCard({ url, name: typeof first === 'string' ? first.split('/').pop() : 'Latest News Poster' });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch latest news poster:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLatest();
  }, []);

  return (
    <div className="glass-card-v2" style={{
      background: 'rgba(10, 15, 10, 0.85)',
      backdropFilter: 'blur(16px)',
      border: '2px solid #ccff00',
      borderRadius: '24px',
      padding: '2rem',
      boxShadow: '0 0 30px rgba(204, 255, 0, 0.25)',
      marginBottom: '2rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Bangers, cursive', color: '#ccff00', fontSize: '2rem', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FaNewspaper color="#ccff00" /> LATEST GENERATED NEWS CARD
          </h2>
          <p style={{ margin: '4px 0 0', opacity: 0.7, fontSize: '0.85rem', color: '#ccc' }}>
            Freshly generated Courage News Chronicle poster stored in local DB
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', alignItems: 'center' }}>
        <div style={{
          borderRadius: '16px',
          overflow: 'hidden',
          border: '2px solid rgba(204, 255, 0, 0.3)',
          background: '#000',
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
          maxHeight: '380px',
          display: 'flex',
          justifyContent: 'center'
        }}>
          {loading ? (
            <div style={{ padding: '4rem', color: '#ccff00', textAlign: 'center' }}>Rendering Card Preview...</div>
          ) : latestCard?.url ? (
            <img
              src={latestCard.url}
              alt="Latest Generated News Card"
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.5, color: '#aaa' }}>
              No generated poster in local DB yet. Courage will create one on the next news reaction!
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#ccff00', textTransform: 'uppercase', letterSpacing: '1px' }}>
              🟢 AUTOMATED NEWS POSTER PIPELINE
            </span>
            <h3 style={{ margin: '8px 0 4px', fontSize: '1.2rem', color: '#fff' }}>
              Courage Forest News Dispatch
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.75, color: '#ccc', lineHeight: 1.5 }}>
              Courage automatically transforms breaking Robinhood crypto news & X trench discussions into custom green news cards ready for Twitter dispatch.
            </p>
          </div>

          {latestCard?.url && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <a
                href={latestCard.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1,
                  background: '#ccff00',
                  color: '#000',
                  padding: '0.8rem',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 0 15px rgba(204, 255, 0, 0.4)'
                }}
              >
                <FaExternalLinkAlt /> View Full Resolution
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Widget 3: Courage Brain & World Intelligence Pulse ────────────────────────
export const BrainPulseWidget = () => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/system-status`);
        if (res.ok) {
          const json = await res.json();
          setStatus(json);
        }
      } catch (err) {
        console.warn('Failed to fetch status:', err);
      }
    };
    fetchStatus();
  }, []);

  return (
    <div className="glass-card-v2" style={{
      background: 'rgba(10, 15, 10, 0.85)',
      backdropFilter: 'blur(16px)',
      border: '2px solid #ccff00',
      borderRadius: '24px',
      padding: '2rem',
      boxShadow: '0 0 30px rgba(204, 255, 0, 0.25)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Bangers, cursive', color: '#ccff00', fontSize: '2rem', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FaBrain color="#ccff00" /> COURAGE BRAIN & WORLD PULSE
          </h2>
          <p style={{ margin: '4px 0 0', opacity: 0.7, fontSize: '0.85rem', color: '#ccc' }}>
            Real-time autonomous intelligence status, sensor frequency & agent state
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(204,255,0,0.2)' }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', color: '#aaa' }}>AUTONOMOUS PULSE</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ccff00', fontFamily: 'Bangers, cursive' }}>
            {status?.sensor_cooldown_minutes || 25}m Interval
          </div>
          <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: 4 }}>Autonomous tick rate</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(204,255,0,0.2)' }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', color: '#aaa' }}>ROBINHOOD SENSORS</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ccff00', fontFamily: 'Bangers, cursive' }}>
            ACTIVE 🟢
          </div>
          <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: 4 }}>Trench & Gainer Scanners</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(204,255,0,0.2)' }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', color: '#aaa' }}>PERSONA VIBE</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ccff00', fontFamily: 'Bangers, cursive' }}>
            FOREST SIGNAL
          </div>
          <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: 4 }}>Lore + sourced market context</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(204,255,0,0.2)' }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', color: '#aaa' }}>3D WORLDS</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ccff00', fontFamily: 'Bangers, cursive' }}>
            4 STAGES
          </div>
          <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: 4 }}>Sunrise, Noon, Evening, Disco</div>
        </div>
      </div>
    </div>
  );
};
