import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html, SpotLight } from '@react-three/drei';
import * as THREE from 'three';
import { Scene } from './Scene3D';
import { House } from './House3D';
import { audioManager } from '../../utils/audioManager';
import courageDancingGif from '../../assets/images/Courage.gif';
import { useSelfie } from '../../hooks/useSelfie';
import SelfieUI from '../SelfieUI';
import WorldVoiceButton from '../WorldVoiceButton';
import WorldEventBanner from '../WorldEventBanner';
import { useWorldEvents, registerPresence } from '../../hooks/useWorldEvents';
import { captureAndShareSelfie } from '../../utils/screenshotUtils';

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

// Module-level mutable speed ref — updated by event without triggering re-render
const _discoSpeedMult = { current: 1.0 };

function DancingGhost({ position, offsetTime = 0, patternIdx = 0, selfieTexture = null, selfieLabel = '', selfiePreviewUrl = null, isSelfie = false }) {
  const groupRef = useRef(null);
  const ghostMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#ffffff', emissive: '#d7d4ff', emissiveIntensity: 0.8,
    transparent: true, opacity: isSelfie ? 0.95 : 0.85, roughness: 0.8
  }), [isSelfie]);
  const selfieMat = useMemo(() => selfieTexture
    ? new THREE.MeshBasicMaterial({ map: selfieTexture })
    : null,
  [selfieTexture]);
  const haloMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff00ff', wireframe: true }), []);
  const eyeGeo = useMemo(() => new THREE.CircleGeometry(0.08, 16), []);
  const eyeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#111122' }), []);
  const basePos = useMemo(() => [...position], [position]);
  const scale = isSelfie ? 1.35 : 1.0;

  useFrame((state) => {
    if (!groupRef.current) return;
    // speed driven by LLM disco event
    const speed = _discoSpeedMult.current;
    const t = state.clock.elapsedTime * speed + offsetTime;
    const pattern = DANCE_PATTERNS[patternIdx % DANCE_PATTERNS.length](t, basePos);
    const yBob = basePos[1] + Math.sin(t * 3 + offsetTime) * 0.25 + 0.1;
    groupRef.current.position.set(pattern.x, yBob, pattern.z);
    groupRef.current.rotation.y = pattern.ry;
    const sy = speed === 0 ? 1 : pattern.scaleY;
    groupRef.current.scale.set(
      scale / Math.sqrt(sy),
      scale * sy,
      scale / Math.sqrt(sy)
    );
    if (!isSelfie) {
      const hue = ((state.clock.elapsedTime * 0.15 + patternIdx * 0.2) % 1);
      ghostMat.emissive.setHSL(hue, 0.6, 0.5);
      ghostMat.emissiveIntensity = 0.6 + Math.sin(t * 6) * 0.3;
    } else {
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
        <primitive object={ghostMat} attach="material" />
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
      {/* Selfie ghost: large face sphere above dome + rainbow halo + nametag */}
      {isSelfie && (
        <>
          {/* Selfie face sphere — clearly visible above the ghost dome */}
          <mesh position={[0, 0.85, 0]}>
            <sphereGeometry args={[0.55, 16, 16]} />
            {selfieMat
              ? <primitive object={selfieMat} attach="material" />
              : <primitive object={ghostMat} attach="material" />}
          </mesh>
          {/* Photo overlay — same technique as Courage HTML/CSS in 3D scene */}
          {selfiePreviewUrl && (
            <Html position={[0, 0.85, 0]} center sprite occlude={false}>
              <img
                src={selfiePreviewUrl}
                alt=""
                style={{
                  width: '110px', height: '110px',
                  borderRadius: '50%', objectFit: 'cover',
                  border: '5px solid #fff',
                  boxShadow: '0 0 20px rgba(255,0,200,0.9)',
                  pointerEvents: 'none',
                }}
              />
            </Html>
          )}
          {/* Rainbow halo ring around the face */}
          <mesh position={[0, 0.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.68, 0.07, 8, 24]} />
            <primitive object={haloMat} attach="material" />
          </mesh>
          {/* Nametag — far enough above face to not overlap */}
          <Html position={[0, 1.7, 0]} center sprite>
            <div style={{
              background: 'linear-gradient(135deg, #ff00cc, #ff6600)',
              color: '#fff',
              fontFamily: '"Comic Sans MS", cursive',
              fontWeight: 900,
              fontSize: '20px',
              padding: '6px 14px',
              borderRadius: '20px',
              border: '3px solid #fff',
              boxShadow: '0 4px 0 rgba(0,0,0,0.4), 0 0 20px rgba(255,0,200,0.8)',
              whiteSpace: 'nowrap',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              letterSpacing: '1px',
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

  const selfie = useSelfie();
  const canvasRef = useRef(null);

  const { event, clearEvent, presenceCount } = useWorldEvents({
    world: 'disco',
    active: visible,
    state: { ghost_count: 5, elapsed: 0, current_track: DISCO_TRACKS[currentTrackIdx]?.title ?? '' },
    intervalMs: 25_000,
  });

  // Presence heartbeat when selfie is active
  useEffect(() => {
    if (!selfie.isActive) return;
    const uid = `disco_${Date.now()}`;
    registerPresence({ world: 'disco', uid, name: selfie.label, emoji: '👻' });
    const hb = setInterval(() =>
      registerPresence({ world: 'disco', uid, name: selfie.label, emoji: '👻' }),
    120_000);
    return () => clearInterval(hb);
  }, [selfie.isActive, selfie.label]);

  // Wire LLM event actions to ghost animation speed
  useEffect(() => {
    if (!event) return;
    const SPEED_MAP = {
      ghost_frenzy:  2.2,
      speed_up:      1.6,
      slow_down:     0.45,
      freeze_frame:  0.0,
      lights_out:    1.0,
      color_shift:   1.0,
      dj_shoutout:   1.0,
    };
    const mult = SPEED_MAP[event.action] ?? 1.0;
    _discoSpeedMult.current = mult;
    const restore = setTimeout(() => { _discoSpeedMult.current = 1.0; }, 9_000);
    return () => clearTimeout(restore);
  }, [event]);

  // Reset speed to normal when world is hidden — prevents stale frenzy speed on re-entry
  useEffect(() => {
    if (!visible) _discoSpeedMult.current = 1.0;
  }, [visible]);

  // Screenshot → share on X (Web Share API on mobile, download + intent on desktop)
  const handleScreenshot = useCallback(() => {
    captureAndShareSelfie({
      previewUrl: selfie.previewUrl,
      label: selfie.label,
      worldName: 'Nowhere High School Disco',
      monsterEmoji: '👻',
      tweetText: `👻 I became a Monster at the Nowhere High School Disco with @runcouragerun! #CourageRunRun #MonsterSelfie #Web3`,
    });
  }, [selfie.previewUrl, selfie.label]);

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
    if (!(visible && audioLoaded)) return;
    let cancelled = false;
    const track = DISCO_TRACKS[currentTrackIdx];
    const playNext = async () => {
      await audioManager.loadTrack(track.id, track.url);
      if (cancelled) return;
      if (isPlaying) {
        await audioManager.playTrack(track.id, {
          loop: false,
          volume: 0.5,
          onEnded: () => setCurrentTrackIdx(i => (i + 1) % DISCO_TRACKS.length),
        });
      } else {
        audioManager.stopAllTracks();
      }
    };
    playNext();
    return () => { cancelled = true; audioManager.softCleanup(); };
  }, [visible, audioLoaded, currentTrackIdx, isPlaying]);

  return (
    <div className="world3d-overlay" style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'all' : 'none', transition: 'opacity 0.8s ease', zIndex: 9999 }}>
      {visible && <button className="world3d-close" onClick={onClose} aria-label="Exit 3D World">✕ Exit</button>}
      {visible && <div className="world3d-hint">drag to orbit &nbsp;·&nbsp; scroll to zoom</div>}
      
      {/* Disco Music Player Overlay — centered horizontally */}
      {visible && (
         <div className="disco-music-panel">
            <div style={{ fontSize: '2rem' }}>💿</div>
            <div className="disco-music-info">
               <span className="disco-music-label">DJ Courage's Playlist</span>
               <span className="disco-music-title">{DISCO_TRACKS[currentTrackIdx].title}</span>
            </div>
            <div className="disco-music-controls">
               <button className="disco-music-btn" onClick={() => setIsPlaying(!isPlaying)}>
                  {isPlaying ? '⏸' : '▶️'}
               </button>
               <button className="disco-music-btn" onClick={() => setCurrentTrackIdx(i => (i + 1) % DISCO_TRACKS.length)}>
                  ⏭
               </button>
            </div>
         </div>
      )}

      <SelfieUI
        selfie={selfie}
        visible={visible}
        worldName="Nowhere High School Disco"
        monsterName="Monster"
        monsterEmoji="👻"
        onScreenshot={handleScreenshot}
      />
      <WorldEventBanner event={event} world="disco" onDismiss={clearEvent} />
      {visible && presenceCount > 0 && (
        <div className="world-presence-badge">
          <span className="presence-dot" />
          {presenceCount} monster{presenceCount !== 1 ? 's' : ''} in the party
        </div>
      )}
      <WorldVoiceButton worldContext="disco" visible={visible} />
      <Canvas
        frameloop={visible ? 'always' : 'demand'}
        dpr={[1, 1.5]}
        gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl }) => { canvasRef.current = gl; }}
      >

        <PerspectiveCamera makeDefault position={[0, 5, 25]} fov={50} />
        <OrbitControls target={[0, 2, -5]} minDistance={5} maxDistance={60} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 2} enablePan={true} />
        <ReadySignal onReady={onReady} />
        
        {/* We reuse evening colors and objects but disable the moving Courage/Ghost animations */}
        <Scene scene="evening" showStory={false} />
        
        {/* The House — the Scene terrain group is at Y:-2, so house offset is -0.2+2=1.8 net.
            We keep house group at Y:-0.2 relative to scene group (which sits at Y:-2 in Scene3D)
            House group local Y needs to be 0 so it sits on the terrain sphere top at Y=-0.5 approx */}
        <group position={[-2.5, -1.5, 0]}>
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
        {selfie.isActive ? (
          <DancingGhost
            position={[0, -0.5, -12]}
            offsetTime={4.5}
            patternIdx={0}
            selfieTexture={selfie.texture}
            selfieLabel={selfie.label}
            selfiePreviewUrl={selfie.previewUrl}
            isSelfie={true}
          />
        ) : (
          <DancingGhost position={[0, -0.5, -6]} offsetTime={3.1} patternIdx={4} />
        )}
        
      </Canvas>
    </div>
  );
}
