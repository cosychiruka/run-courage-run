import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaRobot, FaNewspaper, FaHistory, FaBolt, FaBug, FaChartLine, FaUsers } from 'react-icons/fa';

const AdminDashboard = () => {
    const [status, setStatus] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    const API_BASE = import.meta.env.VITE_BACKEND_URL || '';

    const fetchData = async () => {
        try {
            const [statusRes, historyRes] = await Promise.all([
                fetch(`${API_BASE}/api/admin/system-status`),
                fetch(`${API_BASE}/api/admin/history`)
            ]);
            
            if (!statusRes.ok || !historyRes.ok) throw new Error("Failed to fetch dashboard data");
            
            const statusData = await statusRes.json();
            const historyData = await historyRes.json();
            
            setStatus(statusData);
            setHistory(historyData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const triggerAction = async (endpoint, label) => {
        setActionLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/autonomous/${endpoint}`, { method: 'POST' });
            const data = await res.json();
            alert(`${label}: ${data.message}`);
            fetchData();
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return (
        <div className="admin-loading">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                <FaRobot size={48} color="#ff00ff" />
            </motion.div>
            <p>Waking up Courage's Brain...</p>
        </div>
    );

    return (
        <div className="admin-dashboard-root">
            <nav className="admin-nav">
                <h1>COURAGE COMMAND CENTER</h1>
                <div className="admin-nav-actions">
                    <button onClick={fetchData} disabled={actionLoading}><FaBolt /> Refresh</button>
                    <a href="/">Exit Dashboard</a>
                </div>
            </nav>

            <main className="admin-main">
                {/* ── System Health Grid ── */}
                <div className="admin-grid">
                    {/* ── Heartbeat Monitor ── */}
                    <div className="admin-card glass-card">
                        <h3><FaBolt /> Heartbeat Monitor</h3>
                        <div className="heartbeat-pulse">
                            <div className="pulse-ring"></div>
                            <span>Brain Cycle: 18m</span>
                        </div>
                        <div className="mini-bar-wrap">
                            <p>Next Tick: ~{Math.max(0, 18 - Math.round((Date.now() - new Date(history[0]?.decided_at).getTime()) / 60000))} mins</p>
                            <div className="mini-bar"><motion.div 
                                className="mini-bar-fill pulse" 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, ((Date.now() - new Date(history[0]?.decided_at).getTime()) / (18 * 60000)) * 100)}%` }}
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
                        <p className="tiny-text">Refreshes every 15-60 mins based on X rules.</p>
                    </div>

                    {/* ── Social Pulse ── */}
                    <div className="admin-card glass-card">
                        <h3><FaUsers /> Social Pulse</h3>
                        <div className="social-mentions">
                            {status?.twitter?.mention_pulse === 'none' ? (
                                <p className="opacity-50">No recent whispers...</p>
                            ) : (
                                <div className="mention-bubbles">
                                    {status?.twitter?.mention_pulse?.split(' | ').map((m, i) => (
                                        <div key={i} className="mention-bubble">
                                            "{m.length > 50 ? m.substring(0, 50) + '...' : m}"
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="admin-grid">
                    <div className="admin-card glass-card">
                        <h3><FaChartLine /> Growth Pulse</h3>
                        <div className="stat-block">
                            <p className="stat-summary">{status?.growth || "No stats yet"}</p>
                            <div className="mini-bar-wrap">
                                <p>Auto Tweets Today: {status?.auto_tweets_today} / 25</p>
                                <div className="mini-bar"><div className="mini-bar-fill" style={{width: `${(status?.auto_tweets_today/25)*100}%`}}></div></div>
                            </div>
                        </div>
                    </div>

                    <div className="admin-card glass-card">
                        <h3><FaBug /> API & Backoff</h3>
                        <div className="circuit-status">
                            <div className={`status-led ${status?.circuit_breakers?.groq_active ? 'led-red' : 'led-green'}`}></div>
                            <span>Groq Status: {status?.circuit_breakers?.groq_active ? 'RESTING' : 'READY'}</span>
                        </div>
                        {status?.circuit_breakers?.groq_active && (
                            <p className="backoff-timer">Waking in: {Math.round((status.circuit_breakers.groq_backoff_until - Date.now()/1000)/60)}m</p>
                        )}
                        <div className="admin-card-actions">
                            <button className="brutal-btn--small" onClick={() => triggerAction('reset-circuit-breaker', 'Circuit Breaker')}>Reset Breaker</button>
                        </div>
                    </div>
                </div>

                {/* ── Decision Timeline ── */}
                <div className="admin-timeline glass-card">
                    <h2><FaHistory /> Autonomous Decision Log</h2>
                    <div className="timeline-items">
                        {history.map((h, i) => (
                            <motion.div 
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                key={h.id} 
                                className={`timeline-item ${h.action === 'TWEET' ? 'action-tweet' : 'action-skip'}`}
                            >
                                <div className="timeline-dot"></div>
                                <div className="timeline-content">
                                    <div className="timeline-header">
                                        <span className="timeline-action">{h.action}</span>
                                        <span className="timeline-time">{new Date(h.decided_at).toLocaleString()}</span>
                                    </div>
                                    <p className="timeline-reasoning">{h.reasoning}</p>
                                    <div className="timeline-meta-row">
                                        {h.topic_keyword && <span className="topic-tag">#{h.topic_keyword}</span>}
                                        <div className="confidence-meter-wrap">
                                            <label>Confidence: {Math.round(h.confidence * 100)}%</label>
                                            <div className="confidence-meter">
                                                <div className="confidence-fill" style={{ width: `${h.confidence * 100}%`, background: h.confidence > 0.7 ? '#00ffaa' : h.confidence > 0.4 ? '#ff9900' : '#ff4444' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                    {h.tweet_id && (
                                        <a href={`https://x.com/i/status/${h.tweet_id}`} target="_blank" className="timeline-link">View Tweet</a>
                                    )}
                                    <div className="timeline-meta">
                                        <span>Bucket: {h.bucket || 'N/A'}</span>
                                        {h.executed === 1 && <span className="status-badge">Executed</span>}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </main>

            <style>{`
                .admin-dashboard-root {
                    background: #0a0a0a;
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
                    padding-bottom: 1rem;
                    margin-bottom: 2rem;
                }
                .admin-nav h1 {
                    font-family: 'Bangers', cursive;
                    letter-spacing: 2px;
                    color: #ff00ff;
                    margin: 0;
                }
                .admin-nav-actions {
                    display: flex;
                    gap: 1rem;
                }
                .admin-nav-actions button, .admin-nav-actions a {
                    background: #ff00ff22;
                    border: 1px solid #ff00ff;
                    color: #ff00ff;
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    text-decoration: none;
                    cursor: pointer;
                    transition: 0.2s;
                }
                .admin-nav-actions button:hover { background: #ff00ff44; }

                .admin-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 2rem;
                    margin-bottom: 3rem;
                }
                .glass-card {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 1.5rem;
                }
                .admin-card h3 {
                    margin-top: 0;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #00ffaa;
                }
                .stat-summary {
                    font-size: 0.9rem;
                    line-height: 1.5;
                    white-space: pre-wrap;
                }
                .mini-bar-wrap { margin-top: 1rem; }
                .mini-bar {
                    height: 8px;
                    background: #333;
                    border-radius: 4px;
                    overflow: hidden;
                }
                .mini-bar-fill {
                    height: 100%;
                    background: #00ffaa;
                    transition: 0.5s ease-out;
                }

                .circuit-status {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
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
                    gap: 0.5rem;
                    margin-top: 1rem;
                }
                .brutal-btn--small {
                    background: #222;
                    border: 1px solid #555;
                    color: #eee;
                    padding: 0.4rem 0.8rem;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .brutal-btn--small.pink { border-color: #ff00ff; color: #ff00ff; }

                .timeline-items {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    max-height: 600px;
                    overflow-y: auto;
                    padding-right: 1rem;
                }
                .timeline-item {
                    display: flex;
                    gap: 1.5rem;
                    padding: 1rem;
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.02);
                    border-left: 4px solid #555;
                }
                .timeline-item.action-tweet { border-left-color: #00ffaa; background: rgba(0, 255, 170, 0.05); }
                .timeline-item.action-skip { border-left-color: #ff9900; }
                
                .timeline-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5rem;
                }
                .timeline-action { font-weight: bold; font-family: 'Bangers'; letter-spacing: 1px; }
                .timeline-time { font-size: 0.8rem; opacity: 0.6; }
                .timeline-reasoning { font-size: 0.9rem; line-height: 1.4; margin-bottom: 0.8rem; }
                .timeline-link { color: #1da1f2; text-decoration: none; font-size: 0.85rem; }
                .timeline-meta {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.75rem;
                    opacity: 0.5;
                    margin-top: 0.5rem;
                }
                .status-badge { color: #00ffaa; }

                .visitor-list {
                    max-height: 150px;
                    overflow-y: auto;
                    font-size: 0.8rem;
                }
                .visitor-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.3rem 0;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .visitor-topics { color: #ff00ff; text-align: right; }

                .heartbeat-pulse {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    font-family: 'Bangers';
                    color: #ff00ff;
                }
                .pulse-ring {
                    width: 12px;
                    height: 12px;
                    background: #ff00ff;
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 0, 255, 0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(255, 0, 255, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 0, 255, 0); }
                }

                .rate-limit-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-top: 1rem;
                }
                .rate-item {
                    background: rgba(0, 255, 170, 0.1);
                    padding: 0.8rem;
                    border-radius: 8px;
                    border: 1px solid rgba(0, 255, 170, 0.2);
                }
                .rate-item label { display: block; font-size: 0.7rem; opacity: 0.6; }
                .rate-item span { font-weight: bold; color: #00ffaa; }

                .social-mentions { margin-top: 1rem; }
                .mention-bubbles { display: flex; flex-direction: column; gap: 0.5rem; }
                .mention-bubble {
                    background: rgba(255, 255, 255, 0.05);
                    padding: 0.5rem 0.8rem;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    font-style: italic;
                    border-left: 2px solid #ff00ff;
                }
                .tiny-text { font-size: 0.7rem; opacity: 0.4; margin-top: 0.5rem; }
                .mini-bar-fill.pulse {
                    background: linear-gradient(90deg, #ff00ff, #00ffaa);
                    animation: barPulse 2s infinite alternate;
                }
                @keyframes barPulse {
                    from { opacity: 0.8; }
                    to { opacity: 1; }
                }

                .timeline-meta-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.8rem;
                    gap: 1rem;
                }
                .topic-tag {
                    background: rgba(255, 0, 255, 0.1);
                    color: #ff00ff;
                    padding: 0.2rem 0.6rem;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    border: 1px solid rgba(255, 0, 255, 0.2);
                    font-weight: bold;
                }
                .confidence-meter-wrap { flex: 1; }
                .confidence-meter-wrap label { font-size: 0.7rem; opacity: 0.6; display: block; margin-bottom: 0.2rem; }
                .confidence-meter {
                    height: 4px;
                    background: #333;
                    border-radius: 2px;
                    overflow: hidden;
                }
                .confidence-fill {
                    height: 100%;
                    transition: 0.5s;
                }

                .admin-loading {
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: #0a0a0a;
                    color: #fff;
                }
            `}</style>
        </div>
    );
};

export default AdminDashboard;
