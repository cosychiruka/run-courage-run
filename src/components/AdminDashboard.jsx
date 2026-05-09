import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaRobot, FaBrain, FaBolt, FaHistory, FaChartLine,
  FaUsers, FaDog, FaNewspaper, FaGamepad, FaList,
  FaTrash, FaSync, FaCheckCircle, FaClock, FaExclamationTriangle, FaCopy,
} from 'react-icons/fa';

const TABS = [
  { id: 'overview',  label: 'Overview',      icon: FaBolt      },
  { id: 'brain',     label: 'Live Brain',    icon: FaBrain     },
  { id: 'decisions', label: 'Decisions',     icon: FaHistory   },
  { id: 'token',     label: 'Token Hustle',  icon: FaChartLine },
  { id: 'trenches',  label: 'Trenches',      icon: FaUsers     },
  { id: 'posters',   label: 'News Posters',  icon: FaNewspaper },
  { id: 'moments',   label: 'Game Moments',  icon: FaGamepad   },
  { id: 'queue',     label: 'Reply Queue',   icon: FaList      },
];

const API = import.meta.env.VITE_BACKEND_URL || '';

const safeFetch = async (url, opts) => {
  try {
    const r = await fetch(url, opts);
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
};

// ── Sub-component: StatusLed ───────────────────────────────────────────────────
const Led = ({ status }) => {
  const col = status === 'active' ? '#00ffaa' : status === 'stale' ? '#ff9900' : '#555';
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
      background: col, boxShadow: `0 0 8px ${col}`, marginRight: 8,
    }} />
  );
};

// ── Sub-component: StatCard ────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color = '#00ffaa', onClick }) => (
  <div
    className="glass-card stat-card"
    onClick={onClick}
    style={{ cursor: onClick ? 'pointer' : 'default' }}
  >
    <p className="stat-label">{label}</p>
    <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
    {sub && <p className="stat-sub">{sub}</p>}
  </div>
);

// ── Sub-component: AgentRow ────────────────────────────────────────────────────
const AgentRow = ({ name, data }) => (
  <div className="agent-row">
    <Led status={data?.status || 'unknown'} />
    <span className="agent-name">{name}</span>
    <span className="agent-detail">
      {data?.minutes_ago != null ? `${data.minutes_ago}m ago` : data?.status || 'no data'}
    </span>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const [activeTab, setActiveTab]     = useState('overview');
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [tabLoading, setTabLoading]   = useState(false);
  const [toast, setToast]             = useState(null); // { msg, type: 'ok'|'err' }

  // pagination display limits (data is fetched in full; we slice for display)
  const [histLimit,   setHistLimit]   = useState(20);
  const [trenchLimit, setTrenchLimit] = useState(20);
  const [actLimit,    setActLimit]    = useState(20);

  // ── Data slices — each fetched independently so updates don't flash ──────────
  const [status,      setStatus]      = useState(null);
  const [agents,      setAgents]      = useState({});
  const [memory,      setMemory]      = useState({ count: 0 });
  const [history,     setHistory]     = useState([]);
  const [activity,    setActivity]    = useState([]);
  const [trenches,    setTrenches]    = useState({ tweets: [], total_unprocessed: 0 });
  const [posters,     setPosters]     = useState([]);
  const [moments,     setMoments]     = useState({ pending: [], history: [] });
  const [queue,       setQueue]       = useState({ items: [], count: 0 });
  const [selectedRow, setSelectedRow] = useState(null);

  // ── Fetch helpers — merge into existing state to avoid flicker ───────────────
  const loadStatus = useCallback(async () => {
    const d = await safeFetch(`${API}/api/admin/system-status`);
    if (d) setStatus(prev => ({ ...prev, ...d }));
  }, []);

  const loadAgents = useCallback(async () => {
    const d = await safeFetch(`${API}/api/admin/sub_agents_status`);
    if (d) setAgents(prev => ({ ...prev, ...d }));
    const m = await safeFetch(`${API}/api/admin/memory-vectors`);
    if (m) setMemory(m);
  }, []);

  const loadBrain = useCallback(async () => {
    const d = await safeFetch(`${API}/api/admin/live-activity`);
    if (d) setActivity(d);
    const h = await safeFetch(`${API}/api/admin/history`);
    if (h) setHistory(h);
  }, []);

  const loadTrenches = useCallback(async () => {
    const d = await safeFetch(`${API}/api/admin/trenches?limit=40`);
    if (d) setTrenches(d);
  }, []);

  const loadPosters = useCallback(async () => {
    const d = await safeFetch(`${API}/api/admin/news-posters?limit=20`);
    if (d) setPosters(d);
  }, []);

  const loadMoments = useCallback(async () => {
    const d = await safeFetch(`${API}/api/admin/game-moments`);
    if (d) setMoments(d);
  }, []);

  const loadQueue = useCallback(async () => {
    const d = await safeFetch(`${API}/api/admin/queue`);
    if (d) setQueue(d);
  }, []);

  // ── Initial load: fetch everything ──────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      loadStatus(), loadAgents(), loadBrain(),
      loadTrenches(), loadPosters(), loadMoments(), loadQueue(),
    ]).finally(() => setInitialLoad(false));
  }, []);

  // ── 30s refresh — only overview stats + current tab ─────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      await Promise.all([loadStatus(), loadAgents()]);
      const loaders = {
        brain: loadBrain, decisions: loadBrain, trenches: loadTrenches,
        posters: loadPosters, moments: loadMoments, queue: loadQueue,
      };
      if (loaders[activeTab]) await loaders[activeTab]();
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // ── Manual full refresh ──────────────────────────────────────────────────────
  const doRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadStatus(), loadAgents(), loadBrain(),
      loadTrenches(), loadPosters(), loadMoments(), loadQueue(),
    ]);
    setRefreshing(false);
  };

  // ── Actions ──────────────────────────────────────────────────────────────────
  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const withTabLoad = async (fn) => {
    setTabLoading(true);
    try { await fn(); } finally { setTabLoading(false); }
  };

  const triggerTick = async () => {
    const d = await safeFetch(`${API}/api/autonomous/trigger-now`, { method: 'POST' });
    showToast(d?.message || 'Tick triggered!');
    setTimeout(loadBrain, 3000);
  };

  const resetBreaker = async () => {
    const d = await safeFetch(`${API}/api/autonomous/reset-circuit-breaker`, { method: 'POST' });
    showToast(d?.message || 'Circuit breaker reset!');
    await loadStatus();
  };

  const clearQueue = async () => {
    if (!window.confirm('Clear the entire reply queue?')) return;
    const d = await safeFetch(`${API}/api/admin/queue`, { method: 'DELETE' });
    showToast(d?.message || 'Queue cleared!', d ? 'ok' : 'err');
    await loadQueue();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text).then(() => showToast('Copied!')).catch(() => showToast('Copy failed', 'err'));
  };

  if (initialLoad) {
    return (
      <div style={styles.loading}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
          <FaRobot size={48} color="#ff00ff" />
        </motion.div>
        <p>Waking up Courage's Brain...</p>
      </div>
    );
  }

  const rcr = status?.rcr_stats || {};
  const groq = status?.groq_circuit_breaker || {};

  return (
    <div style={styles.root}>
      {/* NAV */}
      <nav style={styles.nav}>
        <h1 style={styles.navTitle}>COURAGE COMMAND CENTER</h1>
        <div style={styles.navActions}>
          <button style={styles.navBtn} onClick={doRefresh} disabled={refreshing}>
            <FaSync style={{ marginRight: 6, ...(refreshing ? { animation: 'spin 1s linear infinite' } : {}) }} />
            {refreshing ? 'Syncing...' : 'Refresh'}
          </button>
          <a href="/" style={styles.navLink}>Exit</a>
        </div>
      </nav>

      {/* TABS */}
      <div style={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={{ ...styles.tab, ...(activeTab === t.id ? styles.tabActive : {}) }}
            onClick={() => setActiveTab(t.id)}
          >
            <t.icon style={{ marginRight: 6 }} />{t.label}
            {t.id === 'queue' && queue.count > 0 && (
              <span style={styles.badge}>{queue.count}</span>
            )}
            {t.id === 'trenches' && trenches.total_unprocessed > 0 && (
              <span style={{ ...styles.badge, background: '#ff00ff' }}>{trenches.total_unprocessed}</span>
            )}
          </button>
        ))}
      </div>

      {/* MAIN */}
      <main style={{ padding: '0 0 4rem', position: 'relative' }}>
        {tabLoading && (
          <div style={styles.tabSpinner}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
              <FaSync size={20} color="#ff00ff" />
            </motion.div>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >

            {/* ── OVERVIEW ────────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div>
                {/* Stats row */}
                <div style={styles.grid4}>
                  <StatCard label="BRAIN CYCLE" value={`${status?.sensor_cooldown_minutes || 25}m`} sub="Autonomous interval" color="#ff00ff" />
                  <StatCard label="MEMORY VECTORS" value={memory.count} sub={memory.status} />
                  <StatCard label="REPLY QUEUE" value={queue.count} sub="Posts waiting" color="#ff9900"
                    onClick={() => setActiveTab('queue')} />
                  <StatCard label="UNREAD TRENCHES" value={trenches.total_unprocessed} sub="Needs replies" color="#ff00ff"
                    onClick={() => setActiveTab('trenches')} />
                </div>

                {/* Token stats */}
                <div style={styles.grid3}>
                  <StatCard label="$COURAGE PRICE" value={rcr.price ? `$${Number(rcr.price).toFixed(6)}` : '—'} sub={rcr.symbol} />
                  <StatCard label="MARKET CAP" value={rcr.market_cap ? `$${Number(rcr.market_cap).toLocaleString()}` : '—'} sub="USD" color="#ff9900" />
                  <StatCard label="X SPEND TODAY" value={`$${(status?.x_spend_today || 0).toFixed(3)}`} sub={`Total: $${(status?.x_spend_total || 0).toFixed(2)}`} color="#aaa" />
                </div>

                {/* Two columns: agents + API health */}
                <div style={styles.grid2}>
                  <div className="glass-card" style={styles.card}>
                    <h3 style={styles.cardTitle}><FaDog style={{ marginRight: 8 }} />Sub-Agent Status</h3>
                    <AgentRow name="Brain (auto-tick)" data={agents.brain} />
                    <AgentRow name="News Dog" data={agents.news_dog} />
                    <AgentRow name="Game Sensor" data={agents.game_sensor} />
                    <AgentRow name="Engagement Dog" data={agents.engagement_dog} />
                    {agents.last_reflection && agents.last_reflection !== 'none' && (
                      <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: 12 }}>
                        Last reflection: {agents.last_reflection}
                      </p>
                    )}
                  </div>

                  <div className="glass-card" style={styles.card}>
                    <h3 style={styles.cardTitle}><FaBolt style={{ marginRight: 8 }} />Controls</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <button style={styles.btnPink} onClick={triggerTick}>⚡ Force Autonomous Tick</button>
                      <button style={styles.btnSmall} onClick={resetBreaker}>Reset Groq Circuit Breaker</button>
                    </div>
                    <div style={{ marginTop: 20, padding: 12, background: '#0a0a0a', borderRadius: 8 }}>
                      <p style={{ fontSize: '0.75rem', opacity: 0.6, margin: 0 }}>Groq Status</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                        <Led status={groq.active ? 'stale' : 'active'} />
                        <span style={{ fontWeight: 'bold', color: groq.active ? '#ff4444' : '#00ffaa' }}>
                          {groq.active ? `CIRCUIT OPEN — ${groq.remaining_min}m remaining` : 'READY'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trench activity mini chart */}
                <div className="glass-card" style={{ ...styles.card, marginTop: 0 }}>
                  <h3 style={styles.cardTitle}><FaUsers style={{ marginRight: 8 }} />Trench Activity (Last 12h)</h3>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                    {(status?.trench_activity_last_12h || [0,0,0,0,0,0,0,0,0,0,0,0]).map((v, i) => {
                      const max = Math.max(...(status?.trench_activity_last_12h || [1]), 1);
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{
                            width: '100%', background: '#ff00ff', borderRadius: 3,
                            height: `${Math.max(4, (v / max) * 70)}px`,
                            opacity: 0.7 + (v / max) * 0.3,
                          }} />
                          <span style={{ fontSize: '0.6rem', opacity: 0.4 }}>{i}h</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── LIVE BRAIN ───────────────────────────────────────────────── */}
            {activeTab === 'brain' && (
              <div style={styles.grid2}>
                <div className="glass-card" style={styles.card}>
                  <h3 style={styles.cardTitle}><FaBolt style={{ marginRight: 8 }} />Live Activity Stream</h3>
                  <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: 12, marginTop: -8 }}>
                    Engagement queue output • Redis stream
                  </p>
                  <div style={styles.feedScroll}>
                    {activity.length === 0 && (
                      <p style={{ opacity: 0.4, fontSize: '0.85rem' }}>No activity yet — queue is quiet...</p>
                    )}
                    {activity.slice(0, actLimit).map((a, i) => (
                      <div key={i} style={styles.feedItem}>
                        <span style={styles.feedTime}>{a.time || '—'}</span>
                        <span style={{ ...styles.feedEvent, color: a.event === 'POST_SUCCESS' ? '#00ffaa' : '#ff9900' }}>
                          {a.event}
                        </span>
                        <span style={styles.feedMsg}>{a.message}</span>
                      </div>
                    ))}
                    {activity.length > actLimit && (
                      <button style={styles.loadMoreBtn} onClick={() => setActLimit(n => n + 20)}>
                        Load {Math.min(20, activity.length - actLimit)} more
                      </button>
                    )}
                  </div>
                </div>

                <div className="glass-card" style={styles.card}>
                  <h3 style={styles.cardTitle}><FaBrain style={{ marginRight: 8 }} />Recent Brain Decisions</h3>
                  <div style={styles.feedScroll}>
                    {(status?.brain_decisions || []).length === 0 && (
                      <p style={{ opacity: 0.4, fontSize: '0.85rem' }}>No decisions recorded yet...</p>
                    )}
                    {(status?.brain_decisions || []).map((d, i) => (
                      <div key={i} style={styles.decisionMini} onClick={() => setSelectedRow(d)}>
                        <span style={{ ...styles.decisionAction, color: '#ff00ff' }}>{d.action}</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{d.time}</span>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.75 }}>{d.reasoning?.slice(0, 100)}{d.reasoning?.length > 100 ? '...' : ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── DECISIONS ────────────────────────────────────────────────── */}
            {activeTab === 'decisions' && (
              <div className="glass-card" style={styles.card}>
                <h3 style={styles.cardTitle}><FaHistory style={{ marginRight: 8 }} />Autonomous Decision Log</h3>
                <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: 16, marginTop: -8 }}>
                  {history.length} decisions recorded • Click any row for full details
                </p>
                <div style={{ ...styles.feedScroll, maxHeight: '65vh' }}>
                  {history.length === 0 && (
                    <p style={{ opacity: 0.4 }}>No decisions logged yet — autonomous loop hasn't run.</p>
                  )}
                  {history.slice(0, histLimit).map((h, i) => (
                    <motion.div
                      key={h.id || i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.5) }}
                      style={{
                        ...styles.timelineItem,
                        borderLeftColor: h.success ? '#00ffaa' : '#ff9900',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedRow(h)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontFamily: 'Bangers, cursive', letterSpacing: 1.5, fontSize: '1.1rem', color: '#fff' }}>
                          {h.action}
                        </span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                          {h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.85, lineHeight: 1.5 }}>{h.reasoning}</p>
                      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: '0.75rem', opacity: 0.55 }}>
                        {h.tool_used && <span>Tool: {h.tool_used}</span>}
                        {h.success != null && (
                          <span style={{ color: h.success ? '#00ffaa' : '#ff4444' }}>
                            {h.success ? '✓ Success' : '✗ Failed'}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {history.length > histLimit && (
                    <button style={styles.loadMoreBtn} onClick={() => setHistLimit(n => n + 20)}>
                      Load {Math.min(20, history.length - histLimit)} more ({history.length - histLimit} remaining)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── TOKEN HUSTLE ─────────────────────────────────────────────── */}
            {activeTab === 'token' && (
              <div>
                <div style={styles.grid3}>
                  <StatCard label="PRICE" value={rcr.price ? `$${Number(rcr.price).toFixed(8)}` : '—'} sub={rcr.symbol || '$COURAGE'} color="#ff00ff" />
                  <StatCard label="24H CHANGE" value={rcr.price_change_24h != null ? `${rcr.price_change_24h > 0 ? '+' : ''}${Number(rcr.price_change_24h).toFixed(2)}%` : '—'}
                    color={rcr.price_change_24h > 0 ? '#00ffaa' : '#ff4444'} sub="vs yesterday" />
                  <StatCard label="VOLUME 24H" value={rcr.volume_24h ? `$${Number(rcr.volume_24h).toLocaleString()}` : '—'} sub="Trading volume" color="#ff9900" />
                  <StatCard label="MARKET CAP" value={rcr.market_cap ? `$${Number(rcr.market_cap).toLocaleString()}` : '—'} sub="USD" />
                  <StatCard label="AUTO TWEETS TODAY" value={status?.auto_tweets_today ?? '—'} sub="of 25 daily limit" color="#ff9900" />
                  <StatCard label="X API SPEND" value={`$${(status?.x_spend_today || 0).toFixed(3)}`} sub={`Total: $${(status?.x_spend_total || 0).toFixed(2)}`} color="#aaa" />
                </div>

                {status?.price_history?.length > 0 && (
                  <div className="glass-card" style={styles.card}>
                    <h3 style={styles.cardTitle}><FaChartLine style={{ marginRight: 8 }} />Price History (24h)</h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100, marginTop: 8 }}>
                      {status.price_history.map((p, i) => {
                        const prices = status.price_history.map(x => x.price);
                        const mn = Math.min(...prices), mx = Math.max(...prices);
                        const pct = mx === mn ? 0.5 : (p.price - mn) / (mx - mn);
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                            <div style={{ width: '100%', background: `hsl(${150 + pct * 100}deg, 80%, 55%)`, borderRadius: 2, height: `${Math.max(4, pct * 90)}px` }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TRENCHES ─────────────────────────────────────────────────── */}
            {activeTab === 'trenches' && (
              <div className="glass-card" style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ ...styles.cardTitle, margin: 0 }}><FaUsers style={{ marginRight: 8 }} />Community Trenches</h3>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                      {trenches.total_unprocessed} unprocessed
                    </span>
                    <button style={styles.btnSmall} onClick={loadTrenches}>Refresh</button>
                  </div>
                </div>
                <div style={{ ...styles.feedScroll, maxHeight: '65vh' }}>
                  {trenches.tweets.length === 0 && (
                    <p style={{ opacity: 0.4 }}>No trench tweets captured yet — sensor hasn't fired.</p>
                  )}
                  {trenches.tweets.slice(0, trenchLimit).map((t, i) => (
                    <div key={t.tweet_id || i} style={{
                      ...styles.timelineItem,
                      borderLeftColor: t.processed ? '#333' : '#ff00ff',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: '#00ffaa', fontWeight: 'bold' }}>@{t.author}</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {t.cashtag && <span style={{ fontSize: '0.7rem', color: '#ff9900' }}>{t.cashtag}</span>}
                          <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{t.time}</span>
                          {!t.processed && <span style={{ fontSize: '0.65rem', color: '#ff00ff', fontWeight: 'bold' }}>NEW</span>}
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.85 }}>{t.text}</p>
                    </div>
                  ))}
                  {trenches.tweets.length > trenchLimit && (
                    <button style={styles.loadMoreBtn} onClick={() => setTrenchLimit(n => n + 20)}>
                      Load {Math.min(20, trenches.tweets.length - trenchLimit)} more ({trenches.tweets.length - trenchLimit} remaining)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── NEWS POSTERS ─────────────────────────────────────────────── */}
            {activeTab === 'posters' && (
              <div className="glass-card" style={styles.card}>
                <h3 style={styles.cardTitle}><FaNewspaper style={{ marginRight: 8 }} />Generated News Posters</h3>
                {posters.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.4 }}>
                    <FaNewspaper size={40} />
                    <p>No posters generated yet. Autonomous loop will create them on next news reaction.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                    {posters.map((p, i) => (
                      <div key={i} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #222', background: '#0a0a0a' }}>
                        <img
                          src={`${API}${p.url}`}
                          alt={`Poster ${i + 1}`}
                          style={{ width: '100%', display: 'block', objectFit: 'cover' }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                        <p style={{ fontSize: '0.7rem', opacity: 0.5, margin: '6px 10px', fontFamily: 'monospace' }}>
                          {p.time || p.url?.split('/').pop()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── GAME MOMENTS ─────────────────────────────────────────────── */}
            {activeTab === 'moments' && (
              <div style={styles.grid2}>
                <div className="glass-card" style={styles.card}>
                  <h3 style={styles.cardTitle}><FaGamepad style={{ marginRight: 8 }} />Pending Shoutouts</h3>
                  <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: -8, marginBottom: 12 }}>
                    {moments.total_pending || 0} pending — will be used next brain tick
                  </p>
                  {(moments.pending || []).length === 0 ? (
                    <p style={{ opacity: 0.4, fontSize: '0.85rem' }}>No pending game moments right now.</p>
                  ) : (
                    moments.pending.map((m, i) => (
                      <div key={i} style={{ ...styles.timelineItem, borderLeftColor: '#ff9900' }}>
                        <span style={{ color: '#00ffaa', fontWeight: 'bold' }}>@{m.author}</span>
                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>{m.text?.slice(0, 120)}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="glass-card" style={styles.card}>
                  <h3 style={styles.cardTitle}><FaHistory style={{ marginRight: 8 }} />Recent History</h3>
                  {(moments.history || []).length === 0 ? (
                    <p style={{ opacity: 0.4, fontSize: '0.85rem' }}>No history yet — game sensor hasn't captured any moments.</p>
                  ) : (
                    moments.history.map((m, i) => (
                      <div key={i} style={{ ...styles.timelineItem, borderLeftColor: '#ff00ff' }}>
                        <span style={{ color: '#00ffaa', fontWeight: 'bold' }}>@{m.author}</span>
                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>{m.text?.slice(0, 120)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── REPLY QUEUE ───────────────────────────────────────────────── */}
            {activeTab === 'queue' && (
              <div className="glass-card" style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ ...styles.cardTitle, margin: 0 }}>
                    <FaList style={{ marginRight: 8 }} />Reply Queue
                    {queue.count > 0 && <span style={{ ...styles.badge, marginLeft: 10 }}>{queue.count}</span>}
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={styles.btnSmall} onClick={loadQueue}>Refresh</button>
                    {queue.count > 0 && (
                      <button style={{ ...styles.btnSmall, borderColor: '#ff4444', color: '#ff4444' }} onClick={clearQueue}>
                        <FaTrash style={{ marginRight: 4 }} />Clear All
                      </button>
                    )}
                  </div>
                </div>

                {queue.items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.4 }}>
                    <FaCheckCircle size={32} />
                    <p>Queue is empty — all posts have been sent!</p>
                  </div>
                ) : (
                  <div style={{ ...styles.feedScroll, maxHeight: '65vh' }}>
                    {queue.items.map((item, i) => (
                      <div key={i} style={{ ...styles.timelineItem, borderLeftColor: '#ff9900' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.7rem', opacity: 0.5, fontFamily: 'monospace' }}>
                            <FaClock style={{ marginRight: 4 }} />
                            {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : `#${i + 1}`}
                          </span>
                          {item.reply_to_tweet_id && (
                            <span style={{ fontSize: '0.65rem', color: '#ff9900' }}>Reply to: {item.reply_to_tweet_id}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9, flex: 1 }}>{item.text}</p>
                          <button
                            title="Copy tweet text"
                            onClick={() => copyToClipboard(item.text)}
                            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}
                          >
                            <FaCopy size={13} />
                          </button>
                        </div>
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt="queued art"
                            style={{ marginTop: 8, maxWidth: 200, borderRadius: 8 }}
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {selectedRow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedRow(null)}
            style={styles.overlay}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92 }}
              onClick={e => e.stopPropagation()}
              style={styles.modal}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ color: '#00ffaa', margin: 0, fontFamily: 'Bangers, cursive', letterSpacing: 2 }}>
                  {selectedRow.action || selectedRow.type || 'Detail'}
                </h2>
                <button onClick={() => setSelectedRow(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.8rem', cursor: 'pointer', opacity: 0.5 }}>×</button>
              </div>
              <pre style={styles.modalPre}>{JSON.stringify(selectedRow, null, 2)}</pre>
              <button style={{ ...styles.btnPink, width: '100%', marginTop: 12 }} onClick={() => setSelectedRow(null)}>CLOSE</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOAST */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            style={{
              position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
              background: toast.type === 'err' ? '#1a0000' : '#001a0e',
              border: `1px solid ${toast.type === 'err' ? '#ff4444' : '#00ffaa'}`,
              color: toast.type === 'err' ? '#ff4444' : '#00ffaa',
              padding: '0.75rem 1.5rem', borderRadius: 12,
              fontWeight: 'bold', fontSize: '0.9rem', zIndex: 2000,
              boxShadow: `0 8px 32px ${toast.type === 'err' ? 'rgba(255,68,68,0.3)' : 'rgba(0,255,170,0.2)'}`,
              whiteSpace: 'nowrap',
            }}
          >
            {toast.type === 'err' ? '✗ ' : '✓ '}{toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .glass-card {
          background: rgba(255,255,255,0.025);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 1.75rem;
          transition: border-color 0.2s;
        }
        .glass-card:hover { border-color: rgba(255,255,255,0.13); }
        .stat-card { cursor: default; }
        .stat-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.5; margin: 0 0 6px; }
        .stat-value { font-size: 2rem; font-weight: bold; font-family: 'Bangers', cursive; letter-spacing: 1px; }
        .stat-sub { font-size: 0.72rem; opacity: 0.45; margin: 4px 0 0; }
        .agent-row { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .agent-name { flex: 1; font-size: 0.85rem; }
        .agent-detail { font-size: 0.75rem; opacity: 0.5; font-family: monospace; }
      `}</style>
    </div>
  );
};

// ── Inline styles ──────────────────────────────────────────────────────────────
const styles = {
  root: {
    background: '#050505', color: '#fff', minHeight: '100vh',
    fontFamily: "'Inter', sans-serif", padding: '2rem',
  },
  loading: {
    height: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: '#050505', color: '#fff', gap: '1.5rem',
  },
  nav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '2px solid #ff00ff', paddingBottom: '1.25rem', marginBottom: '1.75rem',
  },
  navTitle: {
    fontFamily: "'Bangers', cursive", letterSpacing: 2, color: '#ff00ff',
    margin: 0, fontSize: '1.8rem',
  },
  navActions: { display: 'flex', gap: '0.75rem', alignItems: 'center' },
  navBtn: {
    background: '#ff00ff22', border: '1px solid #ff00ff', color: '#ff00ff',
    padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer',
    fontWeight: 'bold', display: 'flex', alignItems: 'center',
  },
  navLink: {
    background: 'transparent', border: '1px solid #444', color: '#888',
    padding: '0.5rem 1rem', borderRadius: 8, textDecoration: 'none',
    fontWeight: 'bold', fontSize: '0.85rem',
  },
  tabSpinner: {
    position: 'absolute', top: 12, right: 0, display: 'flex', alignItems: 'center',
    gap: 6, fontSize: '0.75rem', color: '#ff00ff', opacity: 0.7, zIndex: 10,
  },
  loadMoreBtn: {
    display: 'block', width: '100%', marginTop: 10, padding: '0.6rem',
    background: 'transparent', border: '1px dashed #333', color: '#666',
    borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', textAlign: 'center',
    transition: 'border-color 0.2s, color 0.2s',
  },
  tabBar: {
    display: 'flex', gap: '0.5rem', marginBottom: '2rem',
    overflowX: 'auto', paddingBottom: '0.5rem', flexWrap: 'wrap',
  },
  tab: {
    background: '#111', border: '1px solid #2a2a2a', color: '#666',
    padding: '0.65rem 1.2rem', borderRadius: 12,
    display: 'flex', alignItems: 'center', gap: 6,
    cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 500,
    fontSize: '0.875rem', transition: 'all 0.2s', position: 'relative',
  },
  tabActive: {
    background: '#ff00ff18', borderColor: '#ff00ff',
    color: '#ff00ff', boxShadow: '0 0 12px rgba(255,0,255,0.15)',
  },
  badge: {
    background: '#ff9900', color: '#000', borderRadius: 10,
    padding: '1px 6px', fontSize: '0.65rem', fontWeight: 'bold', marginLeft: 4,
  },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' },
  card: { marginBottom: '1.5rem' },
  cardTitle: {
    margin: '0 0 1.25rem', display: 'flex', alignItems: 'center',
    color: '#00ffaa', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: 1,
  },
  feedScroll: { overflowY: 'auto', maxHeight: 480, paddingRight: 4 },
  feedItem: {
    display: 'flex', gap: 10, alignItems: 'flex-start',
    padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontSize: '0.85rem',
  },
  feedTime: { fontFamily: 'monospace', fontSize: '0.7rem', opacity: 0.4, minWidth: 48 },
  feedEvent: { fontWeight: 'bold', fontSize: '0.75rem', minWidth: 100 },
  feedMsg: { opacity: 0.75, flex: 1 },
  decisionMini: {
    padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.02)',
    marginBottom: 8, cursor: 'pointer', borderLeft: '3px solid #333',
    transition: 'background 0.15s',
  },
  decisionAction: { fontWeight: 'bold', fontSize: '0.85rem', marginRight: 10 },
  timelineItem: {
    padding: '1rem 1.25rem', borderRadius: 12, background: 'rgba(255,255,255,0.02)',
    borderLeft: '4px solid #333', marginBottom: 10, transition: 'background 0.15s',
  },
  btnPink: {
    background: '#ff00ff18', border: '1px solid #ff00ff', color: '#ff00ff',
    padding: '0.7rem 1.2rem', borderRadius: 10, cursor: 'pointer',
    fontWeight: 'bold', width: '100%', textAlign: 'center',
  },
  btnSmall: {
    background: '#111', border: '1px solid #333', color: '#eee',
    padding: '0.5rem 0.9rem', borderRadius: 8, cursor: 'pointer',
    fontWeight: 600, fontSize: '0.8rem',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
    backdropFilter: 'blur(12px)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
  },
  modal: {
    background: '#080808', border: '1px solid #2a2a2a', borderRadius: 20,
    padding: '2rem', maxWidth: 700, width: '100%', maxHeight: '85vh', overflowY: 'auto',
  },
  modalPre: {
    background: '#000', padding: '1.25rem', borderRadius: 12,
    color: '#00ffaa', fontSize: '0.8rem', overflowX: 'auto',
    whiteSpace: 'pre-wrap', border: '1px solid #1a1a1a', margin: 0,
  },
};

export default AdminDashboard;
