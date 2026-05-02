import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Scene } from './Scene3D';
import { audioManager } from '../../utils/audioManager';
import WorldVoiceButton from '../WorldVoiceButton';
import WorldEventBanner from '../WorldEventBanner';
import { useWorldEvents } from '../../hooks/useWorldEvents';

const NOON_TRACKS = [
  { id: 'noon-chill',   url: '/audio/dirty-paws-monsters-nmen.mp3', title: 'Dirty Paws' },
  { id: 'noon-track2',  url: '/audio/badtuch-bloodhoundg.mp3',       title: 'Badtuch' },
];

function ReadySignal({ onReady }) {
  const calledRef = useRef(false);
  useFrame(() => {
    if (!calledRef.current) { calledRef.current = true; onReady(); }
  });
  return null;
}

export default function NoonWorld3D({ visible, onReady, onClose }) {
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [isMuted, setIsMuted]         = useState(false);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const canvasRef    = useRef(null);
  const [noonAnim, setNoonAnim] = useState(null);

  const { event, clearEvent, presenceCount } = useWorldEvents({
    world: 'noon',
    active: visible,
    state: { euriel_state: 'arrived' },
    intervalMs: 17_000,
  });

  // Map LLM event actions to cute narrative emoji moments
  useEffect(() => {
    if (!event) return;
    const NOON_ANIMS = {
      leaf_blows:    { emoji: '🍂', label: 'A leaf drifts by...' },
      bird_lands:    { emoji: '🐦', label: 'A bird lands nearby.' },
      cloud_shadow:  { emoji: '☁️', label: 'A cloud rolls overhead.' },
      courage_sniff: { emoji: '🐕', label: 'Courage sniffs the air.' },
      courage_bark:  { emoji: '🐕🔊', label: 'Courage barks at something!' },
    };
    const anim = NOON_ANIMS[event.action];
    if (anim) { setNoonAnim(anim); setTimeout(() => setNoonAnim(null), 4_000); }
  }, [event]);

  // Mobile GPU cleanup
  useEffect(() => {
    if (!visible && canvasRef.current) {
      try { canvasRef.current.renderLists?.dispose?.(); canvasRef.current.info?.reset?.(); } catch { /**/ }
    }
  }, [visible]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && visible) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, visible]);

  // Load all noon tracks on first open
  useEffect(() => {
    if (!visible || audioLoaded) return;
    const load = async () => {
      await Promise.all(NOON_TRACKS.map(t => audioManager.loadTrack(t.id, t.url)));
      setAudioLoaded(true);
    };
    load();
  }, [visible, audioLoaded]);

  // Play track and wire auto-advance
  const playTrack = useCallback(async (idx) => {
    const track = NOON_TRACKS[idx];
    await audioManager.loadTrack(track.id, track.url);
    await audioManager.playTrack(track.id, { loop: false, volume: 0.4 });
    // Wire auto-advance on ended
    const t = audioManager.tracks.get(track.id);
    if (t?.source) {
      t.source.onended = () => {
        if (audioManager.currentTrack === track.id) {
          const next = (idx + 1) % NOON_TRACKS.length;
          setCurrentTrackIdx(next);
        }
      };
    }
  }, []);

  useEffect(() => {
    if (!visible || !audioLoaded) return;
    playTrack(currentTrackIdx);
    return () => audioManager.softCleanup();
  }, [visible, audioLoaded, currentTrackIdx, playTrack]);

  const handleNext = useCallback(() => {
    setCurrentTrackIdx(i => (i + 1) % NOON_TRACKS.length);
  }, []);

  const handleMute = useCallback(() => {
    const muted = audioManager.toggleMute();
    setIsMuted(muted);
  }, []);

  return (
    <div className="world3d-overlay" style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'all' : 'none', transition: 'opacity 0.8s ease' }}>
      {visible && <button className="world3d-close" onClick={onClose} aria-label="Exit 3D World">✕ Exit</button>}
      {visible && <div className="world3d-hint">drag to orbit &nbsp;·&nbsp; scroll to zoom</div>}

      {/* ── Music controls ── */}
      {visible && (
        <div className="world3d-music-bar">
          <div className="music-now-playing-inline">
            <span className="music-bar-icon">🎵</span>
            <span className="music-bar-title">{NOON_TRACKS[currentTrackIdx].title}</span>
          </div>
          <button className="music-btn" onClick={handleNext} title="Next track">⏭</button>
          <button className="music-btn" onClick={handleMute} title="Toggle Mute">
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      )}

      {/* Noon narrative emoji moment */}
      {visible && noonAnim && (
        <div style={{
          position: 'fixed', bottom: '160px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1003, textAlign: 'center', pointerEvents: 'none',
          animation: 'noonAnimIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275) forwards',
        }}>
          <div style={{ fontSize: '4rem', lineHeight: 1, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}>
            {noonAnim.emoji}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,240,200,0.9)', fontFamily: 'Georgia, serif', fontStyle: 'italic', textShadow: '0 1px 4px rgba(0,0,0,0.8)', marginTop: '6px' }}>
            {event?.message || noonAnim.label}
          </div>
        </div>
      )}

      <WorldEventBanner event={event} world="noon" onDismiss={clearEvent} />
      {visible && presenceCount > 0 && (
        <div className="world-presence-badge">
          <span className="presence-dot" />
          {presenceCount} watching
        </div>
      )}
      <WorldVoiceButton worldContext="noon" visible={visible} />

      <Canvas
        frameloop={visible ? 'always' : 'demand'}
        dpr={[1, 1.5]}
        gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.5, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl }) => { canvasRef.current = gl; }}
      >
        {/* Midway between old z=50 and too-close z=20 */}
        <PerspectiveCamera makeDefault position={[0, 5, 35]} fov={38} />
        <OrbitControls target={[0, 1, 0]} minDistance={5} maxDistance={60} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 2} enablePan={true} />
        <ReadySignal onReady={onReady} />
        <Scene
          scene="noon"
          eventLine={event?.message ?? ''}
        />
      </Canvas>
    </div>
  );
}
