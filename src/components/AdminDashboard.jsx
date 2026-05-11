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

// ── Sub-component: StatusLed ───────────────────────────────────────────────────
const Led = ({ status }) => {
  const col = status === 'active' ? '#00ffaa' : status === 'idle' ? '#ff9900' : '#555';
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
      background: col, boxShadow: `0 0 8px ${col}`, marginRight: 10,
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

// ── Sub-component: DecisionCard ──────────────────────────────────────────────
const DecisionCard = ({ dec, onSelect }) => {
  const statusText = dec.success 
    ? '✅ EXECUTED' 
    : (dec.action?.includes('QUEUED') ? '🟡 QUEUED' : '❌ FAILED');
  
  const statusColor = dec.success ? 'success' : 'queued';

  return (
    <motion.div
      className="decision-card"
      whileHover={{ scale: 1.02, translateY: -5 }}
      onClick={() => onSelect(dec)}
    >
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

// ── Sub-component: BrainPulseSidebar ──────────────────────────────────────────
const BrainPulseSidebar = ({ logs, paused, onTogglePause }) => (
  <div className="sidebar-brain-pulse">
    <div className="sidebar-header">
      <span><FaBrain style={{ marginRight: 8 }} /> BRAIN PULSE</span>
      <button onClick={onTogglePause} title={paused ? "Resume" : "Pause"} className="ctrl-btn">
        {paused ? <FaPlay size={10} /> : <FaPause size={10} />}
      </button>
    </div>
    <div className="terminal-log">
      {logs.length === 0 && <p className="empty-log">Awaiting brain signals...</p>}
      {(logs || []).map((log, i) => (
        <div key={`${log.time}-${i}`} className={`log-line ${log.event?.toLowerCase()}`}>
          <span className="log-time">[{log.time}]</span>
          <span className="log-msg">{log.message}</span>
        </div>
      ))}
    </div>
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

// ── Sub-component: SensorControl ─────────────────────────────────────────────
const SensorControl = ({ currentFreq, onUpdate, API, showToast }) => {
  const [freq, setFreq] = useState(currentFreq || 25);
  useEffect(() => { if (currentFreq) setFreq(currentFreq); }, [currentFreq]);

  const apply = async () => {
    const d = await safeFetch(`${API}/api/admin/set-sensor-cooldown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes: freq })
    });
    if (d) {
      showToast('Sensor frequency updated!');
      onUpdate();
    }
  };

  return (
    <div className="glass-card">
      <h3 className="card-title"><FaGamepad style={{ marginRight: 10 }} /> Game Sensor Frequency</h3>
      <div className="sensor-slider-wrap">
        <input type="range" min="5" max="60" value={freq} onChange={e => setFreq(parseInt(e.target.value))} />
        <div className="sensor-value">Search every <strong>{freq}m</strong></div>
      </div>
      <button className="btn-pink" onClick={apply}>Apply Override</button>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const [activeTab, setActiveTab]     = useState('overview');
  const [refreshing, setRefreshing]   = useState(false);
  const [tabLoading, setTabLoading]   = useState(false);
  const [toast, setToast]             = useState(null);
  const [sidebarPaused, setSidebarPaused] = useState(false);

  // Data States
  const [status, setStatus]           = useState({});
  const [decisions, setDecisions]     = useState([]);
  const [history, setHistory]         = useState([]);
  const [brainLogs, setBrainLogs]     = useState([]);
  const [trenches, setTrenches]       = useState([]);
  const [posters, setPosters]         = useState([]);
  const [moments, setMoments]         = useState([]);
  const [queue, setQueue]             = useState([]);
  const [voiceData, setVoiceData]     = useState({ sessions: [] });
  const [ragData, setRagData]         = useState({ vectors: [] });
  
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
      if (tabId === 'trenches') setTrenches(await safeFetch(`${API}/api/admin/trenches?limit=40`) || []);
      if (tabId === 'posters') setPosters(await safeFetch(`${API}/api/admin/news-posters?limit=20`) || []);
      if (tabId === 'moments') setMoments(await safeFetch(`${API}/api/admin/game-moments`) || []);
      if (tabId === 'queue') setQueue(await safeFetch(`${API}/api/admin/queues`) || []);
      if (tabId === 'voice') setVoiceData(await safeFetch(`${API}/api/admin/voice-sessions`) || { sessions: [] });
      if (tabId === 'rag') setRagData(await safeFetch(`${API}/api/admin/rag-graph`) || { vectors: [] });
    } finally {
      setTabLoading(false);
    }
  }, [loadOverview, loadBrainData]);

  useEffect(() => { loadTabContent(activeTab); }, [activeTab, loadTabContent]);

  // Polling for live data
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
    showToast('Data refreshed');
  };

  const forceTick = async () => {
    showToast('Triggering autonomous tick...');
    await safeFetch(`${API}/api/admin/vibe-check`, { method: 'POST' });
    setTimeout(refreshTab, 2000);
  };

  const exportAll = () => {
    const data = { status, decisions, history, brainLogs, trenches, posters, moments, queue, voiceData, ragData };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `courage-admin-dump-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="dashboard-root">
      {/* SIDEBAR */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <FaDog style={{ fontSize: '1.8rem', color: '#ff00ff' }} />
          <span>COMMAND CENTER</span>
        </div>

        <nav className="sidebar-nav">
          {TABS.map(t => (
            <div
              key={t.id}
              className={`sidebar-item ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <t.icon />
              <span>{t.label}</span>
              {t.id === 'queue' && status.reply_queue_size > 0 && <span className="sidebar-badge">{status.reply_queue_size}</span>}
              {t.id === 'trenches' && status.unread_trenches > 0 && <span className="sidebar-badge">{status.unread_trenches}</span>}
            </div>
          ))}
        </nav>

        <BrainPulseSidebar 
          logs={brainLogs} 
          paused={sidebarPaused} 
          onTogglePause={() => setSidebarPaused(!sidebarPaused)} 
        />
      </aside>

      {/* MAIN CONTENT */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-title">
            <h2>{TABS.find(t => t.id === activeTab)?.label}</h2>
            {tabLoading && <div className="header-spinner"><FaSync className="animate-spin" /> Syncing...</div>}
          </div>

          <div className="header-actions">
            <button className="nav-btn" onClick={refreshTab} disabled={refreshing}>
              <FaSync className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button className="nav-btn" onClick={exportAll}>
              <FaDownload /> Export
            </button>
            <button className="nav-btn exit" onClick={() => window.location.href='/'}>
              Exit
            </button>
          </div>
        </header>

        <section className="dashboard-content">
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* OVERVIEW */}
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
                        <button className="btn-pink" style={{ marginBottom: 12 }} onClick={forceTick}>
                          <FaBolt style={{ marginRight: 10 }} /> Force Autonomous Tick
                        </button>
                        <SensorControl currentFreq={status.sensor_cooldown_minutes} onUpdate={refreshTab} API={API} showToast={showToast} />
                      </div>
                    </div>

                    <div className="glass-card" style={{ marginTop: '2rem' }}>
                      <h3 className="card-title"><FaHistory style={{ marginRight: 10 }} /> RECENT BRAIN DECISIONS</h3>
                      <div className="grid-3">
                        {(decisions || []).slice(0, 6).map((dec, i) => (
                          <DecisionCard key={i} dec={dec} onSelect={setSelectedDecision} />
                        ))}
                      </div>
                      {decisions?.length === 0 && <p className="empty-state">No decisions recorded today.</p>}
                    </div>
                  </div>
                )}

                {/* BRAIN (Neural Terminal) */}
                {activeTab === 'brain' && (
                   <div className="tab-container full-height">
                    <div className="glass-card neural-terminal">
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
                        {brainLogs?.length === 0 && <div className="empty-state">No neural signals detected in current window.</div>}
                      </div>
                    </div>
                   </div>
                )}

                {/* DECISIONS (Full History) */}
                {activeTab === 'decisions' && (
                  <div className="tab-container">
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
                            {dec.data_preview && <div className="rich-meta">{dec.data_preview}</div>}
                            <div className="row-footer">
                              <span className={`status ${dec.success ? 'ok' : 'fail'}`}>
                                {dec.success ? '✓ EXECUTED' : '✗ FAILED'}
                              </span>
                              <span>🔧 {dec.tool_used}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TOKEN HUSTLE */}
                {activeTab === 'token' && (
                  <div className="tab-container">
                    <div className="grid-3">
                       <StatCard label="RCR PRICE" value={`$${status.rcr_price}`} sub="Live Solana Feed" color="#00ffaa" />
                       <StatCard label="DAILY VOLUME" value={status.rcr_stats?.volume_24h || '—'} sub="Last 24h" color="#ff9900" />
                       <StatCard label="TOTAL HOLDERS" value="1,402" sub="+12 today" color="#ff00ff" />
                    </div>
                    <div className="glass-card" style={{ marginTop: '2rem' }}>
                      <h3 className="card-title">Price Performance (Last 24h)</h3>
                      <div className="placeholder-chart">
                         {/* We will map price_history here if we had a chart component, for now simple list */}
                         {(status.price_history || []).map((p, i) => (
                           <div key={i} className="price-row">
                             <span>{new Date(p.date).toLocaleTimeString()}</span>
                             <span style={{ color: '#00ffaa' }}>${p.price.toFixed(6)}</span>
                           </div>
                         ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TRENCHES */}
                {activeTab === 'trenches' && (
                  <div className="tab-container">
                    <div className="trench-grid">
                      {(trenches || []).map(t => (
                        <div key={t.tweet_id} className="glass-card trench-card">
                          <div className="author">@{t.author}</div>
                          <p className="text">{t.text}</p>
                          <a href={`https://x.com/any/status/${t.tweet_id}`} target="_blank" rel="noreferrer" className="trench-link">
                            View on X <FaTwitter />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* GAME MOMENTS */}
                {activeTab === 'moments' && (
                   <div className="tab-container">
                     <div className="glass-card">
                        <h3 className="card-title">Recent Player Interactions</h3>
                        <div className="moments-list">
                          {(moments || []).map((m, i) => (
                            <div key={i} className="moment-row">
                               <div className="moment-icon"><FaGamepad /></div>
                               <div className="moment-info">
                                  <div className="moment-user">@{m.author}</div>
                                  <div className="moment-msg">{m.message || "Interacted with Courage"}</div>
                               </div>
                               <div className="moment-time">{m.timestamp || "Just now"}</div>
                            </div>
                          ))}
                          {moments?.length === 0 && <div className="empty-state">No player moments captured yet.</div>}
                        </div>
                     </div>
                   </div>
                )}

                {/* QUEUE INSPECTOR */}
                {activeTab === 'queue' && (
                   <div className="tab-container">
                      <div className="glass-card">
                         <h3 className="card-title">Pending Reply Queue ({queue?.length || 0})</h3>
                         <div className="queue-list">
                            {(queue || []).map((q, i) => (
                              <div key={i} className="queue-item">
                                 <div className="queue-meta">
                                    <span className="target">Target: @{q.target_user}</span>
                                    <span className="priority">HIGH PRIORITY</span>
                                 </div>
                                 <p className="queue-text">{q.text}</p>
                                 <div className="queue-actions">
                                    <button className="btn-small"><FaTrash /> Drop</button>
                                    <button className="btn-small"><FaPlay /> Force Send</button>
                                 </div>
                              </div>
                            ))}
                            {queue?.length === 0 && <div className="empty-state">Queue is empty. Courage is caught up.</div>}
                         </div>
                      </div>
                   </div>
                )}

                {/* VOICE LIVE */}
                {activeTab === 'voice' && (
                   <div className="tab-container">
                      <div className="grid-2">
                        <div className="glass-card">
                           <h3 className="card-title">Active Voice Sessions</h3>
                           <div className="sessions-list">
                              {(voiceData.sessions || []).map((s, i) => (
                                <div key={i} className="session-item">
                                   <div className="session-header">
                                      <Led status="active" /> <span>Session #{s.session_id}</span>
                                   </div>
                                   <div className="session-meta">User: {s.user_id} | Status: {s.status}</div>
                                </div>
                              ))}
                              {voiceData.sessions?.length === 0 && <div className="empty-state">No active voice sessions.</div>}
                           </div>
                        </div>
                        <div className="glass-card">
                           <h3 className="card-title">Voice Priority Guard</h3>
                           <div className={`guard-status ${voiceData.active ? 'active' : 'idle'}`}>
                              {voiceData.active ? '🔥 VOICE ACTIVE - AGENT PAUSED' : '✓ IDLE - AGENT RUNNING'}
                           </div>
                           <p style={{ marginTop: 20, fontSize: '0.8rem', opacity: 0.5 }}>
                              When a user is on the mic, Courage automatically pauses all autonomous background tasks to preserve personality consistency.
                           </p>
                        </div>
                      </div>
                   </div>
                )}

                {/* NEWS POSTERS */}
                {activeTab === 'posters' && (
                  <div className="tab-container">
                    <div className="posters-grid">
                      {(posters || []).map((p, i) => (
                        <div key={i} className="glass-card poster-card">
                          <img src={`${API}${p}`} alt="News Poster" />
                          <div style={{ marginTop: 10, fontSize: '0.7rem', opacity: 0.5 }}>{p.split('/').pop()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* RAG MEMORY */}
                {activeTab === 'rag' && (
                  <div className="tab-container">
                    <div className="glass-card">
                      <h3 className="card-title">Vector Memory Graph</h3>
                      <div className="memory-list">
                        {(ragData.vectors || []).map(v => (
                          <div key={v.id} className="memory-item">
                            <span className="source">[{v.source.toUpperCase()}]</span>
                            <span className="text">{v.text_preview}</span>
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

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {selectedDecision && (
          <div className="modal-overlay" onClick={() => setSelectedDecision(null)}>
            <motion.div 
              className="modal-content" 
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="modal-header">
                <h2>{selectedDecision.action}</h2>
                <button className="close-btn" onClick={() => setSelectedDecision(null)}>×</button>
              </div>
              <div className={`status-pill ${selectedDecision.success ? 'ok' : 'fail'}`}>
                {selectedDecision.success ? 'STABLE EXECUTION' : 'EXECUTION FAILED'}
              </div>
              <div className="section-label">Brain Reasoning</div>
              <div className="reasoning-box">{selectedDecision.reasoning}</div>
              <div className="section-label">Technical Trace</div>
              <pre style={{ fontSize: '0.8rem', opacity: 0.4, background: '#000', padding: '1rem', borderRadius: '10px', overflowX: 'auto' }}>
                {JSON.stringify(selectedDecision, null, 2)}
              </pre>
              <button className="btn-pink" onClick={() => setSelectedDecision(null)} style={{ marginTop: '2rem' }}>CLOSE DETAIL</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST */}
      {toast && <div className={`toast ${toast.type === 'err' ? 'err' : ''}`}>{toast.msg}</div>}

      {/* STYLES */}
      <style>{`
        .dashboard-root {
          display: flex;
          height: 100vh;
          width: 100%;
          background: #050505;
          color: #fff;
          overflow: hidden;
          font-family: 'Inter', sans-serif;
        }

        .dashboard-sidebar {
          width: 300px;
          flex-shrink: 0;
          background: rgba(0,0,0,0.4);
          border-right: 1px solid rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
          padding: 1.5rem;
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          z-index: 100;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0.5rem;
          margin-bottom: 2rem;
          font-family: 'Bangers', cursive;
          font-size: 1.4rem;
          letter-spacing: 2px;
          color: #ff00ff;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          flex: 1;
          overflow-y: auto;
          margin-bottom: 1.5rem;
        }

        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0.85rem 1.25rem;
          border-radius: 14px;
          cursor: pointer;
          color: #888;
          font-weight: 500;
          transition: all 0.2s;
        }

        .sidebar-item:hover { color: #fff; background: rgba(255,255,255,0.03); }
        .sidebar-item.active {
          background: rgba(255, 0, 255, 0.1);
          color: #ff00ff;
          border: 1px solid rgba(255,0,255,0.2);
        }

        .sidebar-badge {
          background: #ff00ff;
          color: #fff;
          font-size: 0.65rem;
          padding: 2px 6px;
          border-radius: 10px;
          margin-left: auto;
          font-weight: bold;
        }

        .sidebar-brain-pulse {
          background: rgba(0,0,0,0.3);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.05);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          height: 300px;
          overflow: hidden;
        }

        .dashboard-main {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
          background: radial-gradient(circle at top right, rgba(255,0,255,0.03), transparent 40%);
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 3rem;
          background: rgba(5,5,5,0.8);
          backdrop-filter: blur(15px);
          position: sticky;
          top: 0;
          z-index: 90;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .header-title h2 { font-family: 'Bangers', cursive; letter-spacing: 1.5px; font-size: 2rem; margin: 0; }
        .header-spinner { font-size: 0.75rem; color: #ff00ff; display: flex; align-items: center; gap: 6px; margin-top: 4px; }
        .header-actions { display: flex; gap: 12px; }

        .dashboard-content { padding: 3rem; max-width: 1600px; width: 100%; margin: 0 auto; }

        .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem; }
        .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem; }
        .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem; }

        .glass-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 24px;
          padding: 2rem;
          backdrop-filter: blur(10px);
        }

        .stat-card { transition: all 0.2s; }
        .stat-card:hover { border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); }
        .stat-label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; }
        .stat-value { font-size: 2.5rem; font-family: 'Bangers', cursive; }
        .stat-sub { font-size: 0.75rem; opacity: 0.4; margin-top: 0.25rem; }

        .card-title { font-family: 'Bangers', cursive; font-size: 1.2rem; letter-spacing: 1.5px; margin-bottom: 1.5rem; display: flex; align-items: center; }

        .agent-row { display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .agent-name { flex: 1; font-weight: 500; }
        .agent-detail { font-size: 0.8rem; opacity: 0.4; font-family: monospace; }

        .btn-pink {
          background: rgba(255,0,255,0.1);
          border: 1px solid #ff00ff;
          color: #ff00ff;
          padding: 0.8rem 1.5rem;
          border-radius: 12px;
          font-weight: bold;
          cursor: pointer;
          width: 100%;
          transition: all 0.2s;
        }
        .btn-pink:hover { background: rgba(255,0,255,0.2); box-shadow: 0 0 20px rgba(255,0,255,0.2); }

        .nav-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          padding: 0.6rem 1.2rem;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 600;
        }
        .nav-btn:hover { background: rgba(255,255,255,0.1); border-color: #ff00ff; color: #ff00ff; }

        .decision-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 20px;
          padding: 1.5rem;
          cursor: pointer;
          transition: all 0.3s;
        }
        .decision-card:hover { border-color: #ff00ff; transform: translateY(-5px); }
        .action-badge { font-family: 'Bangers', cursive; color: #ff00ff; font-size: 1.1rem; }
        .status-badge { font-size: 0.65rem; font-weight: bold; padding: 3px 10px; border-radius: 20px; }
        .status-badge.success { background: rgba(0,255,170,0.1); color: #00ffaa; }
        .status-badge.queued { background: rgba(255,153,0,0.1); color: #ff9900; }
        .reason-preview { font-size: 0.9rem; opacity: 0.7; line-height: 1.6; margin: 1rem 0; height: 4.8em; overflow: hidden; }
        
        .rich-data-preview {
          background: rgba(0,0,0,0.3);
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 0.75rem;
          color: #00ffaa;
          display: flex;
          align-items: center;
          margin-bottom: 1rem;
          border: 1px solid rgba(0,255,170,0.1);
        }
        .preview-url { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .meta { display: flex; justify-content: space-between; font-size: 0.75rem; opacity: 0.4; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem; }

        .terminal-log { flex: 1; overflow-y: auto; display: flex; flex-direction: column-reverse; gap: 8px; }
        .log-line { font-size: 0.75rem; line-height: 1.4; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .log-time { color: #555; margin-right: 8px; }
        .log-msg { color: #aaa; }

        .neural-terminal { height: 600px; display: flex; flex-direction: column; padding: 0; overflow: hidden; }
        .terminal-header { padding: 1rem 2rem; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; }
        .vibe-badge { font-size: 0.7rem; color: #ff00ff; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; }
        .terminal-body { flex: 1; overflow-y: auto; padding: 1.5rem; font-family: monospace; font-size: 0.85rem; line-height: 1.6; }
        .log-row { margin-bottom: 8px; display: flex; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.02); padding-bottom: 4px; }
        .timestamp { color: #555; }
        .event-tag { color: #ff00ff; font-weight: bold; min-width: 100px; }
        .log-row.success .message { color: #00ffaa; }

        .price-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.02); }

        .moment-row { display: flex; align-items: center; gap: 15px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .moment-icon { color: #ff00ff; }
        .moment-user { font-weight: bold; color: #00ffaa; font-size: 0.9rem; }
        .moment-msg { font-size: 0.85rem; opacity: 0.7; }
        .moment-time { margin-left: auto; font-size: 0.7rem; opacity: 0.4; }

        .queue-item { background: rgba(0,0,0,0.2); border-radius: 12px; padding: 1rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.05); }
        .queue-meta { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.75rem; }
        .queue-text { font-size: 0.9rem; margin-bottom: 12px; line-height: 1.5; }
        .queue-actions { display: flex; gap: 10px; }

        .btn-small { background: rgba(255,255,255,0.05); border: 1px solid #333; color: #888; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 6px; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); backdrop-filter: blur(20px); z-index: 1000; display: flex; align-items: center; justifyContent: center; padding: 2rem; }
        .modal-content { background: #080808; border: 1px solid #222; border-radius: 32px; width: 100%; max-width: 900px; padding: 3rem; position: relative; }
        .reasoning-box { background: rgba(255,255,255,0.03); padding: 2rem; border-radius: 20px; line-height: 1.7; font-size: 1.1rem; color: #eee; }
        
        .toast { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); background: #00ffaa; color: #000; padding: 0.8rem 2rem; border-radius: 15px; font-weight: bold; z-index: 2000; box-shadow: 0 10px 40px rgba(0,255,170,0.3); }

        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .empty-state { text-align: center; padding: 4rem; opacity: 0.3; font-style: italic; }

        .trench-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
        .posters-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem; }
        .poster-card img { width: 100%; border-radius: 12px; }

        @media (max-width: 1100px) {
          .dashboard-sidebar { width: 80px; }
          .sidebar-brand span, .sidebar-item span, .sidebar-brain-pulse, .sidebar-badge { display: none; }
          .sidebar-item { justify-content: center; }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
