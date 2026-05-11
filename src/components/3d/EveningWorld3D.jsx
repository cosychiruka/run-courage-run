import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Scene } from './Scene3D';
import { audioManager } from '../../utils/audioManager';
import WorldVoiceButton from '../WorldVoiceButton';
import WorldEventBanner from '../WorldEventBanner';
import { useWorldEvents } from '../../hooks/useWorldEvents';

const EVENING_TRACKS = [
  { id: 'run-boy-run',   url: '/audio/run-boy-run.mp3',       title: 'Run Boy Run' },
  { id: 'seek-chase',    url: '/audio/seek-chase-theme.mp3',  title: 'Seek Chase Theme' },
];

function ReadySignal({ onReady }) {
  const calledRef = useRef(false);
  useFrame(() => {
    if (!calledRef.current) { calledRef.current = true; onReady(); }
  });
  return null;
}

export default function EveningWorld3D({ visible, onReady, onClose }) {
  const [audioLoaded, setAudioLoaded]         = useState(false);
  const [currentScene]                         = useState('evening');
  const [isMuted, setIsMuted]                 = useState(false);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const canvasRef = useRef(null);

  const { event, clearEvent, presenceCount } = useWorldEvents({
    world: currentScene,
    active: visible,
    state: { mood: 'mischievous' },
    intervalMs: 50_000,
  });

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && visible) onClose(); };
    window.addEventListener('keydown', handler);
    if (visible) document.body.classList.add('world3d-active');
    else         document.body.classList.remove('world3d-active');
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.classList.remove('world3d-active');
    };
  }, [onClose, visible]);

  // Mobile GPU optimization & cleanup
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (canvasRef.current) {
      const { gl, scene } = canvasRef.current;
      if (isMobile && visible && gl && scene) {
        gl.setPixelRatio(Math.min(gl.getPixelRatio(), 1.5));
        // Force materials to update for the new pixel ratio
        scene.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.needsUpdate = true;
          }
        });
      }
      if (!visible && gl) {
        try { gl.renderLists?.dispose?.(); gl.info?.reset?.(); } catch { /**/ }
      }
    }
  }, [visible, isMobile]);

  // Load all evening tracks on first open
  useEffect(() => {
    if (!visible || audioLoaded) return;
    const load = async () => {
      await Promise.all(EVENING_TRACKS.map(t => audioManager.loadTrack(t.id, t.url)));
      setAudioLoaded(true);
    };
    load();
  }, [visible, audioLoaded]);

  // Play current track + wire auto-advance
  const playTrack = useCallback(async (idx) => {
    const track = EVENING_TRACKS[idx];
    await audioManager.loadTrack(track.id, track.url);
    await audioManager.playTrack(track.id, { loop: false, volume: 0.35 });
    const t = audioManager.tracks.get(track.id);
    if (t?.source) {
      t.source.onended = () => {
        if (audioManager.currentTrack === track.id) {
          const next = (idx + 1) % EVENING_TRACKS.length;
          setCurrentTrackIdx(next);
        }
      };
    }
  }, []);

  useEffect(() => {
    if (!visible || !audioLoaded) return;
    let cancelled = false;
    const run = async () => { if (!cancelled) await playTrack(currentTrackIdx); };
    run();
    return () => { cancelled = true; audioManager.softCleanup(); };
  }, [visible, audioLoaded, currentTrackIdx, playTrack]);

  const handleNext  = useCallback(() => setCurrentTrackIdx(i => (i + 1) % EVENING_TRACKS.length), []);
  const handleMute  = useCallback(() => { const m = audioManager.toggleMute(); setIsMuted(m); }, []);

  return (
    <div className="world3d-overlay" style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'all' : 'none', transition: 'opacity 0.8s ease' }}>
      {visible && <button className="world3d-close" onClick={onClose} aria-label="Exit 3D World">✕ Exit</button>}
      {visible && <div className="world3d-hint">🌆 Evening Scene &nbsp;·&nbsp; drag to orbit &nbsp;·&nbsp; scroll to zoom</div>}

      {/* ── Music bar ── */}
      {visible && (
        <div className="world3d-music-bar">
          <div className="music-now-playing-inline">
            <span className="music-bar-icon">🎵</span>
            <span className="music-bar-title">{EVENING_TRACKS[currentTrackIdx].title}</span>
          </div>
          <button className="music-btn" onClick={handleNext} title="Next track">⏭</button>
          <button className="music-btn" onClick={handleMute} title="Toggle Mute">
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      )}

      <WorldEventBanner event={event} world={currentScene} onDismiss={clearEvent} />
      {visible && presenceCount > 0 && (
        <div className="world-presence-badge">
          <span className="presence-dot" />
          {presenceCount} monster{presenceCount !== 1 ? 's' : ''} here
        </div>
      )}
      <WorldVoiceButton worldContext={currentScene} visible={visible} />

      <Canvas
        frameloop={visible ? 'always' : 'demand'}
        dpr={[1, 1.5]}
        gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl, scene }) => { canvasRef.current = { gl, scene }; }}
      >
        <PerspectiveCamera makeDefault position={[0, 4, 22]} fov={45} />
        <OrbitControls target={[0, 1.5, 0]} minDistance={10} maxDistance={100} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 2} enablePan={true} />
        <ReadySignal onReady={onReady} />
        <Scene
          scene={currentScene}
          eventLine=""
        />
      </Canvas>
    </div>
  );
}
