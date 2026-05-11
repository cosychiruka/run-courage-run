import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaRobot, FaBrain, FaBolt, FaHistory, FaChartLine,
  FaUsers, FaDog, FaNewspaper, FaGamepad, FaList,
  FaTrash, FaSync, FaCheckCircle, FaClock, FaCopy, FaDownload,
  FaMicrophone, FaSitemap, FaChevronLeft, FaChevronRight, FaPlay, FaPause, FaExternalLinkAlt, FaTwitter, FaTerminal
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
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: col, boxShadow: `0 0 10px ${col}`, marginRight: 10,
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
  const statusText = dec.success ? 'EXECUTED' : 'QUEUED';
  const statusColor = dec.success ? 'success' : 'queued';
  return (
    <motion.div className="decision-card-v3" whileHover={{ scale: 1.01 }} onClick={() => onSelect(dec)}>
      <div className="v3-header">
        <span className="v3-action">{dec.action}</span>
        <span className={`v3-status ${statusColor}`}>{statusText}</span>
      </div>
      <p className="v3-reasoning">{dec.reasoning || "Analyzing state..."}</p>
      {dec.data_preview && (
        <div className="v3-preview">
          <FaExternalLinkAlt size={10} />
          <span className="v3-url">{dec.data_preview}</span>
        </div>
      )}
      <div className="v3-footer">
        <span className="v3-time">{dec.time}</span>
        <span className="v3-tool">🔧 {dec.tool_used}</span>
      </div>
    </motion.div>
  );
};

const BrainPulseSidebar = ({ logs, paused, onTogglePause }) => (
  <div className="brain-pulse-v4">
    <div className="v4-header">
       <div className="v4-title"><FaTerminal /> BRAIN PULSE</div>
       <button onClick={onTogglePause} className="v4-pause">
         {paused ? <FaPlay size={10} /> : <FaPause size={10} />}
       </button>
    </div>
    <div className="v4-terminal">
       {(logs || []).map((log, i) => (
         <div key={i} className={`v4-line ${log.event?.toLowerCase() || 'default'}`}>
            <span className="v4-dot" />
            <div className="v4-content">
               <span className="v4-time">[{log.time}]</span>
               <span className="v4-msg">{log.message}</span>
            </div>
         </div>
       ))}
       {(!logs || logs.length === 0) && <div className="v4-empty">Listening for brainwaves...</div>}
    </div>
  </div>
);

const AgentRow = ({ name, data }) => (
  <div className="agent-row-v2">
    <div className="v2-name-wrap">
      <Led status={data?.status || 'idle'} />
      <span className="v2-name">{name}</span>
    </div>
    <span className="v2-detail">{data?.minutes_ago != null ? `${data.minutes_ago}m ago` : 'stale'}</span>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [sidebarPaused, setSidebarPaused] = useState(false);

  const [status, setStatus] = useState({});
  const [decisions, setDecisions] = useState([]);
  const [history, setHistory] = useState([]);
  const [brainLogs, setBrainLogs] = useState([]);
  const [trenches, setTrenches] = useState({ tweets: [], total_unprocessed: 0 });
  const [posters, setPosters] = useState([]);
  const [moments, setMoments] = useState({ pending: [], history: [], total_pending: 0 });
  const [queue, setQueue] = useState({ reply_queue: [], pending_game_moments: [], counts: {} });
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
      if (tabId === 'queue') setQueue(await safeFetch(`${API}/api/admin/queues`) || { reply_queue: [], pending_game_moments: [], counts: {} });
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
    showToast('Dashboard synced');
  };

  const forceTick = async () => {
    showToast('Triggering autonomous tick...');
    await safeFetch(`${API}/api/autonomous/trigger-now`, { method: 'POST', body: JSON.stringify({}) });
    setTimeout(refreshTab, 2000);
  };

  return (
    <div className="dashboard-root">
      {/* ── SIDEBAR ────────────────────────────────── */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand"><FaDog /> <span>COMMAND CENTER</span></div>
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

      {/* ── MAIN ───────────────────────────────────── */}
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
                      <div className="glass-card agent-card">
                        <h3 className="card-title"><FaDog style={{ marginRight: 10 }} /> AGENT HEARTBEATS</h3>
                        <AgentRow name="Brain (auto-tick)" data={status.sub_agents?.brain} />
                        <AgentRow name="News Dog" data={status.sub_agents?.news_dog} />
                        <AgentRow name="Game Sensor" data={status.sub_agents?.game_sensor} />
                        <AgentRow name="Engagement Dog" data={status.sub_agents?.engagement_dog} />
                      </div>
                      <div className="glass-card action-card">
                        <h3 className="card-title"><FaBolt style={{ marginRight: 10 }} /> MISSION CONTROL</h3>
                        <button className="btn-pink-pro" onClick={forceTick}><FaBolt /> Trigger Manual Brain Scan</button>
                      </div>
                    </div>
                    <div className="decision-section" style={{ marginTop: '2.5rem' }}>
                      <h3 className="card-title"><FaHistory style={{ marginRight: 10 }} /> RECENT BRAIN DECISIONS</h3>
                      <div className="grid-3">
                        {(decisions || []).slice(0, 6).map((dec, i) => (
                          <DecisionCard key={i} dec={dec} onSelect={setSelectedDecision} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'decisions' && (
                  <div className="tab-container">
                    <div className="glass-card feed-card">
                      <h3 className="card-title">BRAIN ACTIVITY FEED</h3>
                      <div className="activity-feed">
                        {(history || []).map((dec, i) => (
                          <div key={i} className="feed-row" onClick={() => setSelectedDecision(dec)}>
                            <div className="feed-dot" />
                            <div className="feed-info">
                              <div className="feed-header">
                                <span className="feed-action">{dec.action}</span>
                                <span className="feed-time">{dec.time}</span>
                              </div>
                              <p className="feed-text">{dec.reasoning}</p>
                              {dec.data_preview && <div className="feed-preview">🔗 {dec.data_preview}</div>}
                              <div className="feed-meta">🔧 {dec.tool_used} | Status: <span className={dec.success ? 'ok':'fail'}>{dec.success ? 'Success':'Failed'}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Rest of the tabs... */}
                {activeTab === 'trenches' && (
                  <div className="tab-container">
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
                      </div>
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

              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </section>
      </main>

      {/* ── MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {selectedDecision && (
          <div className="modal-overlay-v2" onClick={() => setSelectedDecision(null)}>
            <motion.div className="modal-box-v2" onClick={e => e.stopPropagation()} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div className="v2-modal-header">
                <h2>{selectedDecision.action}</h2>
                <button className="v2-close" onClick={() => setSelectedDecision(null)}>×</button>
              </div>
              
              <div className="v2-modal-body">
                <div className="v2-section">
                  <label>BRAIN REASONING</label>
                  <div className="v2-reason-box">{selectedDecision.reasoning || "Analyzing state..."}</div>
                </div>
                {selectedDecision.data_preview && (
                  <div className="v2-section">
                    <label>RICH DATA ATTACHMENT</label>
                    <div className="v2-data-box">🔗 {selectedDecision.data_preview}</div>
                  </div>
                )}
                <div className="v2-section">
                   <label>TECHNICAL TRACE</label>
                   <pre className="v2-pre">{JSON.stringify(selectedDecision, null, 2)}</pre>
                </div>
              </div>

              <button className="v2-done" onClick={() => setSelectedDecision(null)}>CLOSE TRACE</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {toast && <div className="toast-v2">{toast.msg}</div>}

      <style>{`
        .dashboard-root { display: flex; height: 100vh; width: 100%; background: #020202; color: #fff; overflow: hidden; font-family: 'Inter', sans-serif; }
        .dashboard-sidebar { width: 320px; flex-shrink: 0; background: #080808; border-right: 1px solid #1a1a1a; display: flex; flex-direction: column; padding: 1.5rem; z-index: 100; }
        .sidebar-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 2.5rem; font-family: 'Bangers', cursive; font-size: 1.6rem; color: #ff00ff; letter-spacing: 2px; }
        .sidebar-nav { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
        .sidebar-item { display: flex; align-items: center; gap: 14px; padding: 0.9rem 1.25rem; border-radius: 12px; cursor: pointer; color: #666; font-weight: 600; transition: 0.2s; }
        .sidebar-item:hover { color: #aaa; background: rgba(255,255,255,0.02); }
        .sidebar-item.active { background: rgba(255, 0, 255, 0.1); color: #ff00ff; border: 1px solid rgba(255,0,255,0.15); }
        .sidebar-badge { background: #ff00ff; color: #fff; font-size: 0.65rem; padding: 2px 7px; border-radius: 10px; margin-left: auto; font-weight: bold; }

        /* BRAIN PULSE V4 */
        .brain-pulse-v4 { background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 16px; height: 350px; display: flex; flex-direction: column; margin-top: auto; overflow: hidden; box-shadow: inset 0 0 20px rgba(0,0,0,0.5); }
        .v4-header { padding: 10px 15px; background: #111; display: flex; justify-content: space-between; border-bottom: 1px solid #222; }
        .v4-title { font-family: 'Bangers', cursive; font-size: 0.85rem; color: #555; display: flex; align-items: center; gap: 8px; }
        .v4-pause { background: none; border: none; color: #333; cursor: pointer; }
        .v4-pause:hover { color: #ff00ff; }
        .v4-terminal { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column-reverse; gap: 12px; font-family: 'Roboto Mono', monospace; font-size: 0.72rem; }
        .v4-line { display: flex; gap: 12px; position: relative; }
        .v4-dot { width: 4px; height: 4px; background: #333; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
        .v4-line.success .v4-dot { background: #00ffaa; box-shadow: 0 0 5px #00ffaa; }
        .v4-line.brain .v4-dot { background: #ff00ff; box-shadow: 0 0 5px #ff00ff; }
        .v4-time { color: #444; margin-right: 8px; }
        .v4-msg { color: #888; line-height: 1.5; }
        .v4-line.success .v4-msg { color: #00ffaa; }

        .dashboard-main { flex: 1; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; background: radial-gradient(circle at top right, rgba(255,0,255,0.02), transparent 40%); }
        .dashboard-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 3.5rem; background: rgba(2,2,2,0.8); border-bottom: 1px solid #111; position: sticky; top: 0; z-index: 90; backdrop-filter: blur(20px); }
        .header-title h2 { font-family: 'Bangers', cursive; font-size: 2.2rem; margin: 0; letter-spacing: 2px; }
        .dashboard-content { padding: 3.5rem; max-width: 1500px; width: 100%; margin: 0 auto; }

        .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; }
        .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 2rem; }

        .glass-card { background: rgba(255,255,255,0.015); border: 1px solid #151515; border-radius: 24px; padding: 2.2rem; transition: 0.3s; }
        .glass-card:hover { border-color: #222; background: rgba(255,255,255,0.02); }
        .stat-value { font-size: 2.8rem; font-family: 'Bangers', cursive; margin: 5px 0; }
        .stat-label { font-size: 0.75rem; color: #555; text-transform: uppercase; letter-spacing: 1.5px; }
        .stat-sub { font-size: 0.75rem; color: #333; }

        .card-title { font-family: 'Bangers', cursive; font-size: 1.3rem; margin-bottom: 1.8rem; display: flex; align-items: center; color: #fff; letter-spacing: 1.5px; }

        .agent-row-v2 { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #111; }
        .v2-name { font-weight: 600; color: #999; }
        .v2-detail { font-family: monospace; font-size: 0.8rem; color: #444; }

        .btn-pink-pro { background: #ff00ff; color: #fff; border: none; padding: 1rem 2rem; border-radius: 14px; font-weight: bold; cursor: pointer; display: flex; gap: 12px; align-items: center; font-size: 1rem; box-shadow: 0 10px 30px rgba(255,0,255,0.2); transition: 0.2s; }
        .btn-pink-pro:hover { transform: translateY(-3px); box-shadow: 0 15px 40px rgba(255,0,255,0.3); }

        .decision-card-v3 { background: #090909; border: 1px solid #181818; border-radius: 20px; padding: 1.8rem; cursor: pointer; transition: 0.3s; }
        .decision-card-v3:hover { border-color: #ff00ff; background: #0d0d0d; }
        .v3-header { display: flex; justify-content: space-between; margin-bottom: 1rem; }
        .v3-action { font-family: 'Bangers', cursive; font-size: 1.2rem; color: #ff00ff; }
        .v3-status { font-size: 0.65rem; font-weight: bold; background: #111; padding: 3px 10px; border-radius: 20px; border: 1px solid #222; }
        .v3-status.success { color: #00ffaa; border-color: rgba(0,255,170,0.2); }
        .v3-reasoning { font-size: 0.9rem; color: #888; line-height: 1.6; margin-bottom: 1rem; height: 3.2em; overflow: hidden; }
        .v3-preview { background: rgba(0,255,170,0.05); color: #00ffaa; padding: 8px 12px; border-radius: 8px; font-size: 0.75rem; display: flex; align-items: center; gap: 8px; margin-bottom: 1rem; border: 1px solid rgba(0,255,170,0.1); }
        .v3-url { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .v3-footer { display: flex; justify-content: space-between; font-size: 0.7rem; color: #333; font-family: monospace; border-top: 1px solid #111; pt: 1rem; }

        /* ACTIVITY FEED (WORLD CLASS) */
        .activity-feed { display: flex; flex-direction: column; gap: 2rem; position: relative; }
        .activity-feed:before { content: ''; position: absolute; left: 11px; top: 0; bottom: 0; width: 1px; background: #111; }
        .feed-row { display: flex; gap: 2.5rem; cursor: pointer; transition: 0.2s; position: relative; }
        .feed-dot { width: 23px; height: 23px; background: #000; border: 2px solid #222; border-radius: 50%; z-index: 5; flex-shrink: 0; margin-top: 4px; transition: 0.2s; }
        .feed-row:hover .feed-dot { border-color: #ff00ff; background: #ff00ff; box-shadow: 0 0 15px rgba(255,0,255,0.4); }
        .feed-info { flex: 1; }
        .feed-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .feed-action { font-family: 'Bangers', cursive; font-size: 1.4rem; color: #fff; letter-spacing: 1px; }
        .feed-time { color: #444; font-size: 0.8rem; font-family: monospace; }
        .feed-text { font-size: 1rem; color: #999; line-height: 1.6; margin-bottom: 12px; }
        .feed-preview { color: #00ffaa; font-size: 0.85rem; margin-bottom: 12px; }
        .feed-meta { font-size: 0.75rem; color: #444; font-family: monospace; }
        .feed-meta .ok { color: #00ffaa; }
        .feed-meta .fail { color: #ff9900; }

        /* MODAL V2 */
        .modal-overlay-v2 { position: fixed; inset: 0; background: rgba(0,0,0,0.92); backdrop-filter: blur(30px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 2rem; }
        .modal-box-v2 { background: #080808; border: 1px solid #1a1a1a; border-radius: 32px; width: 100%; max-width: 950px; max-height: 90vh; overflow-y: auto; padding: 4rem; position: relative; box-shadow: 0 0 100px rgba(0,0,0,1); }
        .v2-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; }
        .v2-modal-header h2 { font-family: 'Bangers', cursive; font-size: 2.5rem; color: #ff00ff; margin: 0; letter-spacing: 2px; }
        .v2-close { background: none; border: none; color: #444; font-size: 2rem; cursor: pointer; transition: 0.2s; }
        .v2-close:hover { color: #fff; }
        .v2-section { margin-bottom: 2.5rem; }
        .v2-section label { display: block; color: #444; font-size: 0.75rem; font-weight: 800; letter-spacing: 2px; margin-bottom: 1rem; }
        .v2-reason-box { background: #0c0c0c; border: 1px solid #151515; padding: 2.5rem; border-radius: 20px; font-size: 1.2rem; line-height: 1.7; color: #eee; }
        .v2-data-box { color: #00ffaa; font-family: monospace; font-size: 1rem; }
        .v2-pre { background: #000; padding: 2rem; border-radius: 20px; font-size: 0.85rem; color: #555; overflow-x: auto; }
        .v2-done { background: #111; color: #666; border: 1px solid #222; padding: 1.2rem; border-radius: 16px; font-weight: bold; width: 100%; cursor: pointer; transition: 0.2s; }
        .v2-done:hover { background: #151515; color: #ff00ff; border-color: #ff00ff; }

        .toast-v2 { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); background: #ff00ff; color: #fff; padding: 1rem 2.5rem; border-radius: 15px; font-weight: bold; z-index: 2000; box-shadow: 0 10px 40px rgba(255,0,255,0.4); }

        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .timeline-list { display: flex; flex-direction: column; gap: 15px; }
        .timeline-item { border-left: 2px solid #ff00ff; padding-left: 15px; }
        .timeline-item.pending { border-left-color: #ff9900; }
        .item-meta { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .author { color: #00ffaa; font-weight: bold; font-size: 0.85rem; }
        .time { opacity: 0.4; font-size: 0.7rem; }
        .item-text { font-size: 0.9rem; opacity: 0.8; margin: 0; }
        .empty-state { text-align: center; padding: 3rem; opacity: 0.3; font-style: italic; }

        @media (max-width: 1100px) {
          .dashboard-sidebar { width: 90px; }
          .sidebar-brand span, .sidebar-item span, .brain-pulse-v4, .sidebar-badge { display: none; }
          .sidebar-item { justify-content: center; }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
