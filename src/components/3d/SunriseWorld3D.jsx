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
 * Full-screen WebGL portal for the sunrise 3D world.
 * Uses Seek Chase Theme for energetic wake-up music.
 */
export default function SunriseWorld3D({ visible, onReady, onClose }) {
  const [audioLoaded, setAudioLoaded] = useState(false);

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
    if (visible && audioLoaded) {
      // Play Seek Chase Theme for sunrise scene - requires user interaction
      const playAudio = async () => {
        try {
          await audioManager.playTrack('seek-chase', {
            loop: true,
            volume: 0.4
          });
        } catch (error) {
          console.warn('Failed to play seek-chase theme:', error);
        }
      };
      
      // Delay slightly to ensure user interaction context
      setTimeout(playAudio, 100);
    }
    
    return () => {
      if (audioLoaded) {
        audioManager.fadeOut(500);
      }
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
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2, // Brighter for sunrise
          powerPreference: 'high-performance',
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <PerspectiveCamera makeDefault position={[0, 3, 50]} fov={30} />
        <OrbitControls
          target={[0, 1.5, 0]}
          minDistance={10}
          maxDistance={100}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2}
          enablePan={true}
        />
        <ReadySignal onReady={onReady} />
        <Scene scene="sunrise" />
      </Canvas>
    </div>
  );
}
