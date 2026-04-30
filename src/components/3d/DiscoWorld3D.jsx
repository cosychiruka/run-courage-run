import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html, SpotLight } from '@react-three/drei';
import * as THREE from 'three';
import { Scene } from './Scene3D';
import { audioManager } from '../../utils/audioManager';

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

function DiscoBall() {
  const meshRef = useRef();
  
  useFrame((state) => {
     if (meshRef.current) {
        meshRef.current.rotation.y += 0.01;
        meshRef.current.rotation.x += 0.005;
     }
  });
  
  return (
    <group position={[0, 15, -10]}>
       <mesh ref={meshRef}>
         <icosahedronGeometry args={[2.5, 3]} />
         <meshStandardMaterial color="#ffffff" metalness={1} roughness={0.1} />
       </mesh>
       <SpotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={5} color="#ff00ff" />
       <SpotLight position={[-10, 10, 10]} angle={0.3} penumbra={1} intensity={5} color="#00ffff" />
    </group>
  );
}

function DancingGhost({ position, offsetTime = 0 }) {
  const groupRef = useRef(null);
  
  const ghostMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#ffffff', emissive: '#d7d4ff', emissiveIntensity: 0.8,
    transparent: true, opacity: 0.85, roughness: 0.8
  }), []);
  const eyeGeo = useMemo(() => new THREE.CircleGeometry(0.08, 16), []);
  const eyeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#111122' }), []);

  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime * 4 + offsetTime;
      // Wobble up and down slightly (vibing)
      groupRef.current.position.y = position[1] + Math.sin(t) * 0.3;
      // Scale squish
      const scaleSquish = 1 + Math.sin(t * 2) * 0.1;
      groupRef.current.scale.set(1 / scaleSquish, scaleSquish, 1);
      // Look slightly side to side
      groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.5;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <pointLight color="#d7d4ff" intensity={1} distance={5} />
      <mesh position={[0, 0.4, 0]}><sphereGeometry args={[0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><primitive object={ghostMat} attach="material" /></mesh>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.35, 0.35, 0.4, 16]} /><primitive object={ghostMat} attach="material" /></mesh>
      <mesh position={[-0.23, 0, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.12, 0.25, 8]} /><primitive object={ghostMat} attach="material" /></mesh>
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.12, 0.25, 8]} /><primitive object={ghostMat} attach="material" /></mesh>
      <mesh position={[0.23, 0, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.12, 0.25, 8]} /><primitive object={ghostMat} attach="material" /></mesh>
      <mesh position={[-0.12, 0.45, 0.35]}><primitive object={eyeGeo} attach="geometry" /><primitive object={eyeMat} attach="material" /></mesh>
      <mesh position={[0.12, 0.45, 0.35]}><primitive object={eyeGeo} attach="geometry" /><primitive object={eyeMat} attach="material" /></mesh>
    </group>
  );
}

export default function DiscoWorld3D({ visible, onReady, onClose }) {
  const [audioLoaded, setAudioLoaded] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && visible) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, visible]);

  useEffect(() => {
    const initAudio = async () => {
      await audioManager.preloadTracks();
      setAudioLoaded(true);
    };
    if (visible && !audioLoaded) initAudio();
  }, [visible, audioLoaded]);

  useEffect(() => {
    if (visible && audioLoaded) {
      const playAudio = async () => {
        try {
          // Play the requested vibe track!
          await audioManager.playTrack('too-sexy-scene', { loop: true, volume: 0.5 });
        } catch (error) {
          console.warn('Failed to play too-sexy-scene:', error);
        }
      };
      setTimeout(playAudio, 100);
    }
    return () => {
      if (audioLoaded) audioManager.fadeOut(500);
    };
  }, [visible, audioLoaded]);

  return (
    <div className="world3d-overlay" style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'all' : 'none', transition: 'opacity 0.8s ease', zIndex: 9999 }}>
      {visible && <button className="world3d-close" onClick={onClose} aria-label="Exit 3D World">✕ Exit</button>}
      {visible && <div className="world3d-hint">drag to orbit &nbsp;·&nbsp; scroll to zoom</div>}
      
      {/* HTML Banner over WebGL bounds */}
      <div style={{
         position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
         backgroundColor: '#1E1E1E', color: '#00FF00', padding: '15px 30px', border: '4px solid #00FF00',
         borderRadius: '10px', fontSize: '2rem', fontWeight: 900, textTransform: 'uppercase',
         boxShadow: '0 0 20px #00FF00, inset 0 0 10px #00FF00', zIndex: 10,
         textShadow: '0 0 5px #00FF00', animation: 'pulseBanner 1s infinite alternate', pointerEvents: 'none'
      }}>
         Nowhere High School Disco
      </div>
      <style>{`@keyframes pulseBanner { 0% { transform: translateX(-50%) scale(1); } 100% { transform: translateX(-50%) scale(1.05); } }`}</style>
      
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, powerPreference: 'high-performance' }} style={{ width: '100%', height: '100%' }}>
        <PerspectiveCamera makeDefault position={[0, 5, 25]} fov={50} />
        <OrbitControls target={[0, 2, -10]} minDistance={5} maxDistance={60} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 2} enablePan={true} />
        <ReadySignal onReady={onReady} />
        
        {/* We reuse evening colors and objects but disable the moving Courage/Ghost animations */}
        <Scene scene="evening" showStory={false} />
        
        <DiscoBall />
        
        <Html position={[0, -0.5, -10]} center transform sprite zIndexRange={[100, 0]}>
           <img src="/assets/courage-dancing.gif" alt="Courage Dancing" style={{ width: '250px', filter: 'drop-shadow(0px 10px 10px rgba(0,0,0,0.8))' }} />
        </Html>
        
        <DancingGhost position={[-4, 1, -10]} offsetTime={0} />
        <DancingGhost position={[4, 1, -10]} offsetTime={1.2} />
        <DancingGhost position={[-2, 1, -14]} offsetTime={0.5} />
        <DancingGhost position={[2, 1, -14]} offsetTime={2.3} />
        <DancingGhost position={[0, 2, -6]} offsetTime={3.1} />
        
      </Canvas>
    </div>
  );
}
