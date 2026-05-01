import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html, SpotLight } from '@react-three/drei';
import * as THREE from 'three';
import { Scene } from './Scene3D';
import { House } from './House3D';
import { audioManager } from '../../utils/audioManager';
import courageDancingGif from '../../assets/images/Courage.gif';

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

function DiscoBall3D({ position }) {
  const ballRef = useRef();
  const lightRef1 = useRef();
  const lightRef2 = useRef();
  const lightRef3 = useRef();

  const facetMat = useMemo(() => new THREE.MeshStandardMaterial({ metalness: 0.9, roughness: 0.1 }), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ballRef.current) ballRef.current.rotation.y = t * 0.5;
    // Rotating colored spot lights to simulate reflections
    const r = 8;
    if (lightRef1.current) {
      lightRef1.current.position.set(Math.cos(t * 0.8) * r, -2, Math.sin(t * 0.8) * r);
      lightRef1.current.color.setHSL((t * 0.05) % 1, 1, 0.5);
    }
    if (lightRef2.current) {
      lightRef2.current.position.set(Math.cos(t * 0.8 + Math.PI * 0.66) * r, -2, Math.sin(t * 0.8 + Math.PI * 0.66) * r);
      lightRef2.current.color.setHSL(((t * 0.05) + 0.33) % 1, 1, 0.5);
    }
    if (lightRef3.current) {
      lightRef3.current.position.set(Math.cos(t * 0.8 + Math.PI * 1.33) * r, -2, Math.sin(t * 0.8 + Math.PI * 1.33) * r);
      lightRef3.current.color.setHSL(((t * 0.05) + 0.66) % 1, 1, 0.5);
    }
  });

  // Build a pixelated faceted disco ball using many small mirror-like quads
  const facets = useMemo(() => {
    const arr = [];
    const rows = 12, cols = 16;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const phi = (r / rows) * Math.PI;
        const theta = (c / cols) * Math.PI * 2;
        arr.push({
          phi, theta,
          color: new THREE.Color().setHSL((r * cols + c) / (rows * cols), 0.9, 0.8)
        });
      }
    }
    return arr;
  }, []);

  return (
    <group position={position}>
      {/* Hanging wire */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 3, 4]} />
        <meshStandardMaterial color="#888888" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Ball */}
      <group ref={ballRef}>
        {/* Core sphere for shape */}
        <mesh>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.8} />
        </mesh>
        {/* Mirror facets — colored squares arranged over sphere */}
        {facets.map(({ phi, theta, color }, i) => {
          const x = Math.sin(phi) * Math.cos(theta);
          const y = Math.cos(phi);
          const z = Math.sin(phi) * Math.sin(theta);
          return (
            <mesh
              key={i}
              position={[x * 1.02, y * 1.02, z * 1.02]}
              lookAt={[x * 5, y * 5, z * 5]}
            >
              <boxGeometry args={[0.14, 0.14, 0.02]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.6}
                metalness={1.0}
                roughness={0.05}
              />
            </mesh>
          );
        })}
      </group>
      {/* Three rotating colored spot lights that sweep the dance floor */}
      <pointLight ref={lightRef1} intensity={3} distance={20} />
      <pointLight ref={lightRef2} intensity={3} distance={20} />
      <pointLight ref={lightRef3} intensity={3} distance={20} />
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

// Dance choreography patterns — each ghost gets assigned one, cycling through phases
const DANCE_PATTERNS = [
  // Pattern 0: orbit the center clockwise
  (t, base) => ({
    x: base[0] + Math.cos(t * 0.6) * 2.5,
    z: base[2] + Math.sin(t * 0.6) * 2.5,
    ry: -t * 0.6,
    scaleY: 1 + Math.sin(t * 8) * 0.12,
  }),
  // Pattern 1: moonwalk (slide left-right, lean)
  (t, base) => ({
    x: base[0] + Math.sin(t * 1.5) * 3,
    z: base[2],
    ry: Math.sin(t * 1.5) > 0 ? 0 : Math.PI,
    scaleY: 1 + Math.abs(Math.sin(t * 6)) * 0.15,
  }),
  // Pattern 2: spin and stop (spin × 3 then freeze 2s)
  (t, base) => {
    const cycle = t % 5;
    return {
      x: base[0],
      z: base[2],
      ry: cycle < 3 ? t * 4 : 0,
      scaleY: 1 + Math.sin(t * 10) * 0.08,
    };
  },
  // Pattern 3: bounce-in-place with big squish
  (t, base) => ({
    x: base[0] + Math.sin(t * 2) * 0.4,
    z: base[2] + Math.cos(t * 1.7) * 0.4,
    ry: Math.sin(t * 2) * 0.8,
    scaleY: 1 + Math.abs(Math.sin(t * 6)) * 0.3,
  }),
  // Pattern 4: figure-8 around haystacks
  (t, base) => ({
    x: base[0] + Math.sin(t * 0.8) * 2,
    z: base[2] + Math.sin(t * 1.6) * 1,
    ry: t * 0.8,
    scaleY: 1 + Math.sin(t * 5) * 0.1,
  }),
];

function DancingGhost({ position, offsetTime = 0, patternIdx = 0, selfieTexture = null, selfieLabel = '', isSelfie = false }) {
  const groupRef = useRef(null);
  const ghostMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#ffffff', emissive: '#d7d4ff', emissiveIntensity: 0.8,
    transparent: true, opacity: isSelfie ? 0.95 : 0.85, roughness: 0.8
  }), [isSelfie]);
  const selfieMat = useMemo(() => selfieTexture
    ? new THREE.MeshStandardMaterial({ map: selfieTexture, roughness: 0.6, metalness: 0.1 })
    : null,
  [selfieTexture]);
  const haloMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff00ff', wireframe: true }), []);
  const eyeGeo = useMemo(() => new THREE.CircleGeometry(0.08, 16), []);
  const eyeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#111122' }), []);
  const basePos = useMemo(() => [...position], [position]);
  const scale = isSelfie ? 1.35 : 1.0;

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime * 1.0 + offsetTime;
    const pattern = DANCE_PATTERNS[patternIdx % DANCE_PATTERNS.length](t, basePos);
    const yBob = basePos[1] + Math.sin(t * 3 + offsetTime) * 0.25 + 0.1;
    groupRef.current.position.set(pattern.x, yBob, pattern.z);
    groupRef.current.rotation.y = pattern.ry;
    const sy = pattern.scaleY;
    groupRef.current.scale.set(
      scale / Math.sqrt(sy),
      scale * sy,
      scale / Math.sqrt(sy)
    );
    if (!isSelfie) {
      const hue = ((t * 0.15 + patternIdx * 0.2) % 1);
      ghostMat.emissive.setHSL(hue, 0.6, 0.5);
      ghostMat.emissiveIntensity = 0.6 + Math.sin(t * 6) * 0.3;
    } else {
      // Selfie ghost pulses gold/pink
      const hue = 0.85 + Math.sin(t * 2) * 0.1;
      ghostMat.emissive.setHSL(hue, 1.0, 0.6);
      ghostMat.emissiveIntensity = 0.8 + Math.sin(t * 8) * 0.4;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <pointLight color={isSelfie ? '#ffaaff' : '#d7d4ff'} intensity={isSelfie ? 3 : 1.5} distance={isSelfie ? 10 : 6} />
      {/* Ghost body dome */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {selfieMat
          ? <primitive object={selfieMat} attach="material" />
          : <primitive object={ghostMat} attach="material" />}
      </mesh>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.35, 0.35, 0.4, 16]} /><primitive object={ghostMat} attach="material" /></mesh>
      <mesh position={[-0.23, 0, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.12, 0.25, 8]} /><primitive object={ghostMat} attach="material" /></mesh>
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.12, 0.25, 8]} /><primitive object={ghostMat} attach="material" /></mesh>
      <mesh position={[0.23, 0, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.12, 0.25, 8]} /><primitive object={ghostMat} attach="material" /></mesh>
      {!selfieMat && (
        <>
          <mesh position={[-0.12, 0.45, 0.35]}><primitive object={eyeGeo} attach="geometry" /><primitive object={eyeMat} attach="material" /></mesh>
          <mesh position={[0.12, 0.45, 0.35]}><primitive object={eyeGeo} attach="geometry" /><primitive object={eyeMat} attach="material" /></mesh>
        </>
      )}
      {/* Selfie ghost: rainbow halo ring + nametag */}
      {isSelfie && (
        <>
          <mesh position={[0, 0.65, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.5, 0.06, 8, 24]} />
            <primitive object={haloMat} attach="material" />
          </mesh>
          <Html position={[0, 1.1, 0]} center sprite>
            <div style={{
              background: 'linear-gradient(135deg, #ff00cc, #ff6600)',
              color: '#fff',
              fontFamily: '"Comic Sans MS", cursive',
              fontWeight: 900,
              fontSize: '22px',
              padding: '6px 14px',
              borderRadius: '20px',
              border: '3px solid #fff',
              boxShadow: '0 4px 0 rgba(0,0,0,0.4), 0 0 20px rgba(255,0,200,0.8)',
              whiteSpace: 'nowrap',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              letterSpacing: '1px',
              animation: 'none',
            }}>
              👻 {selfieLabel || 'YOU'}
            </div>
          </Html>
        </>
      )}
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

  // ── Monster Selfie state ──────────────────────────────────────────────────
  const [selfiePhase, setSelfiePhase] = useState('idle'); // idle | picker | processing | active | removing
  const [selfieTexture, setSelfieTexture] = useState(null);
  const [selfieLabel, setSelfieLabel] = useState('');
  const [selfieNameInput, setSelfieNameInput] = useState('');
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  const selfieAutoRemoveRef = useRef(null);

  // Face-center crop: squash image into a square centered canvas texture
  const processSelfieImage = (file) => {
    setSelfiePhase('processing');
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      // Cartoon pink ghost border
      ctx.fillStyle = '#ff99dd';
      ctx.beginPath(); ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2); ctx.fill();
      // Crop face: take center square of the image
      const srcSize = Math.min(img.width, img.height);
      const srcX = (img.width - srcSize) / 2;
      const srcY = (img.height - srcSize) * 0.3; // slightly above center to hit face
      ctx.save();
      ctx.beginPath(); ctx.arc(size/2, size/2, size/2 - 8, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, size, size);
      ctx.restore();
      // Cartoon outline ring
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(size/2, size/2, size/2 - 5, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ff00cc'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI * 2); ctx.stroke();
      URL.revokeObjectURL(url);
      setSelfiePreviewUrl(canvas.toDataURL());
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      setSelfieTexture(tex);
      setSelfiePhase('confirm');
    };
    img.src = url;
  };

  const activateSelfie = () => {
    setSelfieLabel(selfieNameInput.trim() || 'YOU');
    setSelfiePhase('active');
    // Auto-remove after 10 minutes
    clearTimeout(selfieAutoRemoveRef.current);
    selfieAutoRemoveRef.current = setTimeout(() => removeSelfie(), 10 * 60 * 1000);
  };

  const removeSelfie = () => {
    setSelfiePhase('removing');
    clearTimeout(selfieAutoRemoveRef.current);
    setTimeout(() => {
      setSelfieTexture(null);
      setSelfieLabel('');
      setSelfieNameInput('');
      setSelfiePreviewUrl(null);
      setSelfiePhase('idle');
    }, 600);
  };

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
    return () => audioManager.softCleanup();
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

      {/* ── Monster Selfie hidden file input ─────────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.[0]) processSelfieImage(e.target.files[0]); }}
      />

      {/* ── Monster Selfie FAB button (idle) ─────────────────────────────── */}
      {visible && selfiePhase === 'idle' && (
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            position: 'fixed', bottom: '30px', right: '110px',
            background: 'linear-gradient(135deg, #ff00cc 0%, #ff6600 100%)',
            border: '3px solid #fff', borderRadius: '50px',
            padding: '12px 22px', cursor: 'pointer', zIndex: 1000,
            fontFamily: '"Comic Sans MS", cursive', fontWeight: 900, fontSize: '1rem',
            color: '#fff', boxShadow: '0 6px 0 rgba(0,0,0,0.4), 0 0 25px rgba(255,0,200,0.7)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            animation: 'selfieButtonPulse 2.5s ease-in-out infinite',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.04)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
        >
          👻 Become a Monster!
        </button>
      )}

      {/* ── Monster Selfie processing spinner ────────────────────────────── */}
      {visible && selfiePhase === 'processing' && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        }}>
          <div style={{ fontSize: '5rem', animation: 'selfieSpinner 0.6s linear infinite' }}>👻</div>
          <div style={{ color: '#fff', fontFamily: '"Comic Sans MS", cursive', fontSize: '1.4rem', marginTop: '1rem' }}>
            Haunting your face...
          </div>
        </div>
      )}

      {/* ── Monster Selfie confirm card ───────────────────────────────────── */}
      {visible && selfiePhase === 'confirm' && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            background: 'linear-gradient(160deg, #1a0028 0%, #0d001f 100%)',
            border: '3px solid #ff00cc', borderRadius: '24px', padding: '32px 36px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
            boxShadow: '0 0 60px rgba(255,0,200,0.4)', maxWidth: '340px', width: '90vw',
          }}>
            <div style={{ fontSize: '2rem', fontFamily: '"Comic Sans MS", cursive', color: '#ff00cc', fontWeight: 900 }}>👻 Monster Selfie!</div>
            <div style={{ position: 'relative' }}>
              <img src={selfiePreviewUrl} alt="Your selfie" style={{
                width: '150px', height: '150px', borderRadius: '50%',
                border: '4px solid #ff00cc', boxShadow: '0 0 30px rgba(255,0,200,0.7)',
              }} />
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                background: '#ff00cc', borderRadius: '50%', width: '38px', height: '38px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
                border: '2px solid #fff',
              }}>👻</div>
            </div>
            <div style={{ color: '#ccc', fontSize: '0.9rem', textAlign: 'center' }}>
              You'll appear as a monster dancing at the party!
            </div>
            <input
              type="text"
              placeholder="Your monster name (or emoji 🎃)"
              value={selfieNameInput}
              maxLength={20}
              onChange={(e) => setSelfieNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') activateSelfie(); }}
              style={{
                width: '100%', padding: '10px 16px', borderRadius: '12px',
                border: '2px solid #ff00cc', background: 'rgba(255,0,200,0.1)',
                color: '#fff', fontSize: '1rem', fontFamily: '"Comic Sans MS", cursive',
                outline: 'none', textAlign: 'center',
              }}
            />
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button
                onClick={() => { setSelfiePhase('idle'); setSelfieTexture(null); setSelfiePreviewUrl(null); }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px', border: '2px solid #666',
                  background: 'rgba(255,255,255,0.08)', color: '#ccc', cursor: 'pointer',
                  fontFamily: '"Comic Sans MS", cursive', fontSize: '0.9rem',
                }}
              >✕ Retake</button>
              <button
                onClick={activateSelfie}
                style={{
                  flex: 2, padding: '12px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #ff00cc, #ff6600)',
                  border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 900,
                  fontFamily: '"Comic Sans MS", cursive', fontSize: '1rem',
                  boxShadow: '0 4px 0 rgba(0,0,0,0.3)',
                }}
              >👻 Join the Party!</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Monster Selfie active controls ───────────────────────────────── */}
      {visible && selfiePhase === 'active' && (
        <div style={{
          position: 'fixed', top: '70px', right: '20px', zIndex: 1000,
          background: 'rgba(10,0,18,0.92)', backdropFilter: 'blur(10px)',
          border: '2px solid #ff00cc', borderRadius: '16px', padding: '12px 18px',
          display: 'flex', alignItems: 'center', gap: '12px',
          boxShadow: '0 0 20px rgba(255,0,200,0.4)', transition: 'opacity 0.6s ease',
          opacity: selfiePhase === 'removing' ? 0 : 1,
        }}>
          <img src={selfiePreviewUrl} alt="selfie" style={{
            width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #ff00cc',
          }} />
          <div style={{ color: '#fff', fontFamily: '"Comic Sans MS", cursive', fontSize: '0.85rem' }}>
            <div style={{ color: '#ff00cc', fontWeight: 900 }}>👻 {selfieLabel}</div>
            <div style={{ color: '#aaa', fontSize: '0.75rem' }}>You're at the party!</div>
          </div>
          <button
            onClick={removeSelfie}
            title="Leave the party"
            style={{
              background: 'rgba(255,0,0,0.2)', border: '1px solid #ff4444', borderRadius: '8px',
              color: '#ff4444', padding: '4px 10px', cursor: 'pointer', fontSize: '0.8rem',
              fontFamily: '"Comic Sans MS", cursive',
            }}
          >Leave 👋</button>
        </div>
      )}
      <Canvas dpr={[1, 1.5]} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, powerPreference: 'high-performance' }} style={{ width: '100%', height: '100%' }}>

        <PerspectiveCamera makeDefault position={[0, 5, 25]} fov={50} />
        <OrbitControls target={[0, 2, -5]} minDistance={5} maxDistance={60} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 2} enablePan={true} />
        <ReadySignal onReady={onReady} />
        
        {/* We reuse evening colors and objects but disable the moving Courage/Ghost animations */}
        <Scene scene="evening" showStory={false} />
        
        {/* The House — the Scene terrain group is at Y:-2, so house offset is -0.2+2=1.8 net.
            We keep house group at Y:-0.2 relative to scene group (which sits at Y:-2 in Scene3D)
            House group local Y needs to be 0 so it sits on the terrain sphere top at Y=-0.5 approx */}
        <group position={[-2.5, 0, 0]}>
           <MemoHouse doorOpen={false} />
           {/* Banner: mounted on the BACK wall of the house (Z negative = behind house from camera).
               Only visible when user orbits to look at the party side. */}
           <TextileBanner position={[0, 4.5, -3.8]} rotation={[0, Math.PI, 0]} />
        </group>
        
        {/* Pumping speakers on the dance floor — lowered to sit on terrain */}
        <Speaker position={[-5, -1.5, -6]} rotation={[0, 0.4, 0]} />
        <Speaker position={[5, -1.5, -6]} rotation={[0, -0.4, 0]} />
        
        {/* Hay stacks flanking the dancing floor */}
        <HayStack position={[-9, -1.5, -10]} rotation={[0, 0.5, 0]} />
        <HayStack position={[-7, -1.5, -4]} rotation={[0, -0.3, 0]} />
        <HayStack position={[8, -1.5, -12]} rotation={[0, -0.6, 0]} />
        <HayStack position={[9, -1.5, -5]} rotation={[0, 0.4, 0]} />

        <StrawGround position={[0, -1.5, -9]} />
        
        {/* 3D Disco Ball hanging above the dance floor */}
        <DiscoBall3D position={[0, 10, -9]} />
        
        {/* Dance floor spotlight directly under Courage */}
        <pointLight position={[0, -1.5, -9.5]} color="#ff00ff" intensity={4} distance={12} />
        
        {/* Courage GIF: sits just above ground level (-1.5 terrain + 0.3 height offset) */}
        <Html position={[0, -1.2, -9.5]} center transform zIndexRange={[100, 0]}>
           <img src={courageDancingGif} alt="Courage Dancing" style={{ width: '220px', filter: 'drop-shadow(0px 10px 10px rgba(0,0,0,0.8))' }} />
        </Html>
        
        {/* Dancing Ghosts — each with a distinct choreography pattern */}
        <DancingGhost position={[-4, -0.5, -10]} offsetTime={0}   patternIdx={0} />
        <DancingGhost position={[4,  -0.5, -10]} offsetTime={1.2} patternIdx={1} />
        <DancingGhost position={[-2, -0.5, -14]} offsetTime={0.5} patternIdx={2} />
        <DancingGhost position={[2,  -0.5, -14]} offsetTime={2.3} patternIdx={3} />
        {/* Ghost 5: reserved for Monster Selfie — only visible when selfie is active */}
        {selfiePhase === 'active' || selfiePhase === 'removing' ? (
          <DancingGhost
            position={[0, -0.5, -12]}
            offsetTime={4.5}
            patternIdx={0}
            selfieTexture={selfieTexture}
            selfieLabel={selfieLabel}
            isSelfie={true}
          />
        ) : (
          <DancingGhost position={[0, -0.5, -6]} offsetTime={3.1} patternIdx={4} />
        )}
        
      </Canvas>
    </div>
  );
}
