import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Scene } from './Scene3D';
import { audioManager } from '../../utils/audioManager';
import { useSelfie } from '../../hooks/useSelfie';
import SelfieUI from '../SelfieUI';
import WorldVoiceButton from '../WorldVoiceButton';

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
 * Full-screen WebGL portal for the sunrise 3D world.
 * Uses Seek Chase Theme for energetic wake-up music.
 */
export default function SunriseWorld3D({ visible, onReady, onClose }) {
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [showMusicTitle, setShowMusicTitle] = useState(false);
  const [minimizedMusic, setMinimizedMusic] = useState(false);
  const selfie = useSelfie();

  const handleScreenshot = useCallback(() => {
    const glCanvas = document.querySelector('.world3d-overlay canvas');
    try {
      const dataUrl = glCanvas?.toDataURL('image/png');
      if (dataUrl) {
        const link = document.createElement('a');
        link.download = 'giant-fly-selfie-sunrise.png';
        link.href = dataUrl;
        link.click();
      }
    } catch (e) { /* cross-origin, skip download */ }
    setTimeout(() => {
      const text = encodeURIComponent(`🪰 I became a Giant Fly chasing Courage at Sunrise! 🐕 Play with @CourageMemeSOL #CourageRunRun #GiantFlySelfie`);
      window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    }, 700);
  }, []);

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

  // Play Seek Chase Theme when visible (energetic wake-up)
  useEffect(() => {
    let timer;
    if (visible && audioLoaded) {
      setShowMusicTitle(true);
      setMinimizedMusic(false);
      timer = setTimeout(() => setMinimizedMusic(true), 3500);

      // Play Sunrise feel-good Theme
      const playAudio = async () => {
        try {
          await audioManager.playTrack('sunrise-energetic', {
            loop: true,
            volume: 0.4
          });
        } catch (error) {
          console.warn('Failed to play sunrise theme:', error);
        }
      };
      
      // Delay slightly to ensure user interaction context
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
            <div className="music-title">Shush All Star</div>
          </div>
        </div>
      )}


      {visible && (
        <div className="world3d-music-controls">
          <button 
            className="music-btn"
            onClick={async () => {
              try {
                await audioManager.playTrack('run-boy-run', { volume: 0.3 });
              } catch (error) {
                console.warn('Failed to play run-boy-run:', error);
              }
            }}
            title="Play Run Boy Run"
          >
            🏃 Run
          </button>
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
      <SelfieUI
        selfie={selfie}
        visible={visible}
        worldName="Sunrise World"
        monsterName="Giant Fly"
        monsterEmoji="🪰"
        fabRight="180px"
        onScreenshot={handleScreenshot}
      />
      <WorldVoiceButton worldContext="sunrise" visible={visible} />
      <Canvas
        dpr={[1, 1.5]}
        gl={{
          antialias: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2, 
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
        <Scene
          scene="sunrise"
          selfieFlyTexture={selfie.isActive ? selfie.texture : null}
          selfieFlyLabel={selfie.isActive ? selfie.label : ''}
        />
      </Canvas>
    </div>
  );
}
