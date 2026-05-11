import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaRobot, FaBrain, FaBolt, FaHistory, FaChartLine,
  FaUsers, FaDog, FaNewspaper, FaGamepad, FaList,
  FaTrash, FaSync, FaCheckCircle, FaClock, FaCopy, FaDownload,
  FaMicrophone, FaSitemap, FaPlay, FaPause, FaTwitter, FaTerminal, FaExternalLinkAlt
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
  { id: 'queue',     label: '🔄 Queue Inspector',   icon: FaList      },
  { id: 'voice',     label: '🎤 Voice Live',        icon: FaMicrophone },
  { id: 'rag',       label: '🧬 RAG Memory Graph',  icon: FaSitemap    },
];

const API = import.meta.env.VITE_BACKEND_URL || '';

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

const safeFetch = async (url, opts) => {
  try {
    const r = await fetch(url, opts);
    if (!r.ok) {
       console.warn(`Fetch non-ok: ${url} -> ${r.status}`);
       return null;
    }
    const data = await r.json();
    console.log(`Fetch Success: ${url}`, data);
    return data;
  } catch (err) {
    console.error("Fetch Error:", url, err);
    return null;
  }
};

const SafeImage = ({ src, alt, style, className }) => {
  const [error, setError] = useState(false);
  if (error || !src) return <div style={{ ...style, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', opacity: 0.3 }}>Media Unavailable</div>;
  
  return (
    <img 
      crossOrigin="anonymous" 
      src={src} 
      alt={alt} 
      style={style} 
      className={className} 
      onError={() => setError(true)}
    />
  );
};

const parseReasoning = (raw) => {
  if (!raw || raw === "...") return "Autonomous decision in progress or awaiting details...";
  try {
    const parsed = JSON.parse(raw);
    if (parsed.text) return parsed.text;
    if (parsed.content) return parsed.content;
    if (parsed.article_url) return `News React: ${parsed.article_url}`;
    if (parsed.vibe) return `Personality Post: ${parsed.vibe} mode`;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
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

// ── Sub-component: DecisionCard ──────────────────────────────────────────────
const DecisionCard = ({ dec, onSelect }) => {
  const isQueued = dec.status === 'queued';
  const isSuccess = dec.success || dec.status === 'success' || dec.status === 'succeeded' || dec.status === 'posted';
  const isFailed = dec.error || dec.status === 'failed' || dec.status === 'error';
  
  let statusLabel = '🔄 PROCESSING';
  let statusColor = '#ff9900';
  if (isQueued) { statusLabel = '⏳ QUEUED'; statusColor = '#ff9900'; }
  else if (isSuccess) { statusLabel = '✅ EXECUTED'; statusColor = '#00ffaa'; }
  else if (isFailed) { statusLabel = '❌ FAILED'; statusColor = '#ff4444'; }

  // Smart Title Logic
  let displayTitle = dec.action || 'Autonomous Move';
  if (dec.action === 'PROACTIVE_PERSONALITY_POST' || dec.action === 'proactive_personality_post') {
    try {
      const p = JSON.parse(dec.reasoning);
      displayTitle = `${p.vibe?.toUpperCase() || 'RANDOM'} Vibe Post`;
    } catch { displayTitle = 'Personality Post'; }
  } else if (dec.action === 'AUTO_NEWS_REACT' || dec.action === 'auto_news_react') {
    displayTitle = 'News Reaction';
  } else if (dec.action === 'QUEUED_POST') {
    displayTitle = 'Pending Tweet';
  }

  const dataUrl = dec.data_preview || (dec.reasoning?.includes('http') ? dec.reasoning.match(/https?:\/\/[^\s"}]+/)?.[0] : null);
  const isImage = dataUrl && (dataUrl.match(/\.(jpeg|jpg|gif|png|webp)/i) || dataUrl.includes('fal.ai') || dataUrl.includes('image'));

  return (
    <motion.div
      className="decision-card-v2 glass-card"
      whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.04)' }}
      onClick={() => onSelect(dec)}
      style={{ 
        borderLeft: `4px solid ${statusColor}`, 
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <strong style={{ fontSize: '1.2rem', color: '#fff', fontFamily: 'Bangers, cursive', letterSpacing: 1.5 }}>
            {displayTitle}
          </strong>
          <span style={{ fontSize: '0.6rem', opacity: 0.5, textTransform: 'uppercase', marginTop: 2 }}>
            {dec.action}
          </span>
        </div>
        <span style={{ 
          fontSize: '0.65rem', 
          fontWeight: 'bold', 
          color: statusColor, 
          background: `${statusColor}15`, 
          padding: '4px 10px', 
          borderRadius: 6,
          border: `1px solid ${statusColor}33`
        }}>
          {statusLabel}
        </span>
      </div>

      {isImage ? (
        <div style={{ width: '100%', height: 160, borderRadius: 12, overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.1)' }}>
          <SafeImage src={dataUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : dataUrl ? (
        <div style={{ 
          background: 'rgba(0,255,170,0.05)', 
          padding: '10px', 
          borderRadius: 8, 
          border: '1px dashed rgba(0,255,170,0.2)',
          fontSize: '0.75rem',
          color: '#00ffaa',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span>🔗</span>
          <a href={dataUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dataUrl}
          </a>
        </div>
      ) : null}

      <p style={{ fontSize: '0.9rem', opacity: 0.85, margin: 0, lineHeight: 1.5, color: '#eee' }}>
        {parseReasoning(dec.reasoning)}
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', opacity: 0.4 }}>
        <span>{dec.time || "Pending..."}</span>
        <div style={{ display: 'flex', gap: 12 }}>
          {dec.tool_used && <span>🔧 {dec.tool_used}</span>}
          <span>ID: {dec.id || '—'}</span>
        </div>
      </div>
    </motion.div>
  );
};

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

// ── Sub-component: BrainPulseSidebar ──────────────────────────────────────────
const BrainPulseSidebar = ({ logs, paused, onTogglePause, collapsed, onToggleCollapse }) => (
  <motion.div 
    className="brain-sidebar glass-card"
    animate={{ width: collapsed ? 60 : 300 }}
    transition={{ type: 'spring', damping: 20 }}
  >
    <div className="sidebar-header">
      {!collapsed && <span><FaBrain style={{ marginRight: 8 }} /> BRAIN PULSE</span>}
      <div className="sidebar-controls">
        <button onClick={onTogglePause} title={paused ? "Resume" : "Pause"}>
          {paused ? '▶️' : '⏸️'}
        </button>
        <button onClick={onToggleCollapse} title={collapsed ? "Expand" : "Collapse"}>
          {collapsed ? '→' : '←'}
        </button>
      </div>
    </div>
    
    {!collapsed && (
      <div className="terminal-log">
        {logs.length === 0 && <p className="empty-log">Awaiting brain signals...</p>}
        {logs.map((log, i) => (
          <motion.div
            key={`${log.time}-${i}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`log-line ${log.event?.toLowerCase() || 'default'}`}
            style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}
          >
            <span className="v4-dot" style={{ 
              width: 4, height: 4, borderRadius: '50%', background: log.event === 'SUCCESS' ? '#00ffaa' : log.event === 'BRAIN' ? '#ff00ff' : '#333',
              marginTop: 6, flexShrink: 0, boxShadow: log.event === 'SUCCESS' ? '0 0 5px #00ffaa' : 'none'
            }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              <span className="log-time" style={{ opacity: 0.4, minWidth: '55px' }}>[{log.time}]</span>
              <span className="log-msg" style={{ 
                color: log.event === 'SUCCESS' ? '#00ffaa' : log.event === 'BRAIN' ? '#ff00ff' : '#ccc',
                fontFamily: "'Roboto Mono', monospace"
              }}>{log.message}</span>
            </div>
          </motion.div>
        ))}
      </div>
    )}
  </motion.div>
);

const MemoryPreview = ({ content }) => {
  if (!content) return null;
  const urlMatch = content.match(/https?:\/\/[^\s"}]+/);
  const url = urlMatch ? urlMatch[0] : null;
  const isImage = url && (url.match(/\.(jpeg|jpg|gif|png|webp)/i) || url.includes('fal.ai') || url.includes('image'));

  if (!url) return <div style={{ opacity: 0.85, lineHeight: 1.4 }}>{content}</div>;

  const textBefore = content.split(url)[0];
  const textAfter = content.split(url)[1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' }}>
      <div style={{ opacity: 0.9, fontSize: '0.8rem' }}>
        {textBefore}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" 
             style={{ color: '#ff00ff', textDecoration: 'none', borderBottom: '1px dashed #ff00ff44', margin: '0 4px' }}>
             {url.length > 40 ? url.substring(0, 37) + '...' : url}
          </a>
        )}
        {textAfter}
      </div>
      {isImage && (
        <div style={{ 
          width: 120, height: 80, borderRadius: 8, overflow: 'hidden', 
          border: '1px solid rgba(255,0,255,0.2)', background: '#000',
          marginTop: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <SafeImage 
            src={url} 
            alt="memory-preview" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        </div>
      )}
    </div>
  );
};

// ── Sub-component: SensorControl ─────────────────────────────────────────────
const SensorControl = ({ currentFreq, onUpdate, API, showToast }) => {
  const [freq, setFreq] = useState(currentFreq || 25);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  
  useEffect(() => {
    if (currentFreq) setFreq(currentFreq);
  }, [currentFreq]);

  const apply = async () => {
    setSaving(true);
    const d = await safeFetch(`${API}/api/admin/set-sensor-cooldown?minutes=${freq}`, {
      method: 'POST',
    });
    setSaving(false);
    if (d) {
      setJustSaved(true);
      showToast('Sensor frequency updated and saved to global config!');
      onUpdate();
      setTimeout(() => setJustSaved(false), 2000);
    } else {
      showToast('Failed to update sensor frequency', 'err');
    }
  };

  return (
    <div className="sensor-control-card glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 className="card-title" style={{ margin: 0 }}><FaGamepad style={{ marginRight: 8 }} /> Pulse Frequency</h3>
        <span style={{ 
          background: '#ff00ff22', color: '#ff00ff', padding: '4px 12px', borderRadius: 20, 
          fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid #ff00ff44',
          boxShadow: '0 0 10px rgba(255,0,255,0.1)'
        }}>
          {freq}m interval
        </span>
      </div>

      <div className="sensor-slider-wrap" style={{ marginBottom: '1.5rem' }}>
        <input 
          type="range" 
          min="5" 
          max="60" 
          step="5"
          className="spruce-slider"
          value={freq} 
          onChange={e => setFreq(parseInt(e.target.value))} 
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.65rem', opacity: 0.3, letterSpacing: 1 }}>
          <span>HYPER (5M)</span>
          <span>STABLE (60M)</span>
        </div>
      </div>

      <button 
        className={justSaved ? "btn-success" : "btn-pink"} 
        onClick={apply} 
        disabled={saving}
        style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {saving ? <FaSync className="spin" /> : justSaved ? <FaCheckCircle /> : <FaBolt />}
        {saving ? 'UPDATING...' : justSaved ? 'APPLIED!' : 'SYNC FREQUENCY'}
      </button>

      {justSaved && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          style={{ position: 'absolute', top: 10, right: 10, color: '#00ffaa' }}
        >
          <FaCheckCircle size={20} />
        </motion.div>
      )}
    </div>
  );
};

const MemorySprucePreview = ({ content }) => {
  if (!content) return null;
  const urlMatch = content.match(/https?:\/\/[^\s"}]+/);
  const url = urlMatch ? urlMatch[0] : null;
  const isImage = url && (url.match(/\.(jpeg|jpg|gif|png|webp)/i) || url.includes('fal.ai') || url.includes('image'));

  if (!url) return null;

  return (
    <div style={{ marginTop: 12 }}>
      {isImage ? (
        <div style={{ width: '100%', maxHeight: 300, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,0,255,0.2)', background: '#000' }}>
          <SafeImage src={url} alt="memory-big-preview" style={{ width: '100%', display: 'block' }} />
        </div>
      ) : (
        <div style={{ background: 'rgba(255,0,255,0.05)', padding: 20, borderRadius: 16, border: '1px solid rgba(255,0,255,0.1)', display: 'flex', alignItems: 'center', gap: 15 }}>
          <FaExternalLinkAlt color="#ff00ff" size={24} />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '0.65rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>External Resource</div>
            <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#ff00ff', textDecoration: 'none', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
              {url}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

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

  // 10/10 Enhancements State
  const [brainLogs, setBrainLogs] = useState([]);
  const [isLogPaused, setIsLogPaused] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [memoryDetail, setMemoryDetail] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [selectedDecision, setSelectedDecision] = useState(null);
  const [queueData, setQueueData] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'timeline'
  const [voiceData, setVoiceData] = useState({ active: false, sessions: [], count: 0 });
  const [ragData, setRagData] = useState({ vectors: [] });
  const [selectedMemory, setSelectedMemory] = useState(null);

  // ── Fetch helpers — merge into existing state to avoid flicker ───────────────
  const loadStatus = useCallback(async () => {
    const d = await safeFetch(`${API}/api/admin/system-status`);
    if (d) {
      setStatus(prev => ({ ...prev, ...d }));
    }
  }, []);

  const loadAgents = useCallback(async () => {
    const d = await safeFetch(`${API}/api/admin/sub_agents_status`);
    if (d) setAgents(prev => ({ ...prev, ...d }));
    const m = await safeFetch(`${API}/api/admin/memory-vectors`);
    if (m) setMemory(m);
    const mDetail = await safeFetch(`${API}/api/admin/memory-vectors/detail`);
    if (mDetail) setMemoryDetail(mDetail.vectors || []);
  }, []);

  const loadBrain = useCallback(async () => {
    const d = await safeFetch(`${API}/api/admin/live-activity`);
    if (d) {
      setActivity(d);
      if (!isLogPaused) {
        setBrainLogs(prev => {
          const combined = [...d, ...prev];
          const seen = new Set();
          return combined.filter(item => {
            const key = `${item.time}-${item.message}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }).slice(0, 100);
        });
      }
    }
    const h = await safeFetch(`${API}/api/admin/history`);
    if (h) setHistory(h);
    
    // NEW: Populate the 'decisions' state used by the Live Brain tab
    const dec = await safeFetch(`${API}/api/admin/recent-decisions`);
    if (dec) setDecisions(dec);
  }, [isLogPaused]);

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
    const d = await safeFetch(`${API}/api/admin/queues`);
    if (d) setQueueData(d);
  }, []);

  const loadVoiceData = useCallback(async () => {
    const d = await safeFetch(`${API}/api/admin/voice-sessions`);
    if (d) setVoiceData(d);
  }, []);

  const loadRagData = useCallback(async () => {
    const d = await safeFetch(`${API}/api/admin/rag-graph`);
    if (d) setRagData(d);
  }, []);

  // ── Initial load: fetch everything ──────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      loadStatus(), loadAgents(), loadBrain(),
      loadTrenches(), loadPosters(), loadMoments(), loadQueue(),
      loadVoiceData(), loadRagData(),
    ]).then(async () => {
      const mCount = await safeFetch(`${API}/api/admin/memory-vectors`);
      if (mCount) setMemory(mCount);
      setInitialLoad(false);
    });
  }, []);

  // ── 30s refresh — only overview stats + current tab ─────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      await Promise.all([loadStatus(), loadAgents()]);
      const loaders = {
        brain: loadBrain, decisions: loadBrain, trenches: loadTrenches,
        posters: loadPosters, moments: loadMoments, queue: loadQueue,
        voice: loadVoiceData, rag: loadRagData,
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
      loadVoiceData(), loadRagData(),
    ]);
    const mCount = await safeFetch(`${API}/api/admin/memory-vectors`);
    if (mCount) setMemory(mCount);
    const decData = await safeFetch(`${API}/api/admin/recent-decisions`);
    if (decData) setDecisions(decData);

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

  const triggerTrenchScan = async () => {
    const d = await safeFetch(`${API}/api/autonomous/trench-scan`, { method: 'POST' });
    showToast(d?.message || 'Trench scan complete!');
    await loadTrenches();
  };

  const triggerMarketPulse = async () => {
    const d = await safeFetch(`${API}/api/autonomous/market-pulse`, { method: 'POST' });
    showToast(d?.message || 'Market pulse updated!');
    await loadStatus();
  };

  const resetBreaker = async () => {
    const d = await safeFetch(`${API}/api/autonomous/reset-circuit-breaker`, { method: 'POST' });
    showToast(d?.message || 'Circuit breaker reset!');
    await loadStatus();
  };

  const clearQueue = async () => {
    if (!window.confirm('Clear the entire reply queue?')) return;
    const d = await safeFetch(`${API}/api/admin/queues`, { method: 'DELETE' });
    showToast(d?.message || 'Queue cleared!', d ? 'ok' : 'err');
    await loadQueue();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text).then(() => showToast('Copied!')).catch(() => showToast('Copy failed', 'err'));
  };

  const exportDecisions = () => {
    if (!history.length) return showToast('No history to export', 'err');
    const headers = ['Timestamp', 'Action', 'Tool', 'Success', 'Reasoning'];
    const rows = history.map(h => [
      h.timestamp ? new Date(h.timestamp).toISOString() : '',
      h.action || '',
      h.tool_used || '',
      h.success ? 'TRUE' : 'FALSE',
      (h.reasoning || '').replace(/"/g, '""')
    ]);
    const csvContent = [headers, ...rows].map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `courage_decisions_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exporting CSV...');
  };

  const exportAllData = () => {
    const data = {
      decisions,
      queueData,
      activity,
      status,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `courage_full_export_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Full JSON Export Ready');
  };

  const processQueueItem = async (queueName, index) => {
    const d = await safeFetch(`${API}/api/admin/queues/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_name: queueName, item_index: index })
    });
    if (d) {
      showToast(d.status === 'success' || d.status === 'processed' ? 'Item processed!' : 'Processing failed', (d.status === 'success' || d.status === 'processed') ? 'ok' : 'err');
      loadQueue();
    }
  };

  const endVoiceSession = async (sessionId) => {
    const d = await safeFetch(`${API}/api/admin/voice-sessions/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId })
    });
    if (d) {
      showToast('Session ended');
      loadVoiceData();
    }
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
          <button style={{ ...styles.navBtn, background: '#00ffaa33', color: '#00ffaa' }} onClick={exportAllData}>
            <FaDownload style={{ marginRight: 6 }} /> Export All (JSON)
          </button>
          <a href="/" style={styles.navLink}>Exit</a>
        </div>
      </nav>

      {/* TABS */}
      <div style={styles.tabBar}>
        {TABS.map(t => {
          let count = 0;
          if (t.id === 'queue') count = queueData?.counts?.replies || 0;
          if (t.id === 'trenches') count = trenches.total_unprocessed || 0;

          return (
            <button
              key={t.id}
              style={{ ...styles.tab, ...(activeTab === t.id ? styles.tabActive : {}) }}
              onClick={() => setActiveTab(t.id)}
            >
              <t.icon style={{ marginRight: 6 }} />{t.label}
              {count > 0 && (
                <span style={{ ...styles.badge, background: t.id === 'trenches' ? '#ff00ff' : '#ff9900' }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* MAIN LAYOUT */}
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        <BrainPulseSidebar 
          logs={brainLogs} 
          paused={isLogPaused} 
          onTogglePause={() => setIsLogPaused(!isLogPaused)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <main style={{ flex: 1, padding: '0 0 4rem', position: 'relative', minWidth: 0 }}>
          <ErrorBoundary>
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
                  <StatCard label="QUEUED ACTIONS" value={(queueData?.counts?.replies || 0) + (queueData?.counts?.game_moments || 0)} sub="Pending execution" color="#ff9900"
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
                  </div>

                  <div className="glass-card" style={styles.card}>
                    <h3 style={styles.cardTitle}><FaBolt style={{ marginRight: 8 }} />Quick Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <button style={styles.btnPink} onClick={triggerTick}>⚡ FORCE BRAIN TICK</button>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <button style={{ ...styles.btnSmall, padding: '10px' }} onClick={triggerTrenchScan}>🔍 TRENCH SCAN</button>
                        <button style={{ ...styles.btnSmall, padding: '10px' }} onClick={triggerMarketPulse}>📈 MARKET PULSE</button>
                      </div>
                      <button style={{ ...styles.btnSmall, opacity: 0.7 }} onClick={resetBreaker}>Reset Groq Circuit Breaker</button>
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

                {/* EPIC 10/10: Decision Cards Grid in Overview */}
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h2 style={{ ...styles.cardTitle, margin: 0 }}><FaBrain style={{ marginRight: 8 }} />Latest Brain Decisions</h2>
                    <button style={styles.btnSmall} onClick={() => setActiveTab('decisions')}>View All</button>
                  </div>
                  <div style={styles.grid3}>
                    {decisions.slice(0, 3).map(dec => (
                      <DecisionCard key={dec.id} dec={dec} onSelect={setSelectedDecision} />
                    ))}
                    {decisions.length === 0 && <p style={{ opacity: 0.3, gridColumn: '1/-1', textAlign: 'center' }}>Waiting for the brain to wake up...</p>}
                  </div>
                </div>

                {/* New Controls & Memory Vault */}
                <div style={styles.grid2}>
                  <SensorControl 
                    currentFreq={status?.sensor_cooldown_minutes} 
                    onUpdate={loadStatus} 
                    API={API} 
                    showToast={showToast} 
                  />
                  
                  <div className="glass-card" style={styles.card}>
                    <h3 style={styles.cardTitle}><FaBrain style={{ marginRight: 8 }} />Memory Vault</h3>
                    <div className="memory-scroll" style={{ maxHeight: 200, overflowY: 'auto' }}>
                      <table className="glass-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ opacity: 0.5 }}>
                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Source</th>
                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Preview</th>
                          </tr>
                        </thead>
                        <tbody>
                          {memoryDetail.map((m, i) => (
                            <tr key={m.id || i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }} onClick={() => setSelectedMemory(m)}>
                              <td style={{ padding: '8px', color: '#00ffaa' }}>{m.source}</td>
                              <td style={{ padding: '8px', opacity: 0.8 }}><MemoryPreview content={m.content} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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

            {/* ── LIVE BRAIN ──────────────────────────────────────────────── */}
            {activeTab === 'brain' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ ...styles.cardTitle, margin: 0 }}>🧠 Real-Time Consciousness</h2>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={styles.btnSmall} onClick={() => setViewMode(viewMode === 'card' ? 'timeline' : 'card')}>
                      {viewMode === 'card' ? 'View Timeline' : 'View Cards'}
                    </button>
                  </div>
                </div>

                {viewMode === 'card' ? (
                  <div style={styles.grid3}>
                    {decisions.map(dec => (
                      <DecisionCard key={dec.id} dec={dec} onSelect={setSelectedDecision} />
                    ))}
                    {decisions.length === 0 && <p style={{ opacity: 0.3, textAlign: 'center', gridColumn: '1/-1' }}>No decisions yet.</p>}
                  </div>
                ) : (
                  <div className="glass-card" style={styles.feedScroll}>
                    {brainLogs.map((log, i) => (
                      <div key={i} style={styles.feedItem}>
                        <span style={styles.feedTime}>{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span style={{ ...styles.feedEvent, color: log.type?.includes('SUCCESS') ? '#00ffaa' : '#ff9900' }}>{log.type}</span>
                        <span style={styles.feedMsg}>{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}
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
                      className="decision-card-v2"
                      style={{
                        borderLeft: `4px solid ${h.success ? '#00ffaa' : '#ff9900'}`,
                      }}
                      onClick={() => setSelectedDecision(h)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span className="decision-action-text">
                          {h.action}
                        </span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                          {h.timestamp ? new Date(h.timestamp).toLocaleTimeString() : ''}
                        </span>
                      </div>
                      <p className="decision-preview-text">{h.reasoning?.substring(0, 160)}...</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', opacity: 0.55 }}>
                          {h.tool_used && <span><FaRobot style={{ marginRight: 4 }} /> {h.tool_used}</span>}
                          <span style={{ color: h.success ? '#00ffaa' : '#ff4444' }}>
                            {h.success ? '✓ Success' : '✗ Failed'}
                          </span>
                        </div>
                        <span className="view-details-hint">View Details →</span>
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
                    <button style={styles.btnSmall} onClick={() => withTabLoad(loadTrenches)}>Refresh</button>
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
                        <SafeImage
                          src={typeof p === 'string' ? `${API}${p}` : `${API}${p.url}`}
                          alt={`Poster ${i + 1}`}
                          style={{ width: '100%', display: 'block', objectFit: 'cover' }}
                        />
                        <p style={{ fontSize: '0.7rem', opacity: 0.5, margin: '6px 10px', fontFamily: 'monospace' }}>
                          {typeof p === 'string' ? p.split('/').pop() : (p.time || p.url?.split('/').pop())}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ ...styles.cardTitle, margin: 0 }}><FaGamepad style={{ marginRight: 8 }} />Pending Shoutouts</h3>
                    <button style={styles.btnSmall} onClick={() => withTabLoad(loadMoments)}>Refresh</button>
                  </div>
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

            {/* ── QUEUE INSPECTOR ────────────────────────────────────────── */}
            {activeTab === 'queue' && (
              <div style={styles.grid2}>
                <div className="glass-card" style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ ...styles.cardTitle, margin: 0 }}><FaClock style={{ marginRight: 8 }} />Game Moments Queue</h3>
                    <span style={styles.badge}>{queueData?.counts?.game_moments || 0}</span>
                  </div>
                  <div style={styles.feedScroll}>
                    {(queueData?.pending_game_moments || []).length === 0 && <p style={{ opacity: 0.4 }}>No pending game moments.</p>}
                    {(queueData?.pending_game_moments || []).map((m, i) => (
                      <div key={i} style={{ ...styles.timelineItem, borderLeftColor: '#ff9900' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontWeight: 'bold', color: '#00ffaa' }}>@{m.author}</span>
                          <button style={styles.btnSmall} onClick={() => processQueueItem('courage:pending_game_moments', i)}>Process Now</button>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>{m.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card" style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ ...styles.cardTitle, margin: 0 }}><FaList style={{ marginRight: 8 }} />Reply Queue</h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={styles.badge}>{queueData?.counts?.replies || 0}</span>
                      <button style={{ ...styles.btnSmall, borderColor: '#ff4444', color: '#ff4444' }} onClick={clearQueue}>Clear</button>
                    </div>
                  </div>
                  <div style={styles.feedScroll}>
                    {(queueData?.reply_queue || []).length === 0 && <p style={{ opacity: 0.4 }}>No pending replies.</p>}
                    {(queueData?.reply_queue || []).map((r, i) => (
                      <div key={i} style={{ ...styles.timelineItem, borderLeftColor: '#ff00ff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : `#${i+1}`}</span>
                          <button className="btn-small" onClick={() => processQueueItem('courage:reply_queue_v5', i)}><FaPlay /> Force Send</button>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>{r.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── VOICE LIVE ──────────────────────────────────────────────── */}
            {activeTab === 'voice' && (
              <div className="glass-card" style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ ...styles.cardTitle, margin: 0 }}>🎤 Voice Sessions Live • {voiceData.count || 0} active</h3>
                  <span style={{ 
                    background: voiceData.active ? '#00ffaa22' : '#333', 
                    color: voiceData.active ? '#00ffaa' : '#888',
                    padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 'bold'
                  }}>
                    {voiceData.active ? '🟢 GLOBAL VOICE ACTIVE' : '⚪ IDLE'}
                  </span>
                </div>
                
                <div style={styles.grid2}>
                  {voiceData.sessions.length === 0 ? (
                    <p style={{ opacity: 0.4, gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>No active voice sessions found.</p>
                  ) : (
                    voiceData.sessions.map(s => (
                      <div key={s.session_id} className="glass-card" style={{ ...styles.card, background: 'rgba(255,255,255,0.01)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <strong style={{ color: '#ff00ff', fontSize: '1.1rem' }}>Session {s.session_id}</strong>
                            <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>User: <span style={{ color: '#00ffaa' }}>{s.user_id}</span></p>
                          </div>
                          <button 
                            className="btn-small" 
                            style={{ borderColor: '#ff4444', color: '#ff4444', background: 'transparent', padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => endVoiceSession(s.session_id)}
                          >
                            ⛔ End Session
                          </button>
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', gap: 15, fontSize: '0.75rem', opacity: 0.6 }}>
                          <span>💬 {s.messages} msgs</span>
                          <span>🕒 Started {new Date(s.started).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── RAG MEMORY GRAPH ────────────────────────────────────────── */}
            {activeTab === 'rag' && (
              <div className="glass-card" style={styles.card}>
                <h3 style={styles.cardTitle}>🧬 RAG Memory Vault • {ragData.vectors.length} latest vectors</h3>
                <div style={{ ...styles.feedScroll, maxHeight: '65vh' }}>
                  <table className="glass-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', opacity: 0.6 }}>
                        <th style={{ textAlign: 'left', padding: '12px 8px' }}>Memory Preview</th>
                        <th style={{ textAlign: 'center', padding: '12px 8px' }}>Age (Days)</th>
                        <th style={{ textAlign: 'right', padding: '12px 8px' }}>Last Accessed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ragData.vectors.map(v => {
                        const timestamp = v.metadata ? JSON.parse(v.metadata).timestamp : null;
                        const ageDays = timestamp ? Math.floor((Date.now() - new Date(timestamp).getTime()) / 86400000) : '?';
                        return (
                          <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }} onClick={() => setSelectedMemory(v)}>
                            <td style={{ padding: '12px 8px', fontSize: '0.85rem', opacity: 0.85 }}><MemoryPreview content={v.content || v.text_preview} /></td>
                            <td style={{ padding: '12px 8px', textAlign: 'center', color: '#ff9900' }}>{ageDays}d</td>
                            <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: '0.75rem', opacity: 0.5 }}>
                              {v.key?.substring(0, 8)}...
                            </td>
                          </tr>
                        );
                      })}
                      {ragData.vectors.length === 0 && (
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'center', padding: '3rem', opacity: 0.4 }}>No memory vectors found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
 
       {/* MEMORY MODAL - SPRUCE DOSSIER */}
       <AnimatePresence>
         {selectedMemory && (
           <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
               onClick={() => setSelectedMemory(null)}
             />
             <motion.div
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="glass-card"
               style={{ width: '100%', maxWidth: 700, position: 'relative', zIndex: 1, padding: 0, border: '1px solid rgba(255,0,255,0.2)', overflow: 'hidden' }}
             >
               <div style={{ background: 'linear-gradient(90deg, #ff00ff22, transparent)', padding: '24px 30px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <h2 style={{ margin: 0, fontFamily: 'Bangers, cursive', letterSpacing: 2, color: '#ff00ff', fontSize: '1.8rem' }}>
                     🧬 MEMORY DOSSIER
                   </h2>
                   <button onClick={() => setSelectedMemory(null)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
                 </div>
                 <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                   <span style={{ background: '#00ffaa15', color: '#00ffaa', padding: '4px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 'bold', border: '1px solid #00ffaa33' }}>
                     SOURCE: {selectedMemory.source?.toUpperCase() || 'UNKNOWN'}
                   </span>
                 </div>
               </div>
 
               <div style={{ padding: 30, maxHeight: '60vh', overflowY: 'auto' }}>
                 <div style={{ background: 'rgba(255,255,255,0.03)', padding: 24, borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)', marginBottom: 24 }}>
                   <h4 style={{ margin: '0 0 12px', fontSize: '0.7rem', opacity: 0.5, letterSpacing: 1, textTransform: 'uppercase' }}>Stored Content</h4>
                   <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.6, color: '#eee', whiteSpace: 'pre-wrap' }}>
                     {selectedMemory.content || selectedMemory.text_preview || selectedMemory.key}
                   </p>
                 </div>
 
                 <MemorySprucePreview content={selectedMemory.content || selectedMemory.text_preview || selectedMemory.key} />
               </div>
 
               <div style={{ padding: '20px 30px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end' }}>
                 <button 
                   style={{ background: 'transparent', border: '1px solid #444', color: '#fff', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
                   onClick={() => setSelectedMemory(null)}
                 >
                   Close Dossier
                 </button>
               </div>
             </motion.div>
           </div>
         )}
       </AnimatePresence>
        </ErrorBoundary>
        </main>
      </div>

      {/* MODAL REDIRECTED TO DECISION TRACE */}

      {/* DECISION MODAL — ELITE TRACE OVERHAUL */}
      <AnimatePresence>
        {selectedDecision && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDecision(null)}
            style={styles.overlay}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ ...styles.modal, maxWidth: 600, padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {/* Header Image / Pattern */}
              <div style={{ height: 120, background: 'linear-gradient(135deg, #ff00ff22 0%, #00ffaa22 100%)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                <h2 style={{ margin: 0, color: '#fff', fontFamily: 'Bangers, cursive', letterSpacing: 3, fontSize: '2.5rem', textShadow: '0 0 20px rgba(255,0,255,0.5)' }}>
                  DECISION TRACE
                </h2>
              </div>

              <div style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#00ffaa', fontFamily: 'Bangers, cursive', letterSpacing: 1.5, fontSize: '1.5rem' }}>
                      {selectedDecision.action?.replace(/_/g, ' ')}
                    </h3>
                    <div style={{ fontSize: '0.75rem', opacity: 0.5, fontFamily: 'monospace' }}>
                      TIMESTAMP: {selectedDecision.timestamp}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                     <span style={{ 
                        background: selectedDecision.success ? '#00ffaa22' : '#ff990022', 
                        color: selectedDecision.success ? '#00ffaa' : '#ff9900', 
                        padding: '6px 14px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 'bold',
                        border: `1px solid ${selectedDecision.success ? '#00ffaa33' : '#ff990033'}`
                      }}>
                        {selectedDecision.status?.toUpperCase() || (selectedDecision.success ? 'EXECUTED' : 'PENDING')}
                      </span>
                  </div>
                </div>

                {/* Media Preview Section */}
                {(selectedDecision.data_preview || selectedDecision.reasoning?.includes('http')) && (
                  <div style={{ marginBottom: 24 }}>
                    { (selectedDecision.data_preview?.match(/\.(jpeg|jpg|gif|png|webp)/i) || selectedDecision.data_preview?.includes('fal.ai')) ? (
                      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#000' }}>
                        <img crossOrigin="anonymous" src={selectedDecision.data_preview} alt="result" style={{ width: '100%', display: 'block' }} />
                      </div>
                    ) : (
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: '1.5rem' }}>🔗</span>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.65rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: 2 }}>Resource Link</div>
                          <a 
                            href={selectedDecision.data_preview || selectedDecision.reasoning?.match(/https?:\/\/[^\s"}]+/)?.[0]} 
                            target="_blank" rel="noreferrer"
                            style={{ color: '#00ffaa', textDecoration: 'none', fontSize: '0.9rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {selectedDecision.data_preview || "View External Content"}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)', marginBottom: 24 }}>
                   <div style={{ fontSize: '0.7rem', opacity: 0.4, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Cognitive Output</div>
                   <p style={{ margin: 0, lineHeight: 1.6, fontSize: '1.1rem', color: '#fff', whiteSpace: 'pre-wrap' }}>
                     {parseReasoning(selectedDecision.reasoning)}
                   </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ opacity: 0.4, fontSize: '0.65rem', textTransform: 'uppercase' }}>Sub-Agent Tool</div>
                    <div style={{ color: '#00ffaa', fontWeight: 'bold' }}>{selectedDecision.tool_used}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ opacity: 0.4, fontSize: '0.65rem', textTransform: 'uppercase' }}>System Integrity</div>
                    <div style={{ color: '#ff00ff', fontWeight: 'bold' }}>VERIFIED</div>
                  </div>
                </div>

                <button 
                  style={{ 
                    ...styles.btnPink, 
                    width: '100%', 
                    padding: '1rem', 
                    fontSize: '1.1rem', 
                    boxShadow: '0 0 20px rgba(255,0,255,0.2)',
                    transition: 'all 0.2s'
                  }} 
                  onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                  onClick={() => setSelectedDecision(null)}
                >
                  CLOSE DOSSIER
                </button>
              </div>
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
        .stat-value { font-size: 2rem; font-weight: bold; font-family: 'Bangers', cursive; letter-spacing: 1px; }
        .stat-sub { font-size: 0.72rem; opacity: 0.45; margin: 4px 0 0; }
        .agent-row { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .agent-name { flex: 1; font-size: 0.85rem; }
        .agent-detail { font-size: 0.75rem; opacity: 0.5; font-family: monospace; }

        /* Brain Sidebar */
        .brain-sidebar {
          height: 80vh;
          position: sticky;
          top: 2rem;
          display: flex;
          flex-direction: column;
          padding: 1rem !important;
          overflow: hidden;
        }
        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          font-family: 'Bangers', cursive;
          letter-spacing: 1px;
          font-size: 0.9rem;
          color: #ff00ff;
        }
        .sidebar-controls { display: flex; gap: 8px; }
        .sidebar-controls button {
          background: rgba(255,255,255,0.05);
          border: none;
          color: #fff;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.7rem;
        }
        .terminal-log {
          flex: 1;
          overflow-y: auto;
          font-family: 'Inter', monospace;
          font-size: 0.75rem;
          display: flex;
          flex-direction: column-reverse; /* Latest at bottom but scrolled to */
          gap: 6px;
        }
        .log-line {
          padding: 4px 0;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          line-height: 1.4;
        }
        .log-time { color: #888; margin-right: 6px; font-size: 0.65rem; }
        .log-msg { color: #ccc; }
        .log-line.post_success .log-msg { color: #00ffaa; font-weight: bold; }
        .log-line.error .log-msg { color: #ff4444; }

        /* SPRUCE SLIDER */
        .spruce-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 6px;
          background: #1a1a1a;
          border-radius: 10px;
          outline: none;
          margin: 15px 0;
        }
        .spruce-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          background: #ff00ff;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 15px rgba(255, 0, 255, 0.6);
          border: 2px solid #fff;
          transition: transform 0.2s;
        }
        .spruce-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        
        .btn-success {
          background: rgba(0, 255, 170, 0.15) !important;
          border: 1px solid #00ffaa !important;
          color: #00ffaa !important;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 1s linear infinite; }

        /* Decision Cards V2 */
        .decision-card-v2 {
          background: rgba(255,255,255,0.03);
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .decision-card-v2:hover {
          background: rgba(255,255,255,0.06);
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.1);
        }
        .decision-action-text {
          font-family: 'Bangers', cursive;
          font-size: 1.2rem;
          letter-spacing: 1.5px;
        }
        .decision-preview-text {
          font-size: 0.85rem;
          opacity: 0.7;
          line-height: 1.5;
          margin: 8px 0;
        }
        .view-details-hint {
          font-size: 0.7rem;
          color: #ff00ff;
          font-weight: bold;
          opacity: 0.8;
        }
        .glass-table th { padding: 8px; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; }
        .stat-sub { font-size: 0.72rem; opacity: 0.45; margin: 4px 0 0; }
        .agent-row { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .agent-name { flex: 1; font-size: 0.85rem; }
        .agent-detail { font-size: 0.75rem; opacity: 0.5; font-family: monospace; }
        .guard-status { padding: 1.5rem; border-radius: 16px; font-weight: bold; font-family: 'Bangers', cursive; letter-spacing: 1px; text-align: center; }
        .guard-status.active { background: rgba(0,255,170,0.1); color: #00ffaa; border: 1px solid rgba(0,255,170,0.2); }
        .guard-status.idle { background: rgba(255,255,255,0.05); color: #666; border: 1px solid rgba(255,255,255,0.1); }
        .v4-dot { box-shadow: 0 0 5px currentColor; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
