import React, { useEffect, useRef, useState, useCallback } from 'react';
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
 * Full-screen WebGL portal for the evening 3D world.
 * Lazy-loaded via React.lazy — Three.js bundle only downloads on first open.
 * Mounts invisibly (opacity 0) so the scene can warm up in the background;
 * the parent sets visible=true once onReady fires, triggering a smooth fade-in.
 * When unmounted, Canvas automatically disposes the WebGL context.
 */
export default function EveningWorld3D({ visible, onReady, onClose }) {
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [currentScene, setCurrentScene] = useState('evening');
  const canvasRef = useRef(null);

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

  // Handle scene switching
  const switchToSunrise = useCallback(() => {
    setCurrentScene('sunrise');
      // Stop ALL music and play sunrise music
    audioManager.stopAllTracks();
    setTimeout(() => {
      audioManager.playTrack('sunrise-energetic', { loop: true, volume: 0.4 });
    }, 100);
  }, []);

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
      setTimeout(playSceneAudio, 100);
    }
    
    return () => {
      if (audioLoaded) {
        audioManager.fadeOut(300);
        // Complete cleanup after fade out
        setTimeout(() => audioManager.cleanup(), 400);
      }
      // Force WebGL context cleanup
      const gl = canvasRef.current?.getContext('webgl') || canvasRef.current?.getContext('webgl2');
      if (gl) {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      }
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
      {visible && (
        <div className="world3d-music-controls">
          <button 
            className="music-btn"
            onClick={switchToSunrise}
            title="Switch to Sunrise Scene"
          >
            🌅 {currentScene === 'sunrise' ? 'Sunrise' : 'Chase'}
          </button>
          <button 
            className="music-btn"
            onClick={async () => {
              setCurrentScene('evening');
              audioManager.stopAllTracks();
              setTimeout(async () => {
                try {
                  await audioManager.playTrack('run-boy-run', { loop: true, volume: 0.3 });
                } catch (error) {
                  console.warn('Failed to play run-boy-run:', error);
                }
              }, 100);
            }}
            title="Switch to Evening Scene"
          >
            🌆 Evening
          </button>
          <button 
            className="music-btn"
            onClick={() => {
              const newVolume = audioManager.volume === 0 ? 0.3 : 0;
              audioManager.setVolume(newVolume);
            }}
            title="Toggle Mute"
          >
            {audioManager.volume === 0 ? '🔇' : '🔊'}
          </button>
        </div>
      )}
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
        <Scene scene={currentScene} />
      </Canvas>
    </div>
  );
}
