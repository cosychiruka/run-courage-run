import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaRobot, FaBrain, FaBolt, FaHistory, FaChartLine, FaBug, FaUsers, FaDog, FaNewspaper } from 'react-icons/fa';

const TABS = [
  { id: 'overview', label: 'Overview', icon: FaBolt },
  { id: 'brain', label: 'Live Brain', icon: FaBrain },
  { id: 'decisions', label: 'Decisions', icon: FaHistory },
  { id: 'token', label: 'Token Hustle', icon: FaChartLine },
  { id: 'trenches', label: 'Trenches', icon: FaNewspaper },
  { id: 'agents', label: 'Sub-Agents', icon: FaDog },
];

const AdminDashboard = () => {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [memoryCount, setMemoryCount] = useState(0);
  const [subAgents, setSubAgents] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState(null);

  const API_BASE = import.meta.env.VITE_BACKEND_URL || '';

  const fetchAllData = async () => {
    try {
      const endpoints = [
        `${API_BASE}/api/admin/system-status`,
        `${API_BASE}/api/admin/history`,
        `${API_BASE}/api/admin/recent-decisions`,
        `${API_BASE}/api/admin/live-activity`,
        `${API_BASE}/api/admin/memory-vectors`,
        `${API_BASE}/api/admin/sub_agents_status`
      ];
      
      const results = await Promise.all(endpoints.map(u => fetch(u).then(r => r.ok ? r.json() : null)));
      const [statusData, historyData, decisionsData, activityData, memoryData, subAgentsData] = results;

      if (statusData) setStatus(statusData);
      if (historyData) setHistory(historyData);
      if (decisionsData) setDecisions(decisionsData);
      if (activityData) setActivity(activityData);
      if (memoryData) setMemoryCount(memoryData.count || 0);
      if (subAgentsData) setSubAgents(subAgentsData);
    } catch (err) {
      console.error("Dashboard Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  const triggerAction = async (endpoint, label) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/autonomous/${endpoint}`, { method: 'POST' });
      const data = await res.json();
      alert(`${label}: ${data.message || 'Done'}`);
      fetchAllData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
          <FaRobot size={48} color="#ff00ff" />
        </motion.div>
        <p>Waking up Courage's Brain...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-root">
      <nav className="admin-nav">
        <h1>COURAGE COMMAND CENTER • ELITE TIER 4.0</h1>
        <div className="admin-nav-actions">
          <button onClick={fetchAllData} disabled={actionLoading}><FaBolt /> Refresh</button>
          <a href="/">Exit Dashboard</a>
        </div>
      </nav>

      {/* TABS BAR */}
      <div className="tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon /> {tab.label}
          </button>
        ))}
      </div>

      <main className="admin-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && (
              <div className="admin-grid">
                {/* ── Heartbeat Monitor ── */}
                <div className="admin-card glass-card">
                  <h3><FaBolt /> Heartbeat Monitor</h3>
                  <div className="heartbeat-pulse">
                    <div className="pulse-ring"></div>
                    <span>Brain Cycle: {status?.sensor_cooldown_minutes || 25}m</span>
                  </div>
                  <div className="mini-bar-wrap">
                    <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Next Tick: ~{Math.max(0, (status?.sensor_cooldown_minutes || 25) - Math.round((Date.now() - new Date(history[0]?.decided_at || Date.now()).getTime()) / 60000))} mins</p>
                    <div className="mini-bar"><motion.div 
                        className="mini-bar-fill pulse" 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, ((Date.now() - new Date(history[0]?.decided_at || Date.now()).getTime()) / ((status?.sensor_cooldown_minutes || 25) * 60000)) * 100)}%` }}
                    ></motion.div></div>
                  </div>
                  <div className="admin-card-actions">
                    <button className="brutal-btn--small pink" onClick={() => triggerAction('trigger-now', 'Manual Tick')}>Force Wake Up</button>
                  </div>
                </div>

                {/* ── Twitter Budget ── */}
                <div className="admin-card glass-card">
                  <h3><FaHistory /> Twitter Budget</h3>
                  <div className="rate-limit-grid">
                    <div className="rate-item">
                      <label>SEARCH</label>
                      <span>{status?.twitter?.rates?.search?.remaining || '?'} / {status?.twitter?.rates?.search?.limit || '?'}</span>
                    </div>
                    <div className="rate-item">
                      <label>POST</label>
                      <span>{status?.twitter?.rates?.post?.remaining || '?'} / {status?.twitter?.rates?.post?.limit || '?'}</span>
                    </div>
                  </div>
                  <div className="stat-summary" style={{ marginTop: '10px', fontSize: '0.75rem', opacity: 0.6 }}>
                    Spent Today: <span style={{ color: '#00ffaa' }}>${status?.x_spend_today?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>

                {/* ── Memory & Brain ── */}
                <div className="admin-card glass-card">
                  <h3><FaBrain /> Cognitive State</h3>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#00ffff' }}>{memoryCount}</div>
                  <p style={{ fontSize: '0.7rem', opacity: 0.5 }}>ACTIVE MEMORY VECTORS</p>
                  <div className="admin-card-actions">
                    <button className="brutal-btn--small" onClick={() => setActiveTab('brain')}>View Activity</button>
                  </div>
                </div>

                {/* ── API Health ── */}
                <div className="admin-card glass-card">
                  <h3><FaBug /> API Status</h3>
                  <div className="circuit-status">
                    <div className={`status-led ${status?.circuit_breakers?.groq_active ? 'led-red' : 'led-green'}`}></div>
                    <span>Groq: {status?.circuit_breakers?.groq_active ? 'RESTING' : 'READY'}</span>
                  </div>
                  <div className="admin-card-actions">
                    <button className="brutal-btn--small" onClick={() => triggerAction('reset-circuit-breaker', 'Circuit Breaker')}>Reset Breaker</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'brain' && (
              <div className="tab-panel">
                <div className="admin-grid">
                  <div className="admin-card glass-card">
                    <h3><FaBolt /> Live Brain Activity</h3>
                    <div className="live-activity-feed" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                      {activity.slice(0, 30).map((a, i) => (
                        <div key={i} className="activity-item" style={{ fontSize: '0.9rem', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ opacity: 0.5, fontFamily: 'monospace', marginRight: '15px' }}>{new Date(a.timestamp).toLocaleTimeString()}</span>
                          <span>{a.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="admin-card glass-card">
                    <h3><FaBrain /> Intelligence Metrics</h3>
                    <div className="stat-block">
                        <div className="stat-item">
                            <label>Context Depth</label>
                            <div className="stat-value">High</div>
                        </div>
                        <div className="stat-item">
                            <label>Sub-Agent Sync</label>
                            <div className="stat-value" style={{color: '#00ffaa'}}>Nominal</div>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'decisions' && (
              <div className="tab-panel">
                <div className="admin-timeline glass-card">
                  <h2><FaHistory /> Autonomous Decision Log</h2>
                  <div className="timeline-items" style={{ maxHeight: '70vh' }}>
                    {history.map((h, i) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={h.id} 
                        className={`timeline-item ${h.action === 'TWEET' ? 'action-tweet' : 'action-skip'}`}
                        onClick={() => setSelectedDecision(h)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="timeline-dot"></div>
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <span className="timeline-action">{h.action}</span>
                            <span className="timeline-time">{new Date(h.decided_at).toLocaleString()}</span>
                          </div>
                          <p className="timeline-reasoning">{h.reasoning}</p>
                          <div className="timeline-meta">
                            <span>Bucket: {h.bucket || 'N/A'}</span>
                            {h.executed === 1 && <span className="status-badge">Executed</span>}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'token' && (
              <div className="tab-panel">
                <div className="admin-grid">
                  <div className="admin-card glass-card">
                    <h3><FaChartLine /> $RCR Performance</h3>
                    <div className="stat-block">
                      <p className="stat-summary" style={{ fontSize: '1.2rem', color: '#ff00ff', fontFamily: 'Bangers' }}>{status?.growth || "No stats yet"}</p>
                      <div className="mini-bar-wrap" style={{ marginTop: '2rem' }}>
                        <p>Auto Tweets Today: {status?.auto_tweets_today} / 25</p>
                        <div className="mini-bar"><div className="mini-bar-fill" style={{width: `${(status?.auto_tweets_today/25)*100}%`}}></div></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'trenches' && (
              <div className="tab-panel">
                <div className="admin-card glass-card">
                  <h3><FaUsers /> Social Pulse & Mentions</h3>
                  <div className="social-mentions">
                    {(!status?.twitter?.mention_pulse || status?.twitter?.mention_pulse === 'none') ? (
                      <p className="opacity-50">No recent whispers...</p>
                    ) : (
                      <div className="mention-bubbles">
                        {status?.twitter?.mention_pulse?.split(' | ').map((m, i) => (
                          <div key={i} className="mention-bubble">
                            "{m}"
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'agents' && (
              <div className="tab-panel">
                <div className="admin-card glass-card">
                  <h3><FaDog /> Sub-Agent Team</h3>
                  <div className="sub-agents-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                    {Object.entries(subAgents).filter(([k]) => k !== 'status' && k !== 'last_reflection').map(([name, st]) => (
                      <div key={name} className="agent-card">
                        <div className="agent-header">
                            <div className={`status-led ${st === 'active' || st === 'online' ? 'led-green' : 'led-red'}`}></div>
                            <span className="agent-name">{name.replace('_', ' ').toUpperCase()}</span>
                        </div>
                        <div className="agent-status">{st.toUpperCase()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Decision Modal */}
      <AnimatePresence>
        {selectedDecision && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDecision(null)}
            className="modal-overlay"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="modal-content"
            >
              <div className="modal-header">
                <h2>{selectedDecision.type || selectedDecision.action}</h2>
                <button className="close-btn" onClick={() => setSelectedDecision(null)}>×</button>
              </div>
              <pre className="modal-body">
                {JSON.stringify(selectedDecision, null, 2)}
              </pre>
              <button className="brutal-btn pink w-full" onClick={() => setSelectedDecision(null)}>CLOSE</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .admin-dashboard-root {
          background: #050505;
          color: #fff;
          min-height: 100vh;
          font-family: 'Inter', sans-serif;
          padding: 2rem;
        }
        .admin-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #ff00ff;
          padding-bottom: 1.5rem;
          margin-bottom: 2rem;
        }
        .admin-nav h1 {
          font-family: 'Bangers', cursive;
          letter-spacing: 2px;
          color: #ff00ff;
          margin: 0;
          font-size: 2rem;
        }
        .admin-nav-actions { display: flex; gap: 1rem; }
        .admin-nav-actions button, .admin-nav-actions a {
          background: #ff00ff22;
          border: 1px solid #ff00ff;
          color: #ff00ff;
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          text-decoration: none;
          cursor: pointer;
          font-weight: bold;
          transition: 0.2s;
        }
        .admin-nav-actions button:hover { background: #ff00ff44; }

        .tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 2.5rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
        }
        .tab {
          background: #1a1a1a;
          border: 1px solid #333;
          color: #888;
          padding: 0.8rem 1.5rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 0.8rem;
          cursor: pointer;
          transition: 0.3s;
          white-space: nowrap;
          font-weight: 500;
        }
        .tab.active {
          background: #ff00ff22;
          border-color: #ff00ff;
          color: #ff00ff;
          box-shadow: 0 0 15px rgba(255, 0, 255, 0.2);
        }
        .tab:hover:not(.active) { border-color: #666; color: #fff; }

        .admin-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 2rem;
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 2rem;
          transition: 0.3s;
        }
        .glass-card:hover { border-color: rgba(255, 255, 255, 0.15); }
        .admin-card h3 {
          margin-top: 0;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.8rem;
          color: #00ffaa;
          font-size: 1.1rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .heartbeat-pulse {
          display: flex;
          align-items: center;
          gap: 1rem;
          font-family: 'Bangers';
          color: #ff00ff;
          font-size: 1.5rem;
        }
        .pulse-ring {
          width: 14px;
          height: 14px;
          background: #ff00ff;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 0, 255, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 12px rgba(255, 0, 255, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 0, 255, 0); }
        }

        .rate-limit-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .rate-item {
          background: rgba(0, 255, 170, 0.05);
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid rgba(0, 255, 170, 0.1);
        }
        .rate-item label { display: block; font-size: 0.7rem; opacity: 0.6; margin-bottom: 0.3rem; }
        .rate-item span { font-weight: bold; color: #00ffaa; font-size: 1.2rem; }

        .mini-bar-wrap { margin-top: 1.5rem; }
        .mini-bar {
          height: 10px;
          background: #1a1a1a;
          border-radius: 5px;
          overflow: hidden;
          margin-top: 0.5rem;
        }
        .mini-bar-fill {
          height: 100%;
          background: #00ffaa;
          transition: 1s ease-out;
        }
        .mini-bar-fill.pulse {
          background: linear-gradient(90deg, #ff00ff, #00ffaa);
          animation: barPulse 2s infinite alternate;
        }
        @keyframes barPulse { from { opacity: 0.7; } to { opacity: 1; } }

        .circuit-status {
          display: flex;
          align-items: center;
          gap: 1rem;
          font-weight: bold;
        }
        .status-led {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        .led-green { background: #00ffaa; box-shadow: 0 0 10px #00ffaa; }
        .led-red { background: #ff4444; box-shadow: 0 0 10px #ff4444; }

        .admin-card-actions {
          display: flex;
          gap: 0.8rem;
          margin-top: 1.5rem;
        }
        .brutal-btn--small {
          background: #111;
          border: 1px solid #333;
          color: #eee;
          padding: 0.6rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: 0.2s;
        }
        .brutal-btn--small:hover { border-color: #666; background: #1a1a1a; }
        .brutal-btn--small.pink { border-color: #ff00ff; color: #ff00ff; }
        .brutal-btn--small.pink:hover { background: #ff00ff11; }

        .timeline-items {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          overflow-y: auto;
          padding-right: 1.5rem;
        }
        .timeline-item {
          display: flex;
          gap: 2rem;
          padding: 1.5rem;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.02);
          border-left: 4px solid #333;
          transition: 0.2s;
        }
        .timeline-item:hover { background: rgba(255, 255, 255, 0.04); transform: translateX(5px); }
        .timeline-item.action-tweet { border-left-color: #00ffaa; }
        .timeline-item.action-skip { border-left-color: #ff9900; }
        .timeline-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.8rem;
        }
        .timeline-action { font-weight: bold; font-family: 'Bangers'; letter-spacing: 1.5px; font-size: 1.2rem; }
        .timeline-time { font-size: 0.85rem; opacity: 0.5; }
        .timeline-reasoning { font-size: 0.95rem; line-height: 1.5; margin-bottom: 1rem; opacity: 0.9; }
        .timeline-meta {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          opacity: 0.6;
        }
        .status-badge { color: #00ffaa; font-weight: bold; }

        .mention-bubbles { display: flex; flex-direction: column; gap: 0.8rem; }
        .mention-bubble {
          background: rgba(255, 255, 255, 0.04);
          padding: 1rem;
          border-radius: 12px;
          border-left: 3px solid #ff00ff;
          font-size: 0.9rem;
          font-style: italic;
          opacity: 0.85;
        }

        .agent-card {
          background: #111;
          border: 1px solid #222;
          padding: 1.5rem;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .agent-header { display: flex; align-items: center; gap: 1rem; }
        .agent-name { font-weight: bold; color: #fff; font-size: 0.9rem; }
        .agent-status { font-size: 0.8rem; color: #888; }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.9);
          backdrop-filter: blur(15px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
        .modal-content {
          background: #0a0a0a;
          border: 1px solid #333;
          border-radius: 24px;
          padding: 2.5rem;
          max-width: 700px;
          width: 100%;
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .modal-header h2 { color: #00ffaa; margin: 0; font-family: 'Bangers'; letter-spacing: 2px; }
        .close-btn { background: none; border: none; color: #fff; font-size: 2.5rem; cursor: pointer; opacity: 0.5; transition: 0.2s; }
        .close-btn:hover { opacity: 1; }
        .modal-body {
          background: #000;
          padding: 1.5rem;
          border-radius: 16px;
          color: #00ffaa;
          font-size: 0.85rem;
          overflow-x: auto;
          white-space: pre-wrap;
          border: 1px solid #222;
          margin-bottom: 1.5rem;
        }
        .w-full { width: 100%; }
        .admin-loading {
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #050505;
          color: #fff;
          gap: 1.5rem;
        }
        .activity-item:last-child { border-bottom: none; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
