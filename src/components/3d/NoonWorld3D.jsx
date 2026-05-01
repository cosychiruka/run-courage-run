import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Scene } from './Scene3D';
import { audioManager } from '../../utils/audioManager';

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
 * Full-screen WebGL portal for the noon 3D world.
 * Uses noon-chill (dirty paws) for calm daytime music.
 */
export default function NoonWorld3D({ visible, onReady, onClose }) {
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [showMusicTitle, setShowMusicTitle] = useState(false);
  const [minimizedMusic, setMinimizedMusic] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && visible) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
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

  // Play noon chill theme when visible
  useEffect(() => {
    let timer;
    if (visible && audioLoaded) {
      setShowMusicTitle(true);
      setMinimizedMusic(false);
      timer = setTimeout(() => setMinimizedMusic(true), 3500);

      const playAudio = async () => {
        try {
          await audioManager.playTrack('noon-chill', {
            loop: true,
            volume: 0.4
          });
        } catch (error) {
          console.warn('Failed to play noon theme:', error);
        }
      };
      
      setTimeout(playAudio, 200);
    } else {
      setShowMusicTitle(false);
    }
    
    return () => {
      clearTimeout(timer);
      audioManager.softCleanup();
    };
  }, [visible, audioLoaded]);

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
          drag to orbit &nbsp;·&nbsp; scroll to zoom
        </div>
      )}
      {visible && showMusicTitle && (
        <div className={`music-now-playing ${minimizedMusic ? 'minimized' : ''}`}>
          <div className="music-icon">🎵</div>
          <div className="music-details">
            <div className="music-label">Now Playing</div>
            <div className="music-title">Dirty Paws</div>
          </div>
        </div>
      )}
      <style>{`
        .music-now-playing {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(15, 15, 25, 0.85);
          backdrop-filter: blur(12px);
          padding: 25px 45px;
          border-radius: 50px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: white;
          display: flex;
          align-items: center;
          gap: 24px;
          z-index: 1000;
          transition: all 0.8s cubic-bezier(0.25, 1, 0.5, 1);
          box-shadow: 0 15px 40px rgba(0,0,0,0.6);
          animation: popInMusic 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          pointer-events: none;
        }
        .music-now-playing.minimized {
          top: unset;
          bottom: 30px;
          left: 30px;
          transform: none;
          padding: 12px 24px;
          border-radius: 20px;
          gap: 15px;
          background: rgba(10, 10, 18, 0.9);
          box-shadow: 0 5px 20px rgba(0,0,0,0.5);
          pointer-events: all;
          cursor: pointer;
        }
        @media (max-width: 768px) {
          .music-now-playing.minimized {
            left: 5vw;
            margin-left: 15px;
          }
        }
        .music-now-playing.minimized:hover {
          background: rgba(30, 30, 45, 0.95);
          transform: translateY(-2px);
        }
        .music-now-playing.minimized .music-icon { font-size: 1.5rem; }
        .music-now-playing.minimized .music-label { font-size: 0.7rem; }
        .music-now-playing.minimized .music-title { font-size: 1rem; }
        .music-icon {
          font-size: 3.5rem;
          transition: font-size 0.8s ease;
        }
        .music-details {
          display: flex;
          flex-direction: column;
        }
        .music-label {
          font-size: 1.1rem;
          color: #ffaa44;
          text-transform: uppercase;
          letter-spacing: 3px;
          margin-bottom: 2px;
          transition: all 0.8s ease;
        }
        .music-title {
          font-size: 2.2rem;
          font-weight: 900;
          transition: all 0.8s ease;
          white-space: nowrap;
          text-shadow: 0 2px 5px rgba(0,0,0,0.5);
        }
        @keyframes popInMusic {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
      
      {visible && (
        <div className="world3d-music-controls">
          <button 
            className="music-btn"
            onClick={() => {
              const newVolume = audioManager.volume === 0 ? 0.4 : 0;
              audioManager.setVolume(newVolume);
            }}
            title="Toggle Mute"
          >
            {audioManager.volume === 0 ? '🔇' : '🔊'}
          </button>
        </div>
      )}
      <Canvas
        dpr={[1, 1.5]}
        gl={{
          antialias: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.5, 
          powerPreference: 'high-performance',
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <PerspectiveCamera makeDefault position={[0, 6, 20]} fov={45} />
        <OrbitControls
          target={[0, 1, 0]}
          minDistance={5}
          maxDistance={60}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2}
          enablePan={true}
        />
        <ReadySignal onReady={onReady} />
        <Scene scene="noon" />
      </Canvas>
    </div>
  );
}
