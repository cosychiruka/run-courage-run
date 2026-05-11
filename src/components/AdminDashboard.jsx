import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaRobot, FaBrain, FaBolt, FaHistory, FaChartLine,
  FaUsers, FaDog, FaNewspaper, FaGamepad, FaList,
  FaTrash, FaSync, FaCheckCircle, FaClock, FaCopy, FaDownload,
  FaMicrophone, FaSitemap, FaChevronLeft, FaChevronRight, FaPlay, FaPause, FaExternalLinkAlt, FaTwitter
} from 'react-icons/fa';
import ErrorBoundary from './ErrorBoundary';

const TABS = [
  { id: 'overview',  label: 'Overview',      icon: FaBolt      },
  { id: 'brain',     label: 'Live Brain',    icon: FaBrain     },
  { id: 'decisions', label: 'Decisions',     icon: FaHistory   },
  { id: 'token',     label: 'Token Hustle',  icon: FaChartLine },
  { id: 'trenches',  label: 'Trenches',      icon: FaUsers     },
  { id: 'posters',   label: 'News Posters',  icon: FaNewspaper },
  { id: 'moments',   label: 'Game Moments',  icon: FaGamepad   },
  { id: 'queue',     label: 'Queue Inspector', icon: FaList      },
  { id: 'voice',     label: 'Voice Live',      icon: FaMicrophone },
  { id: 'rag',       label: 'RAG Memory',      icon: FaSitemap    },
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

// ── Sub-components ─────────────────────────────────────────────────────────────
const Led = ({ status }) => {
  const col = status === 'active' ? '#00ffaa' : status === 'idle' ? '#ff9900' : '#555';
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
      background: col, boxShadow: `0 0 8px ${col}`, marginRight: 10,
    }} />
  );
};

const StatCard = ({ label, value, sub, color = '#00ffaa', onClick }) => (
  <div className="glass-card stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
    <p className="stat-label">{label}</p>
    <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
    {sub && <p className="stat-sub">{sub}</p>}
  </div>
);

const DecisionCard = ({ dec, onSelect }) => {
  const statusText = dec.success ? '✅ EXECUTED' : (dec.action?.includes('QUEUED') ? '🟡 QUEUED' : '❌ FAILED');
  const statusColor = dec.success ? 'success' : 'queued';
  return (
    <motion.div className="decision-card" whileHover={{ scale: 1.02, translateY: -5 }} onClick={() => onSelect(dec)}>
      <div className="card-header">
        <span className="action-badge">{dec.action}</span>
        <span className={`status-badge ${statusColor}`}>{statusText}</span>
      </div>
      <p className="reason-preview">{dec.reasoning || "No reasoning provided."}</p>
      {dec.data_preview && (
        <div className="rich-data-preview">
          <FaExternalLinkAlt size={10} style={{ marginRight: 6 }} />
          <span className="preview-url">{dec.data_preview}</span>
        </div>
      )}
      <div className="meta">
        <span className="time">{dec.time}</span>
        {dec.tool_used && <span className="tool">🔧 {dec.tool_used}</span>}
      </div>
    </motion.div>
  );
};

const BrainPulseSidebar = ({ logs, paused, onTogglePause }) => (
  <div className="sidebar-brain-pulse">
    <div className="sidebar-header">
      <span><FaBrain style={{ marginRight: 8 }} /> BRAIN PULSE</span>
      <button onClick={onTogglePause} className="ctrl-btn">{paused ? <FaPlay size={10} /> : <FaPause size={10} />}</button>
    </div>
    <div className="terminal-log">
      {(!logs || logs.length === 0) && <p className="empty-log">Awaiting brain signals...</p>}
      {(logs || []).map((log, i) => (
        <div key={i} className={`log-line ${log.event?.toLowerCase()}`}>
          <span className="log-time">[{log.time}]</span>
          <span className="log-msg">{log.message}</span>
        </div>
      ))}
    </div>
  </div>
);

const AgentRow = ({ name, data }) => (
  <div className="agent-row">
    <Led status={data?.status || 'idle'} />
    <span className="agent-name">{name}</span>
    <span className="agent-detail">{data?.minutes_ago != null ? `${data.minutes_ago}m ago` : 'no data'}</span>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [sidebarPaused, setSidebarPaused] = useState(false);

  // Data States
  const [status, setStatus] = useState({});
  const [decisions, setDecisions] = useState([]);
  const [history, setHistory] = useState([]);
  const [brainLogs, setBrainLogs] = useState([]);
  const [trenches, setTrenches] = useState({ tweets: [], total_unprocessed: 0 });
  const [posters, setPosters] = useState([]);
  const [moments, setMoments] = useState({ pending: [], history: [], total_pending: 0 });
  const [queue, setQueue] = useState({ pending_game_moments: [], pending_engagement: [], counts: {} });
  const [voiceData, setVoiceData] = useState({ sessions: [], active: false });
  const [ragData, setRagData] = useState({ vectors: [] });
  
  const [selectedDecision, setSelectedDecision] = useState(null);

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadOverview = useCallback(async () => {
    const d = await safeFetch(`${API}/api/admin/system-status`);
    if (d) setStatus(d);
  }, []);

  const loadBrainData = useCallback(async () => {
    const logs = await safeFetch(`${API}/api/admin/live-activity`);
    if (logs && !sidebarPaused) setBrainLogs(logs);
    const hist = await safeFetch(`${API}/api/admin/history`);
    if (hist) setHistory(hist);
    const recent = await safeFetch(`${API}/api/admin/recent-decisions`);
    if (recent) setDecisions(recent);
  }, [sidebarPaused]);

  const loadTabContent = useCallback(async (tabId) => {
    setTabLoading(true);
    try {
      if (tabId === 'overview') await loadOverview();
      if (tabId === 'brain' || tabId === 'decisions') await loadBrainData();
      if (tabId === 'trenches') setTrenches(await safeFetch(`${API}/api/admin/trenches?limit=40`) || { tweets: [], total_unprocessed: 0 });
      if (tabId === 'posters') setPosters(await safeFetch(`${API}/api/admin/news-posters?limit=20`) || []);
      if (tabId === 'moments') setMoments(await safeFetch(`${API}/api/admin/game-moments`) || { pending: [], history: [], total_pending: 0 });
      if (tabId === 'queue') setQueue(await safeFetch(`${API}/api/admin/queues`) || { pending_game_moments: [], pending_engagement: [], counts: {} });
      if (tabId === 'voice') setVoiceData(await safeFetch(`${API}/api/admin/voice-sessions`) || { sessions: [], active: false });
      if (tabId === 'rag') setRagData(await safeFetch(`${API}/api/admin/rag-graph`) || { vectors: [] });
    } finally {
      setTabLoading(false);
    }
  }, [loadOverview, loadBrainData]);

  useEffect(() => { loadTabContent(activeTab); }, [activeTab, loadTabContent]);

  useEffect(() => {
    const ival = setInterval(() => {
      loadOverview();
      if (!sidebarPaused) loadBrainData();
    }, 15000);
    return () => clearInterval(ival);
  }, [loadOverview, loadBrainData, sidebarPaused]);

  const refreshTab = async () => {
    setRefreshing(true);
    await loadTabContent(activeTab);
    setRefreshing(false);
    showToast('Data synced');
  };

  const forceTick = async () => {
    showToast('Triggering autonomous tick...');
    await safeFetch(`${API}/api/autonomous/trigger-now`, { method: 'POST', body: JSON.stringify({}) });
    setTimeout(refreshTab, 2000);
  };

  return (
    <div className="dashboard-root">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand"><FaDog style={{ color: '#ff00ff' }} /> <span>COMMAND CENTER</span></div>
        <nav className="sidebar-nav">
          {TABS.map(t => (
            <div key={t.id} className={`sidebar-item ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
              <t.icon /> <span>{t.label}</span>
              {t.id === 'queue' && (status.reply_queue_size || 0) > 0 && <span className="sidebar-badge">{status.reply_queue_size}</span>}
              {t.id === 'trenches' && (status.unread_trenches || 0) > 0 && <span className="sidebar-badge">{status.unread_trenches}</span>}
            </div>
          ))}
        </nav>
        <BrainPulseSidebar logs={brainLogs} paused={sidebarPaused} onTogglePause={() => setSidebarPaused(!sidebarPaused)} />
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-title">
            <h2>{TABS.find(t => t.id === activeTab)?.label}</h2>
            {tabLoading && <div className="header-spinner"><FaSync className="animate-spin" /> Syncing...</div>}
          </div>
          <div className="header-actions">
            <button className="nav-btn" onClick={refreshTab} disabled={refreshing}><FaSync className={refreshing ? 'animate-spin' : ''} /> Refresh</button>
            <button className="nav-btn exit" onClick={() => window.location.href='/'}>Exit</button>
          </div>
        </header>

        <section className="dashboard-content">
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                
                {activeTab === 'overview' && (
                  <div className="tab-container">
                    <div className="grid-4">
                      <StatCard label="BRAIN CYCLE" value={`${status.sensor_cooldown_minutes || 25}M`} sub="Autonomous Interval" color="#ff00ff" />
                      <StatCard label="MEMORY VECTORS" value={status.memory_vectors} sub="Embedded Vectors" color="#00ffaa" />
                      <StatCard label="QUEUED ACTIONS" value={status.reply_queue_size} sub="Pending execution" color="#ff9900" />
                      <StatCard label="UNREAD TRENCHES" value={status.unread_trenches} sub="Needs replies" color="#ff00ff" />
                    </div>
                    <div className="grid-3">
                      <StatCard label="SCOURAGE PRICE" value={`$${status.rcr_price || '0.00'}`} sub="SOL" color="#00ffaa" />
                      <StatCard label="MARKET CAP" value={`$${status.rcr_stats?.market_cap || '—'}`} sub="USD" color="#ff9900" />
                      <StatCard label="X SPEND TODAY" value={`$${status.x_spend_today || '0.000'}`} sub={`Total: $${status.x_spend_total || '0.00'}`} color="#ff00ff" />
                    </div>
                    <div className="grid-2">
                      <div className="glass-card">
                        <h3 className="card-title"><FaDog style={{ marginRight: 10 }} /> SUB-AGENT STATUS</h3>
                        <AgentRow name="Brain (auto-tick)" data={status.sub_agents?.brain} />
                        <AgentRow name="News Dog" data={status.sub_agents?.news_dog} />
                        <AgentRow name="Game Sensor" data={status.sub_agents?.game_sensor} />
                        <AgentRow name="Engagement Dog" data={status.sub_agents?.engagement_dog} />
                      </div>
                      <div className="glass-card">
                        <h3 className="card-title"><FaBolt style={{ marginRight: 10 }} /> QUICK ACTIONS</h3>
                        <button className="btn-pink" style={{ marginBottom: 12 }} onClick={forceTick}><FaBolt style={{ marginRight: 10 }} /> Force Autonomous Tick</button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'brain' && (
                  <div className="neural-terminal glass-card">
                    <div className="terminal-header">
                      <Led status="active" /> <span>NEURAL ACTIVITY STREAM</span>
                      <span className="vibe-badge">{status.vibe}</span>
                    </div>
                    <div className="terminal-body">
                      {(brainLogs || []).map((log, i) => (
                        <div key={i} className={`log-row ${log.event?.toLowerCase()}`}>
                          <span className="timestamp">[{log.time}]</span>
                          <span className="event-tag">{log.event}</span>
                          <span className="message">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'trenches' && (
                  <div className="glass-card">
                    <div className="card-header-flex">
                      <h3 className="card-title"><FaUsers style={{ marginRight: 8 }} />Community Trenches</h3>
                      <span className="badge-outline">{trenches.total_unprocessed} unprocessed</span>
                    </div>
                    <div className="timeline-list">
                      {(trenches.tweets || []).map((t, i) => (
                        <div key={i} className="timeline-item">
                           <div className="item-meta">
                              <span className="author">@{t.author}</span>
                              <span className="time">{t.time}</span>
                           </div>
                           <p className="item-text">{t.text}</p>
                           <a href={`https://x.com/any/status/${t.tweet_id}`} target="_blank" rel="noreferrer" className="trench-link">View on X</a>
                        </div>
                      ))}
                      {(!trenches.tweets || trenches.tweets.length === 0) && <p className="empty-state">No trench tweets captured yet.</p>}
                    </div>
                  </div>
                )}

                {activeTab === 'moments' && (
                  <div className="grid-2">
                    <div className="glass-card">
                      <h3 className="card-title"><FaGamepad style={{ marginRight: 8 }} />Pending Shoutouts</h3>
                      <div className="timeline-list">
                        {(moments.pending || []).map((m, i) => (
                          <div key={i} className="timeline-item pending">
                            <span className="author">@{m.author}</span>
                            <p className="item-text">{m.text}</p>
                          </div>
                        ))}
                        {(!moments.pending || moments.pending.length === 0) && <p className="empty-state">No pending moments.</p>}
                      </div>
                    </div>
                    <div className="glass-card">
                      <h3 className="card-title"><FaHistory style={{ marginRight: 8 }} />Recent History</h3>
                      <div className="timeline-list">
                        {(moments.history || []).map((m, i) => (
                          <div key={i} className="timeline-item">
                            <span className="author">@{m.author}</span>
                            <p className="item-text">{m.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'queue' && (
                  <div className="grid-2">
                    <div className="glass-card">
                      <h3 className="card-title"><FaClock style={{ marginRight: 8 }} />Game Moments Queue</h3>
                      <div className="queue-list">
                        {(queue.pending_game_moments || []).map((q, i) => (
                          <div key={i} className="queue-item">
                            <div className="author">@{q.author || q.target_user}</div>
                            <p className="item-text">{q.text}</p>
                          </div>
                        ))}
                        {(!queue.pending_game_moments || queue.pending_game_moments.length === 0) && <p className="empty-state">No pending game moments.</p>}
                      </div>
                    </div>
                    <div className="glass-card">
                      <h3 className="card-title"><FaTwitter style={{ marginRight: 8 }} />Engagement Queue</h3>
                      <div className="queue-list">
                        {(queue.reply_queue || []).map((q, i) => (
                          <div key={i} className="queue-item">
                            <div className="author">Target: @{q.target_user}</div>
                            <p className="item-text">{q.text}</p>
                          </div>
                        ))}
                        {(!queue.reply_queue || queue.reply_queue.length === 0) && <p className="empty-state">No pending engagement.</p>}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'posters' && (
                  <div className="posters-grid">
                    {(posters || []).map((p, i) => (
                      <div key={i} className="poster-card glass-card">
                        <img src={`${API}${p.url || p}`} alt="Poster" />
                        <div className="poster-footer">{p.time || 'News Poster'}</div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'decisions' && (
                  <div className="glass-card">
                    <h3 className="card-title">Full Decision History</h3>
                    <div className="decision-list">
                      {(history || []).map((dec, i) => (
                        <div key={i} className="decision-row" onClick={() => setSelectedDecision(dec)}>
                          <div className="row-header">
                            <span className="action">{dec.action}</span>
                            <span className="time">{dec.time}</span>
                          </div>
                          <p className="reasoning">{dec.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </section>
      </main>

      <AnimatePresence>
        {selectedDecision && (
          <div className="modal-overlay" onClick={() => setSelectedDecision(null)}>
            <motion.div className="modal-content" onClick={e => e.stopPropagation()} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div className="modal-header"><h2>{selectedDecision.action}</h2><button className="close-btn" onClick={() => setSelectedDecision(null)}>×</button></div>
              <div className="reasoning-box">{selectedDecision.reasoning}</div>
              <pre className="tech-trace">{JSON.stringify(selectedDecision, null, 2)}</pre>
              <button className="btn-pink" onClick={() => setSelectedDecision(null)} style={{ marginTop: '2rem' }}>CLOSE DETAIL</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .dashboard-root { display: flex; height: 100vh; width: 100%; background: #050505; color: #fff; overflow: hidden; font-family: 'Inter', sans-serif; }
        .dashboard-sidebar { width: 300px; flex-shrink: 0; background: rgba(0,0,0,0.4); border-right: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; padding: 1.5rem; backdrop-filter: blur(40px); z-index: 100; }
        .sidebar-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 2rem; font-family: 'Bangers', cursive; font-size: 1.4rem; color: #ff00ff; }
        .sidebar-nav { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
        .sidebar-item { display: flex; align-items: center; gap: 12px; padding: 0.85rem 1.25rem; border-radius: 12px; cursor: pointer; color: #888; transition: 0.2s; }
        .sidebar-item.active { background: rgba(255, 0, 255, 0.1); color: #ff00ff; border: 1px solid rgba(255,0,255,0.2); }
        .sidebar-badge { background: #ff00ff; color: #fff; font-size: 0.65rem; padding: 2px 6px; border-radius: 10px; margin-left: auto; }
        .dashboard-main { flex: 1; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; }
        .dashboard-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 3rem; background: rgba(5,5,5,0.8); border-bottom: 1px solid rgba(255,255,255,0.05); position: sticky; top: 0; z-index: 90; }
        .header-title h2 { font-family: 'Bangers', cursive; font-size: 2rem; margin: 0; }
        .dashboard-content { padding: 3rem; max-width: 1400px; width: 100%; margin: 0 auto; }
        .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem; }
        .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem; }
        .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem; }
        .glass-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 2rem; backdrop-filter: blur(10px); }
        .stat-value { font-size: 2.5rem; font-family: 'Bangers', cursive; }
        .stat-label { font-size: 0.75rem; color: #888; text-transform: uppercase; }
        .card-title { font-family: 'Bangers', cursive; font-size: 1.2rem; margin-bottom: 1.5rem; display: flex; align-items: center; }
        .agent-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .agent-name { flex: 1; font-weight: 500; }
        .btn-pink { background: rgba(255,0,255,0.1); border: 1px solid #ff00ff; color: #ff00ff; padding: 0.8rem; border-radius: 12px; font-weight: bold; cursor: pointer; width: 100%; }
        .nav-btn { background: rgba(255,255,255,0.05); border: 1px solid #333; color: #fff; padding: 0.6rem 1rem; border-radius: 8px; cursor: pointer; display: flex; gap: 8px; align-items: center; }
        .neural-terminal { height: 500px; display: flex; flex-direction: column; padding: 0; }
        .terminal-header { padding: 1rem 2rem; background: rgba(0,0,0,0.3); border-bottom: 1px solid #222; display: flex; justify-content: space-between; }
        .terminal-body { flex: 1; overflow-y: auto; padding: 1.5rem; font-family: monospace; font-size: 0.8rem; }
        .timeline-list { display: flex; flex-direction: column; gap: 15px; }
        .timeline-item { border-left: 2px solid #ff00ff; padding-left: 15px; }
        .timeline-item.pending { border-left-color: #ff9900; }
        .item-meta { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .author { color: #00ffaa; font-weight: bold; font-size: 0.85rem; }
        .time { opacity: 0.4; font-size: 0.7rem; }
        .item-text { font-size: 0.9rem; opacity: 0.8; margin: 0; }
        .empty-state { text-align: center; padding: 3rem; opacity: 0.3; font-style: italic; }
        .posters-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem; }
        .poster-card img { width: 100%; border-radius: 12px; }
        .poster-footer { padding: 10px; font-size: 0.7rem; opacity: 0.5; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .sidebar-brain-pulse { background: rgba(0,0,0,0.3); border-radius: 12px; padding: 1rem; height: 250px; display: flex; flex-direction: column; margin-top: auto; }
        .terminal-log { flex: 1; overflow-y: auto; display: flex; flex-direction: column-reverse; font-size: 0.7rem; gap: 4px; }
        .badge-outline { border: 1px solid #ff00ff; color: #ff00ff; font-size: 0.65rem; padding: 2px 8px; border-radius: 10px; }
        .tech-trace { background: #000; padding: 1rem; border-radius: 10px; font-size: 0.75rem; color: #555; overflow-x: auto; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
