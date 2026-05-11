import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Scene } from './Scene3D';
import { audioManager } from '../../utils/audioManager';
import { useSelfie } from '../../hooks/useSelfie';
import SelfieUI from '../SelfieUI';
import WorldVoiceButton from '../WorldVoiceButton';
import WorldEventBanner from '../WorldEventBanner';
import { useWorldEvents, registerPresence } from '../../hooks/useWorldEvents';
import { captureAndShareSelfie } from '../../utils/screenshotUtils';

const SUNRISE_TRACKS = [
  { id: 'shush-all-star',      url: '/audio/shush-all-star.mp3',       title: 'Shush All Star' },
  { id: 'more-makreel-thrifty', url: '/audio/more-makreel-thrifty.mp3', title: 'More Makreel' },
];

function ReadySignal({ onReady }) {
  const calledRef = useRef(false);
  useFrame(() => {
    if (!calledRef.current) { calledRef.current = true; onReady(); }
  });
  return null;
}

export default function SunriseWorld3D({ visible, onReady, onClose }) {
  const [audioLoaded, setAudioLoaded]         = useState(false);
  const [isMuted, setIsMuted]                 = useState(false);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const canvasRef = useRef(null);
  const selfie    = useSelfie();

  const { event, clearEvent, presenceCount } = useWorldEvents({
    world: 'sunrise',
    active: visible,
    state: { state: 'running' },
    intervalMs: 17_000,
  });

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

  // Register selfie presence + heartbeat
  useEffect(() => {
    if (!selfie.isActive) return;
    const uid = `sunrise_${Date.now()}`;
    registerPresence({ world: 'sunrise', uid, name: selfie.label, emoji: '🪰' });
    const hb = setInterval(() =>
      registerPresence({ world: 'sunrise', uid, name: selfie.label, emoji: '🪰' }),
    120_000);
    return () => clearInterval(hb);
  }, [selfie.isActive, selfie.label]);

  const handleScreenshot = useCallback(() => {
    captureAndShareSelfie({
      previewUrl: selfie.previewUrl,
      label: selfie.label,
      worldName: 'Sunrise World',
      monsterEmoji: '🪰',
      tweetText: `🪰 I became a Giant Fly chasing Courage at Sunrise with @runcouragerun! #CourageRunRun #GiantFlySelfie`,
    });
  }, [selfie.previewUrl, selfie.label]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && visible) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, visible]);

  // Load all sunrise tracks on first open
  useEffect(() => {
    if (!visible || audioLoaded) return;
    const load = async () => {
      await Promise.all(SUNRISE_TRACKS.map(t => audioManager.loadTrack(t.id, t.url)));
      setAudioLoaded(true);
    };
    load();
  }, [visible, audioLoaded]);

  // Play track + wire auto-advance
  const playTrack = useCallback(async (idx) => {
    const track = SUNRISE_TRACKS[idx];
    await audioManager.loadTrack(track.id, track.url);
    await audioManager.playTrack(track.id, { loop: false, volume: 0.4 });
    const t = audioManager.tracks.get(track.id);
    if (t?.source) {
      t.source.onended = () => {
        if (audioManager.currentTrack === track.id) {
          const next = (idx + 1) % SUNRISE_TRACKS.length;
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

  const handleNext = useCallback(() => setCurrentTrackIdx(i => (i + 1) % SUNRISE_TRACKS.length), []);
  const handleMute = useCallback(() => { const m = audioManager.toggleMute(); setIsMuted(m); }, []);

  return (
    <div className="world3d-overlay" style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'all' : 'none', transition: 'opacity 0.8s ease' }}>
      {visible && <button className="world3d-close" onClick={onClose} aria-label="Exit 3D World">✕ Exit</button>}
      {visible && <div className="world3d-hint">🌅 Sunrise &nbsp;·&nbsp; drag to orbit &nbsp;·&nbsp; scroll to zoom</div>}

      {/* ── Music bar ── */}
      {visible && (
        <div className="world3d-music-bar">
          <div className="music-now-playing-inline">
            <span className="music-bar-icon">🎵</span>
            <span className="music-bar-title">{SUNRISE_TRACKS[currentTrackIdx].title}</span>
          </div>
          <button className="music-btn" onClick={handleNext} title="Next track">⏭</button>
          <button className="music-btn" onClick={handleMute} title="Toggle Mute">
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      )}

      {/* Selfie FAB row sits above music bar */}
      <SelfieUI
        selfie={selfie}
        visible={visible}
        worldName="Sunrise World"
        monsterName="Giant Fly"
        monsterEmoji="🪰"
        onScreenshot={handleScreenshot}
      />
      <WorldEventBanner event={event} world="sunrise" onDismiss={clearEvent} />
      {visible && presenceCount > 0 && (
        <div className="world-presence-badge">
          <span className="presence-dot" />
          {presenceCount} fl{presenceCount !== 1 ? 'ies' : 'y'} here
        </div>
      )}
      <WorldVoiceButton worldContext="sunrise" visible={visible} />

      <Canvas
        frameloop={visible ? 'always' : 'demand'}
        dpr={[1, 1.5]}
        gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl, scene }) => { canvasRef.current = { gl, scene }; }}
      >
        <PerspectiveCamera makeDefault position={[0, 4, 22]} fov={45} />
        <OrbitControls target={[0, 1.5, 0]} minDistance={10} maxDistance={100} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 2} enablePan={true} />
        <ReadySignal onReady={onReady} />
        <Scene
          scene="sunrise"
          selfieFlyTexture={selfie.isActive ? selfie.texture : null}
          selfieFlyLabel={selfie.isActive ? selfie.label : ''}
          selfieFlyPreviewUrl={selfie.isActive ? selfie.previewUrl : null}
          eventLine={event?.action === 'thought_bubble' ? (event.message ?? '') : ''}
        />
      </Canvas>
    </div>
  );
}
