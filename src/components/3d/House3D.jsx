import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Instances, Instance } from '@react-three/drei';

function Window({ position, rotation = [0, 0, 0], scale = 1 }) {
  const windowMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fffb80', emissive: '#ffb52e', emissiveIntensity: 2.5 }), []);
  const frameMaterial  = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a1025', roughness: 0.8 }), []);

  const width  = 1 * scale;
  const height = 1.3 * scale;

  return (
    <group position={position} rotation={rotation}>
      {/* Glowing pane */}
      <mesh material={windowMaterial}>
        <planeGeometry args={[width, height]} />
      </mesh>
      {/* Frame top */}
      <mesh material={frameMaterial} position={[0, height / 2, 0.02]}>
        <boxGeometry args={[width + 0.1, 0.1, 0.1]} />
      </mesh>
      {/* Frame bottom */}
      <mesh material={frameMaterial} position={[0, -height / 2, 0.02]}>
        <boxGeometry args={[width + 0.1, 0.1, 0.1]} />
      </mesh>
      {/* Frame left */}
      <mesh material={frameMaterial} position={[-width / 2, 0, 0.02]}>
        <boxGeometry args={[0.1, height + 0.1, 0.1]} />
      </mesh>
      {/* Frame right */}
      <mesh material={frameMaterial} position={[width / 2, 0, 0.02]}>
        <boxGeometry args={[0.1, height + 0.1, 0.1]} />
      </mesh>
      {/* Cross bars */}
      <mesh material={frameMaterial} position={[0, 0, 0.02]}>
        <boxGeometry args={[0.08, height, 0.06]} />
      </mesh>
      <mesh material={frameMaterial} position={[0, 0, 0.02]}>
        <boxGeometry args={[width, 0.08, 0.06]} />
      </mesh>
      {/* Window light */}
      <spotLight position={[0, 0, -0.2]} angle={Math.PI / 3} penumbra={0.6} intensity={25 * scale} distance={15} color="#ffd438" castShadow />
    </group>
  );
}

function WoodPlanks({ children }) {
  const woodMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a62bf', roughness: 0.9, flatShading: true }), []);
  return (
    <Instances limit={1000} material={woodMaterial} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      {children}
    </Instances>
  );
}

function RoofPlanks({ children }) {
  const roofMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#664a8a', roughness: 0.9, flatShading: true }), []);
  return (
    <Instances limit={1000} material={roofMaterial} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      {children}
    </Instances>
  );
}

export function House({ position = [0, 0, 0], rotation = [0, 0, 0], doorOpen = false }) {
  const woodMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a62bf', roughness: 0.9, flatShading: true }), []);
  const doorMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#160d1f', roughness: 0.8 }), []);
  const winMaterial  = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fffb80', emissive: '#ffb52e', emissiveIntensity: 2.5 }), []);
  const brassMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffb52e', roughness: 0.3, metalness: 0.8 }), []);

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

  return (
    <group position={position} rotation={rotation}>
      <WoodPlanks>
        {/* Front Gable Wall */}
        <group position={[0, 0, 2]}>
          {Array.from({ length: 45 }).map((_, i) => {
            const y = i * 0.2 + 0.1;
            const width = y <= 5 ? 8 : 8 - (y - 5) * 2;
            if (width <= 0) return null;
            return (
              <Instance
                key={`fw-${i}`}
                position={[(Math.random() - 0.5) * 0.1, y + (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.04]}
                rotation={[0, 0, (Math.random() - 0.5) * 0.02]}
                scale={[width + Math.random() * 0.2, 0.18, 0.2]}
              />
            );
          })}
        </group>
        {/* Left Side Wall */}
        <group position={[-3.9, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          {Array.from({ length: 25 }).map((_, i) => (
            <Instance
              key={`ls-${i}`}
              position={[(Math.random() - 0.5) * 0.1, i * 0.2 + 0.1 + (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.04]}
              rotation={[0, 0, (Math.random() - 0.5) * 0.02]}
              scale={[4.2 + Math.random() * 0.3, 0.18, 0.2]}
            />
          ))}
        </group>
        {/* Right Side Wall */}
        <group position={[3.9, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          {Array.from({ length: 25 }).map((_, i) => (
            <Instance
              key={`rs-${i}`}
              position={[(Math.random() - 0.5) * 0.1, i * 0.2 + 0.1 + (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.04]}
              rotation={[0, 0, (Math.random() - 0.5) * 0.02]}
              scale={[4.2 + Math.random() * 0.3, 0.18, 0.2]}
            />
          ))}
        </group>
        {/* Back Wall */}
        <Instance position={[0, 2.5, -2]} scale={[8, 5, 0.2]} />
        {/* Porch Floor */}
        <Instance position={[0, 0.3, 3.5]} scale={[8.5, 0.6, 2.8]} />
        {/* Porch Pillars */}
        {[-3.8, -1.8, 0.2, 3.8].map((x, i) => (
          <Instance key={`pillar-${i}`} position={[x, 1.8, 4.6]} scale={[0.15, 3, 0.15]} />
        ))}
      </WoodPlanks>

      {/* Back gable cone */}
      <mesh material={woodMaterial} position={[0, 6.5, -2]} castShadow receiveShadow>
        <coneGeometry args={[4.5, 3, 4]} />
      </mesh>

      <RoofPlanks>
        <group position={[0, 5, 0]}>
          <group position={[-2.3, 2.2, 0.5]} rotation={[0, 0, 0.75]}>
            {Array.from({ length: 30 }).map((_, i) => (
              <Instance key={`lr-${i}`} position={[i * 0.22 - 3, 0, (Math.random() - 0.5) * 0.1]} rotation={[0, (Math.random() - 0.5) * 0.03, 0]} scale={[0.25, 0.1, 5.8 + Math.random() * 0.2]} />
            ))}
          </group>
          <group position={[2.3, 2.2, 0.5]} rotation={[0, 0, -0.75]}>
            {Array.from({ length: 30 }).map((_, i) => (
              <Instance key={`rr-${i}`} position={[-i * 0.22 + 3, 0, (Math.random() - 0.5) * 0.1]} rotation={[0, (Math.random() - 0.5) * 0.03, 0]} scale={[0.25, 0.1, 5.8 + Math.random() * 0.2]} />
            ))}
          </group>
        </group>
        <group position={[0, 3.2, 3.5]} rotation={[-0.3, 0, 0]}>
          {Array.from({ length: 15 }).map((_, i) => (
            <Instance key={`pr-${i}`} position={[0, 0, i * 0.22 - 1.5]} scale={[8.6, 0.1, 0.25]} />
          ))}
        </group>
      </RoofPlanks>

      {/* Door */}
      <group position={[-0.8, 1.5, 2.15]}>
        <mesh material={doorMaterial}>
          <boxGeometry args={[1.4, 2.5, 0.05]} />
        </mesh>
        <group position={[-0.6, 0, 0]} rotation={[0, doorOpen ? -Math.PI / 1.5 : 0, 0]}>
          <group position={[0.6, 0, 0]}>
            <mesh material={doorMaterial} position={[0, -0.6, 0.03]}>
              <boxGeometry args={[1.1, 1.0, 0.05]} />
            </mesh>
            <mesh material={winMaterial} position={[0, 0.5, 0.03]}>
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

      {/* Windows */}
      <Window position={[-2.6, 1.6, 2.15]} />
      <Window position={[2.0, 1.6, 2.15]} />
      <Window position={[-1.2, 4.5, 2.15]} scale={0.8} />
      <Window position={[1.2, 4.5, 2.15]} scale={0.8} />
      <Window position={[0, 7.0, 2.15]} scale={0.5} />

      {/* Porch light */}
      <pointLight position={[0, 2.5, 3.5]} intensity={5.5} distance={20} decay={2} color="#ffaa00" />

      {/* Chimney */}
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
