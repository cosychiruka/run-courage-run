import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html, SpotLight } from '@react-three/drei';
import * as THREE from 'three';
import { Scene } from './Scene3D';
import { House } from './House3D';
import { audioManager } from '../../utils/audioManager';
import courageDancingGif from '../../assets/images/courage.gif';

const MemoHouse = React.memo(House);

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

function HayStack({ position, rotation = [0, 0, 0] }) {
  const geo = useMemo(() => new THREE.BoxGeometry(1.4, 1.0, 1.4), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cca355', roughness: 1 }), []);
  return (
    <group position={position} rotation={rotation}>
       <mesh position={[0, 0.5, 0]} geometry={geo} material={mat} />
       <mesh position={[0.4, 1.5, -0.2]} rotation={[0, 0.2, 0]} geometry={geo} material={mat} />
       <mesh position={[-0.4, 0.5, 0.4]} rotation={[0, -0.15, 0]} geometry={geo} material={mat} />
       <mesh position={[-0.2, 1.4, 0.3]} rotation={[0, -0.3, 0]} geometry={geo} material={mat} />
       <mesh position={[0.1, 2.5, 0]} rotation={[0, 0.1, 0]} geometry={geo} material={mat} />
    </group>
  );
}

function StrawGround({ position }) {
  const straws = useMemo(() => {
     const arr = [];
     for(let i=0; i<60; i++) {
        arr.push({
           x: (Math.random() - 0.5) * 8,
           z: (Math.random() - 0.5) * 6,
           r: Math.random() * Math.PI,
           s: Math.random() * 0.4 + 0.6
        });
     }
     return arr;
  }, []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e8c982' }), []);
  const geo = useMemo(() => new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4), []);
  
  return (
    <group position={position}>
       {straws.map((s, i) => (
          <mesh key={i} position={[s.x, 0.02, s.z]} rotation={[Math.PI/2, 0, s.r]} scale={[1, s.s, 1]} geometry={geo} material={mat} />
       ))}
    </group>
  );
}

function Speaker({ position, rotation }) {
  const groupRef = useRef();
  useFrame((state) => {
     if (groupRef.current) {
        const t = state.clock.elapsedTime * 8; 
        const scale = 1 + Math.max(0, Math.sin(t)) * 0.15;
        groupRef.current.scale.set(1, scale, 1);
        groupRef.current.position.y = position[1] + (scale - 1) * 0.5;
     }
  });
  const matBox = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.8 }), []);
  const matTweeter = useMemo(() => new THREE.MeshStandardMaterial({ color: '#333333' }), []);
  const matWoofer = useMemo(() => new THREE.MeshStandardMaterial({ color: '#00ffcc', emissive: '#00ffcc', emissiveIntensity: 0.5 }), []);
  return (
    <group position={position} rotation={rotation} ref={groupRef}>
      <mesh position={[0, 1, 0]} material={matBox}>
         <boxGeometry args={[1.5, 2.5, 1]} />
      </mesh>
      <mesh position={[0, 1.8, 0.51]} material={matTweeter}>
         <circleGeometry args={[0.3, 16]} />
      </mesh>
      <mesh position={[0, 0.8, 0.51]} material={matWoofer}>
         <circleGeometry args={[0.5, 32]} />
      </mesh>
    </group>
  );
}

function TextileBanner({ position, rotation }) {
  const texRef = useRef(new THREE.CanvasTexture(document.createElement('canvas')));
  useEffect(() => {
     const canvas = document.createElement('canvas');
     canvas.width = 1024; canvas.height = 256;
     const ctx = canvas.getContext('2d');
     ctx.fillStyle = '#1e1e1e';
     ctx.fillRect(0, 0, 1024, 256);
     ctx.strokeStyle = '#00FF00'; ctx.lineWidth = 15;
     ctx.strokeRect(10, 10, 1004, 236);
     ctx.fillStyle = '#00FF00'; ctx.font = 'bold 64px "Comic Sans MS"';
     ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
     ctx.fillText('NOWHERE HIGH SCHOOL DISCO', 512, 128);
     
     ctx.fillStyle = '#ffffff';
     const drawGhost = (cx, cy) => {
        ctx.beginPath();
        ctx.arc(cx, cy, 35, Math.PI, 0);
        ctx.lineTo(cx+35, cy+70); ctx.lineTo(cx+17, cy+50);
        ctx.lineTo(cx, cy+70); ctx.lineTo(cx-17, cy+50);
        ctx.lineTo(cx-35, cy+70); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath(); ctx.arc(cx-15, cy+10, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+15, cy+10, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffffff';
     };
     drawGhost(100, 80);
     drawGhost(924, 80);
     
     texRef.current.image = canvas;
     texRef.current.needsUpdate = true;
  }, []);
  return (
     <mesh position={position} rotation={rotation}>
        <planeGeometry args={[8, 2]} />
        <meshStandardMaterial map={texRef.current} roughness={0.9} />
     </mesh>
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

const DISCO_TRACKS = [
  { id: 'thrilla-michael-jackson', title: 'Thrilla - MJ', url: '/audio/thrilla-michael-jackson.mp3' },
  { id: 'monster-fren-mikeybotz', title: 'Monster Fren - Mikeybotz', url: '/audio/monster-fren-mikeybotz.mp3' },
  { id: 'dirty-paws-monsters-nmen', title: 'Dirty Paws - Monsters & Men', url: '/audio/dirty-paws-monsters-nmen.mp3' },
  { id: 'smuth-criminal-zandaru', title: 'Smuth Criminal - Zandaru', url: '/audio/smuth-criminal-zandaru.mp3' },
  { id: 'badtuch-bloodhoundg', title: 'Badtuch - BloodhoundG', url: '/audio/badtuch-bloodhoundg.mp3' },
  { id: 'more-makreel-thrifty', title: 'More Makreel - Thrifty', url: '/audio/more-makreel-thrifty.mp3' }
];

export default function DiscoWorld3D({ visible, onReady, onClose }) {
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && visible) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, visible]);

  useEffect(() => {
    if (visible && !audioLoaded) {
       // We don't preload all 6 tracks globally to save memory. Just mark audio loaded.
       setAudioLoaded(true);
    }
  }, [visible, audioLoaded]);

  useEffect(() => {
    if (visible && audioLoaded) {
      const track = DISCO_TRACKS[currentTrackIdx];
      const playNext = async () => {
         await audioManager.loadTrack(track.id, track.url);
         if (isPlaying) {
            await audioManager.playTrack(track.id, { loop: true, volume: 0.5 });
         } else {
            audioManager.stopAllTracks();
         }
      };
      playNext();
    }
    return () => audioManager.stopAllTracks();
  }, [visible, audioLoaded, currentTrackIdx, isPlaying]);

  return (
    <div className="world3d-overlay" style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'all' : 'none', transition: 'opacity 0.8s ease', zIndex: 9999 }}>
      {visible && <button className="world3d-close" onClick={onClose} aria-label="Exit 3D World">✕ Exit</button>}
      {visible && <div className="world3d-hint">drag to orbit &nbsp;·&nbsp; scroll to zoom</div>}
      
      {/* Disco Music Player Overlay */}
      {visible && (
         <div style={{
            position: 'absolute', bottom: '30px', left: '30px',
            background: 'rgba(10, 10, 18, 0.9)', backdropFilter: 'blur(10px)',
            padding: '15px 25px', borderRadius: '20px', border: '1px solid rgba(0, 255, 0, 0.3)',
            display: 'flex', alignItems: 'center', gap: '20px', color: 'white', zIndex: 10,
            boxShadow: '0 5px 20px rgba(0,255,0,0.2)', pointerEvents: 'all'
         }}>
            <div style={{ fontSize: '2rem' }}>💿</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
               <span style={{ fontSize: '0.7rem', color: '#00FF00', fontWeight: 'bold' }}>DJ Courage's Playlist</span>
               <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{DISCO_TRACKS[currentTrackIdx].title}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginLeft: '10px' }}>
               <button onClick={() => setIsPlaying(!isPlaying)} style={{ background: '#333', border: 'none', color: '#00FF00', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '1.2rem' }}>
                  {isPlaying ? '⏸' : '▶️'}
               </button>
               <button onClick={() => setCurrentTrackIdx(i => (i + 1) % DISCO_TRACKS.length)} style={{ background: '#333', border: 'none', color: '#00FF00', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '1.2rem' }}>
                  ⏭
               </button>
            </div>
         </div>
      )}
      
      <Canvas dpr={[1, 1.5]} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, powerPreference: 'high-performance' }} style={{ width: '100%', height: '100%' }}>
        <PerspectiveCamera makeDefault position={[0, 5, 25]} fov={50} />
        <OrbitControls target={[0, 2, -10]} minDistance={5} maxDistance={60} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 2} enablePan={true} />
        <ReadySignal onReady={onReady} />
        
        {/* We reuse evening colors and objects but disable the moving Courage/Ghost animations */}
        <Scene scene="evening" showStory={false} />
        
        {/* The House and its 3D Banner attached right onto the wall above middle level */}
        <group position={[-2.5, -0.2, 0]}>
           <MemoHouse doorOpen={false} />
           <TextileBanner position={[0, 4.5, 1.4]} rotation={[0, 0, 0]} />
        </group>
        
        {/* Pumping speakers on the dance floor */}
        <Speaker position={[-5, 0, -6]} rotation={[0, 0.4, 0]} />
        <Speaker position={[5, 0, -6]} rotation={[0, -0.4, 0]} />
        
        {/* Hay stacks flanking the dancing floor */}
        <HayStack position={[-9, 0, -10]} rotation={[0, 0.5, 0]} />
        <HayStack position={[-7, 0, -4]} rotation={[0, -0.3, 0]} />
        <HayStack position={[8, 0, -12]} rotation={[0, -0.6, 0]} />
        <HayStack position={[9, 0, -5]} rotation={[0, 0.4, 0]} />

        <StrawGround position={[0, 0, -9]} />
        
        <Html position={[0, -0.5, -10]} center transform sprite zIndexRange={[100, 0]}>
           <img src={courageDancingGif} alt="Courage Dancing" style={{ width: '250px', filter: 'drop-shadow(0px 10px 10px rgba(0,0,0,0.8))' }} />
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
