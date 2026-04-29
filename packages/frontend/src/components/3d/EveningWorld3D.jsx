import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Scene } from './Scene3D';

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
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && visible) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, visible]);

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
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
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
        <Scene />
      </Canvas>
    </div>
  );
}
