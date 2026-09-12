import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaChartLine, FaNewspaper, FaBrain, FaSync, FaExternalLinkAlt } from 'react-icons/fa';
import { getBackendUrl } from '../services/newsService';
import { fetchRobinhoodTokenSnapshot, getCachedTokenSnapshot, resolveTokenLogoUrl } from '../services/tokenService';

const API_BASE = getBackendUrl();

// ── Widget 1: Live Robinhood & Trending Crypto Pulse (Sorted Live Data) ────────────────
export const LiveMarketWidget = () => {
  const [data, setData] = useState(getCachedTokenSnapshot);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      setData(await fetchRobinhoodTokenSnapshot({ force: true }));
    } catch (err) {
      console.warn('Failed to fetch Robinhood stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const rawStats = data?.stats || [];
  const sortedStats = [...rawStats].sort((a, b) => {
    if (b.is_trending !== a.is_trending) return b.is_trending ? 1 : -1;
    return (b.change_24h || 0) - (a.change_24h || 0);
  });

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
            <FaChartLine color="#ccff00" /> 🔥 LIVE TRENDING TOKENS & ROBINHOOD CRYPTO PULSE
          </h2>
          <p style={{ margin: '4px 0 0', opacity: 0.7, fontSize: '0.85rem', color: '#ccc' }}>
            Robinhood Chain discovery pulse via DexScreener · {data?.metadata?.status || 'connecting'}
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          style={{
            background: 'rgba(204, 255, 0, 0.15)',
            border: '1px solid #ccff00',
            color: '#ccff00',
            padding: '0.6rem 1.2rem',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <FaSync className={loading ? 'spin' : ''} /> {loading ? 'FETCHING...' : 'REFRESH PULSE'}
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '1.25rem'
      }}>
        {sortedStats.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', opacity: 0.5, color: '#888' }}>
            Connecting to Live Crypto & Robinhood Market Stream...
          </div>
        ) : (
          sortedStats.map((coin) => {
            const isPos = (coin.change_24h || 0) >= 0;
            return (
              <motion.div
                key={coin.ticker || coin.symbol}
                whileHover={{ scale: 1.03, translateY: -4 }}
                transition={{ type: 'spring', stiffness: 300 }}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${isPos ? 'rgba(204, 255, 0, 0.4)' : 'rgba(255, 68, 68, 0.4)'}`,
                  borderRadius: '16px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: `0 4px 15px ${isPos ? 'rgba(204, 255, 0, 0.1)' : 'rgba(255, 68, 68, 0.1)'}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {coin.logo_url && <img src={resolveTokenLogoUrl(coin)} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />}
                    <span style={{ fontFamily: 'Bangers, cursive', fontSize: '1.3rem', letterSpacing: '1px', color: '#fff' }}>
                      {coin.ticker || coin.symbol}
                    </span>
                    {coin.is_boosted && (
                      <span style={{ fontSize: '0.65rem', background: '#ffaa0022', color: '#ffaa00', border: '1px solid #ffaa0044', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                        🔥 BOOSTED
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: isPos ? 'rgba(204, 255, 0, 0.2)' : 'rgba(255, 68, 68, 0.2)',
                    color: isPos ? '#ccff00' : '#ff4444',
                    border: `1px solid ${isPos ? '#ccff0044' : '#ff444444'}`
                  }}>
                    {isPos ? '+' : ''}{Number(coin.change_24h || 0).toFixed(2)}%
                  </span>
                </div>

                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ccff00', fontFamily: 'monospace' }}>
                  ${Number(coin.price_usd || coin.price || 0) < 0.01
                    ? Number(coin.price_usd || coin.price || 0).toFixed(6)
                    : Number(coin.price_usd || coin.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', opacity: 0.6, marginTop: '4px', color: '#aaa' }}>
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
              Mario Nawfal Style News Dispatch
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
            MARIO NAWFAL
          </div>
          <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: 4 }}>Robinhood Breaking News</div>
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
