import React, { useMemo, useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Instances, Instance, Html } from '@react-three/drei';
import pumpfunPng from '../../assets/images/pump-fun-seeklogo.png';

function Window({ position, rotation = [0, 0, 0], scale = 1 }) {
  const windowMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fffb80', emissive: '#ffb52e', emissiveIntensity: 2.5 }), []);
  const frameMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a1025', roughness: 0.8 }), []);
  
  const width = 1 * scale;
  const height = 1.3 * scale;

  return (
    <group position={position} rotation={rotation}>
      <mesh material={windowMaterial} position={[0, 0, 0]}>
        <planeGeometry args={[width, height]} />
      </mesh>
      <mesh material={frameMaterial} position={[0, 0, 0.02]}>
        <boxGeometry args={[width + 0.1, 0.1, 0.1]} position={[0, height/2, 0]} />
      </mesh>
      <mesh material={frameMaterial} position={[0, 0, 0.02]}>
        <boxGeometry args={[width + 0.1, 0.1, 0.1]} position={[0, -height/2, 0]} />
      </mesh>
      <mesh material={frameMaterial} position={[0, 0, 0.02]}>
        <boxGeometry args={[0.1, height + 0.1, 0.1]} position={[-width/2, 0, 0]} />
      </mesh>
      <mesh material={frameMaterial} position={[0, 0, 0.02]}>
        <boxGeometry args={[0.1, height + 0.1, 0.1]} position={[width/2, 0, 0]} />
      </mesh>
      <mesh material={frameMaterial} position={[0, 0, 0.02]}>
        <boxGeometry args={[0.08, height, 0.06]} />
      </mesh>
      <mesh material={frameMaterial} position={[0, 0, 0.02]}>
        <boxGeometry args={[width, 0.08, 0.06]} />
      </mesh>
      <spotLight position={[0, 0, -0.2]} target={new THREE.Object3D()} angle={Math.PI/3} penumbra={0.6} intensity={25 * scale} distance={15} color="#ffd438" castShadow />
    </group>
  );
}

// Optimized WoodPlanks with pre-calculated static positions to prevent re-render hitches
const MemoWoodPlanks = React.memo(({ positions }) => {
  const woodMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a62bf', roughness: 0.9, flatShading: true }), []);
  return (
    <Instances limit={1000} material={woodMaterial} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      {positions.map((p, i) => (
        <Instance key={i} position={p.pos} rotation={p.rot} scale={p.scale} />
      ))}
    </Instances>
  );
});

const MemoRoofPlanks = React.memo(({ positions }) => {
  const roofMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#664a8a', roughness: 0.9, flatShading: true }), []);
  return (
    <Instances limit={1000} material={roofMaterial} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      {positions.map((p, i) => (
        <Instance key={i} position={p.pos} rotation={p.rot} scale={p.scale} />
      ))}
    </Instances>
  );
});

export function House({ position = [0, 0, 0], rotation = [0, 0, 0], doorOpen = false }) {
  const woodMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a62bf', roughness: 0.9, flatShading: true }), []);
  const doorMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#160d1f', roughness: 0.8 }), []);
  const windowMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fffb80', emissive: '#ffb52e', emissiveIntensity: 2.5 }), []);
  const brassMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffb52e', roughness: 0.3, metalness: 0.8 }), []);

  const [glitchMode, setGlitchMode] = useState(false);
  const [glitching, setGlitching] = useState(false);
  const [hasVisited, setHasVisited] = useState(() => localStorage.getItem('courage_visited_pumpfun') === 'true');
  const glitchRef = useRef(null);
  useEffect(() => {
    const cycle = () => {
      // Trigger glitch flash
      setGlitching(true);
      setTimeout(() => {
        setGlitchMode(m => !m);
        setGlitching(false);
      }, 280);
      // Next cycle: show logo 8-14s, then Nowhere 4-7s
      const delay = glitchMode ? 4000 + Math.random() * 3000 : 8000 + Math.random() * 6000;
      glitchRef.current = setTimeout(cycle, delay);
    };
    glitchRef.current = setTimeout(cycle, 10000);
    return () => clearTimeout(glitchRef.current);
  }, [glitchMode]);
  
  const chimneyCurve = useMemo(() => {
    class CustomCurve extends THREE.Curve {
      getPoint(t, optionalTarget = new THREE.Vector3()) {
        const x = Math.sin(t * Math.PI * 4) * 0.3 * (1 - t);
        const y = t * 3;
        const z = Math.cos(t * Math.PI * 2) * 0.2 * (1 - t);
        return optionalTarget.set(x, y, z);
      }
    }
    return new CustomCurve();
  }, []);

  // Pre-calculate all plank positions ONCE to prevent CPU hitches during phase transitions
  const woodPositions = useMemo(() => {
    const data = [];
    // Front Wall
    for (let i = 0; i < 45; i++) {
      const y = i * 0.2 + 0.1;
      const width = y <= 5 ? 8 : 8 - (y - 5) * 2;
      if (width > 0) {
        data.push({
          pos: [(Math.random() - 0.5) * 0.1, y + (Math.random() - 0.5) * 0.02, 2 + (Math.random() - 0.5) * 0.04],
          rot: [0, 0, (Math.random() - 0.5) * 0.02],
          scale: [width + (Math.random() * 0.2), 0.18, 0.2]
        });
      }
    }
    // Left Wall
    for (let i = 0; i < 25; i++) {
      data.push({
        pos: [-3.9 + (Math.random() - 0.5) * 0.1, i * 0.2 + 0.1 + (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.04],
        rot: [0, Math.PI / 2, (Math.random() - 0.5) * 0.02],
        scale: [4.2 + (Math.random() * 0.3), 0.18, 0.2]
      });
    }
    // Right Wall
    for (let i = 0; i < 25; i++) {
      data.push({
        pos: [3.9 + (Math.random() - 0.5) * 0.1, i * 0.2 + 0.1 + (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.04],
        rot: [0, Math.PI / 2, (Math.random() - 0.5) * 0.02],
        scale: [4.2 + (Math.random() * 0.3), 0.18, 0.2]
      });
    }
    // Back Wall
    data.push({ pos: [0, 2.5, -2], rot: [0, 0, 0], scale: [8, 5, 0.2] });
    // Porch Base
    data.push({ pos: [0, 0.3, 3.5], rot: [0, 0, 0], scale: [8.5, 0.6, 2.8] });
    // Pillars
    [-3.8, -1.8, 0.2, 3.8].forEach(x => {
      data.push({ pos: [x, 1.8, 4.6], rot: [0, 0, 0], scale: [0.15, 3, 0.15] });
    });
    return data;
  }, []);

  const roofPositions = useMemo(() => {
    const data = [];
    // Left Slope
    for (let i = 0; i < 30; i++) {
      data.push({
        pos: [-2.3 + (i * 0.22 - 3) * Math.cos(0.75), 5 + 2.2 + (i * 0.22 - 3) * Math.sin(0.75), 0.5 + (Math.random() - 0.5) * 0.1],
        rot: [0, (Math.random() - 0.5) * 0.03, 0.75],
        scale: [0.25, 0.1, 5.8 + Math.random() * 0.2]
      });
    }
    // Right Slope
    for (let i = 0; i < 30; i++) {
      data.push({
        pos: [2.3 + (-i * 0.22 + 3) * Math.cos(-0.75), 5 + 2.2 + (-i * 0.22 + 3) * Math.sin(-0.75), 0.5 + (Math.random() - 0.5) * 0.1],
        rot: [0, (Math.random() - 0.5) * 0.03, -0.75],
        scale: [0.25, 0.1, 5.8 + Math.random() * 0.2]
      });
    }
    // Porch Roof
    for (let i = 0; i < 15; i++) {
      data.push({
        pos: [0, 3.2, 3.5 + i * 0.22 - 1.5],
        rot: [-0.3, 0, 0],
        scale: [8.6, 0.1, 0.25]
      });
    }
    return data;
  }, []);

  return (
    <group position={position} rotation={rotation}>
      <MemoWoodPlanks positions={woodPositions} />
      
      <mesh material={woodMaterial} position={[0, 6.5, -2]} castShadow receiveShadow>
        <coneGeometry args={[4.5, 3, 4]} />
      </mesh>

      <MemoRoofPlanks positions={roofPositions} />

      <group position={[-0.8, 1.5, 2.15]}>
        <mesh material={doorMaterial}>
          <boxGeometry args={[1.4, 2.5, 0.05]} />
        </mesh>
        <group position={[-0.6, 0, 0]} rotation={[0, doorOpen ? -Math.PI / 1.5 : 0, 0]}>
          <group position={[0.6, 0, 0]}>
            <mesh material={doorMaterial} position={[0, -0.6, 0.03]}>
              <boxGeometry args={[1.1, 1.0, 0.05]} />
            </mesh>
            <mesh material={windowMaterial} position={[0, 0.5, 0.03]}>
              <planeGeometry args={[1.0, 1.0]} />
            </mesh>
            <mesh material={doorMaterial} position={[0, 0.5, 0.05]}>
              <boxGeometry args={[0.08, 1.0, 0.05]} />
            </mesh>
            <mesh material={doorMaterial} position={[0, 0.5, 0.05]}>
              <boxGeometry args={[1.0, 0.08, 0.05]} />
            </mesh>
            <mesh material={brassMaterial} position={[0.4, -0.1, 0.08]}>
              <sphereGeometry args={[0.08, 8, 8]} />
            </mesh>
          </group>
        </group>
      </group>
      
      <Window position={[-2.6, 1.6, 2.15]} />
      <Window position={[2.0, 1.6, 2.15]} />
      <Window position={[-1.2, 4.5, 2.15]} scale={0.8} />
      <Window position={[1.2, 4.5, 2.15]} scale={0.8} />
      <Window position={[0, 7.0, 2.15]} scale={0.5} />

      {/* PumpFun / Nowhere sign on front gable — Html overlay for click + glitch */}
      <Html 
        position={[0, 8.2, 2.4]} 
        center 
        occlude={false} 
        zIndexRange={[0, 10]}
        transform
        scale={0.08}
      >
        <a
          href="https://pump.fun/coin/$RCR"
          target="_blank"
          rel="noopener noreferrer"
          title="Buy $RCR on pump.fun"
          onClick={() => {
            localStorage.setItem('courage_visited_pumpfun', 'true');
            setHasVisited(true);
          }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            background: glitching
              ? 'rgba(0,255,136,0.9)'
              : 'rgba(10,5,20,0.88)',
            border: `2px solid ${glitchMode ? (hasVisited ? '#ff80d5' : '#aaffcc') : (hasVisited ? '#eb57c1' : '#00ff88')}`,
            borderRadius: '10px',
            padding: '5px 10px',
            cursor: 'pointer',
            textDecoration: 'none',
            minWidth: '130px',
            textAlign: 'center',
            boxShadow: glitching
              ? '0 0 18px 6px #00ff88, 0 0 40px 10px #00ffaa'
              : `0 0 8px ${hasVisited ? 'rgba(235,87,193,0.4)' : 'rgba(0,255,136,0.4)'}`,
            transition: 'all 0.2s',
            filter: glitching ? 'hue-rotate(180deg) brightness(2)' : 'none',
            userSelect: 'none',
          }}
        >
          {glitchMode ? (
            <span style={{ 
              fontSize: '22px', 
              fontWeight: 900, 
              fontFamily: 'Arial Black, Arial', 
              color: hasVisited ? '#ff80d5' : '#aaffcc', 
              letterSpacing: '0.5px', 
              lineHeight: 1.1 
            }}>
              📍 NoWhere
            </span>
          ) : (
            <>
              <img src={pumpfunPng} alt="pump.fun" style={{ width: '36px', height: '36px', objectFit: 'contain', display: 'block' }} />
              <span style={{ 
                fontSize: '11px', 
                fontWeight: 700, 
                color: hasVisited ? '#eb57c1' : '#00ff88', 
                fontFamily: 'Arial, sans-serif', 
                letterSpacing: '0.5px' 
              }}>
                pump.fun
              </span>
            </>
          )}
        </a>
      </Html>
      
      <pointLight position={[0, 2.5, 3.5]} intensity={5.5} distance={20} decay={2} color="#ffaa00" />

      <mesh position={[2, 7, 0.5]} castShadow>
        <tubeGeometry args={[chimneyCurve, 12, 0.12, 8, false]} />
        <meshStandardMaterial color="#443" roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh position={[2, 10, 0.5]} castShadow>
        <coneGeometry args={[0.3, 0.4, 8]} />
        <meshStandardMaterial color="#332" roughness={0.8} />
      </mesh>
    </group>
  );
}
