import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Scene } from './Scene3D';
import { audioManager } from '../../utils/audioManager';
import WorldVoiceButton from '../WorldVoiceButton';
import WorldEventBanner from '../WorldEventBanner';
import { useWorldEvents } from '../../hooks/useWorldEvents';

/**
 * Fires onReady() on the very first rendered frame — signals to the parent
 * that the WebGL scene is fully painted and the transition can begin.
 */
function ReadySignal({ onReady }) {
  const calledRef = useRef(false);
  useFrame(() => {
    if (!calledRef.current) {
      calledRef.current = true;
      onReady();
    }
  });
  return null;
}

/**
 * Full-screen WebGL portal for the evening 3D world.
 * Lazy-loaded via React.lazy — Three.js bundle only downloads on first open.
 * Mounts invisibly (opacity 0) so the scene can warm up in the background;
 * the parent sets visible=true once onReady fires, triggering a smooth fade-in.
 * When unmounted, Canvas automatically disposes the WebGL context.
 */
export default function EveningWorld3D({ visible, onReady, onClose }) {
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [currentScene, setCurrentScene] = useState('evening');
  const [showMusicTitle, setShowMusicTitle] = useState(false);
  const [minimizedMusic, setMinimizedMusic] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
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
    
    // Add world3d-active class to body for CSS targeting
    if (visible) {
      document.body.classList.add('world3d-active');
    } else {
      document.body.classList.remove('world3d-active');
    }
    
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.classList.remove('world3d-active');
    };
  }, [onClose, visible]);

  // Initialize and preload audio
  useEffect(() => {
    const initAudio = async () => {
      await audioManager.preloadTracks();
      setAudioLoaded(true);
    };
    
    if (visible && !audioLoaded) {
      initAudio();
    }
  }, [visible, audioLoaded]);

  // Removed switchToSunrise callback as per architectural rules

  // Play scene-specific music when visible or scene changes
  useEffect(() => {
    if (visible && audioLoaded) {
      const playSceneAudio = async () => {
        try {
          if (currentScene === 'evening') {
            await audioManager.playTrack('run-boy-run', {
              loop: true,
              volume: 0.3
            });
          } else if (currentScene === 'sunrise') {
            await audioManager.playTrack('sunrise-energetic', {
              loop: true,
              volume: 0.4
            });
          }
        } catch (error) {
          console.warn('Failed to play scene audio:', error);
        }
      };
      
      // Delay slightly to ensure user interaction context
      setTimeout(playSceneAudio, 200);
    }
    
    // Show music badge
    if (visible && audioLoaded) {
      setShowMusicTitle(true);
      setMinimizedMusic(false);
      const timer = setTimeout(() => setMinimizedMusic(true), 3500);
      return () => {
        clearTimeout(timer);
        audioManager.softCleanup();
      };
    }
    
    return () => {
      audioManager.softCleanup();
    };
  }, [visible, audioLoaded, currentScene]);

  return (
    <div
      className="world3d-overlay"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'all' : 'none',
        transition: 'opacity 0.8s ease',
      }}
    >
      {visible && (
        <button className="world3d-close" onClick={onClose} aria-label="Exit 3D World">
          ✕ Exit
        </button>
      )}
      {visible && (
        <div className="world3d-hint">
          {currentScene === 'sunrise' ? '🌅 Sunrise Scene' : '🌆 Evening Scene'} &nbsp;·&nbsp; drag to orbit &nbsp;·&nbsp; scroll to zoom
        </div>
      )}
      {visible && showMusicTitle && (
        <div className={`music-now-playing ${minimizedMusic ? 'minimized' : ''}`}>
          <div className="music-icon">🎵</div>
          <div className="music-details">
            <div className="music-label">Now Playing</div>
            <div className="music-title">{currentScene === 'evening' ? 'Run Boy Run' : 'Shush All Star'}</div>
          </div>
        </div>
      )}
      {visible && (
        <div className="world3d-music-controls">
          <button 
            className="music-btn"
            onClick={() => {
              const nowMuted = audioManager.toggleMute();
              setIsMuted(nowMuted);
            }}
            title="Toggle Mute"
          >
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
        ref={canvasRef}
        dpr={[1, 1.5]}
        gl={{
          antialias: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1,
          powerPreference: 'high-performance',
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <PerspectiveCamera makeDefault position={[0, 4, 22]} fov={45} />
        <OrbitControls
          target={[0, 1.5, 0]}
          minDistance={10}
          maxDistance={100}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2}
          enablePan={true}
        />
        <ReadySignal onReady={onReady} />
        <Scene scene={currentScene} />
      </Canvas>
    </div>
  );
}
