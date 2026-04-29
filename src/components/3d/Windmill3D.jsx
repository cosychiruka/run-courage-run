import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instances, Instance } from '@react-three/drei';
import * as THREE from 'three';

export function Windmill({ position = [0, 0, 0], rotation = [0, 0, 0] }) {
  const bladesRef = useRef(null);
  const groupRef  = useRef(null);

  // Spring entry — matches framer-motion spring { duration:2, bounce:0.3 }
  // k = (2π/2)² ≈ 9.87  →  stiffness ≈ 10
  // c = 2*(1-0.3)*√k ≈ 4.4  →  per-frame decay = e^(-4.4/60) ≈ 0.929
  const spring = useRef({ y: position[1] + 20, vy: 0, done: false });

  useFrame((state, delta) => {
    if (bladesRef.current) {
      bladesRef.current.rotation.z -= delta * 0.4;
    }
    if (groupRef.current && !spring.current.done) {
      spring.current.vy += (position[1] - spring.current.y) * 10 * delta;
      spring.current.vy *= Math.pow(0.929, delta * 60);
      spring.current.y  += spring.current.vy * delta;
      groupRef.current.position.y = spring.current.y;
      if (Math.abs(position[1] - spring.current.y) < 0.01 && Math.abs(spring.current.vy) < 0.01) {
        spring.current.done = true;
        groupRef.current.position.y = position[1];
      }
    }
  });

  const metalMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#443c52', roughness: 0.8, metalness: 0.5 }), []);
  const bladeMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5b4a6b', roughness: 0.7, metalness: 0.2 }), []);

  return (
    <group ref={groupRef} position={[position[0], position[1] + 20, position[2]]} rotation={rotation}>
      {/* Tower Base */}
      <group position={[0, 6, 0]}>
        {[-1, 1].map((x) =>
          [-1, 1].map((z) => (
            <mesh key={`leg-${x}-${z}`} material={metalMaterial} position={[x * 0.9, 0, z * 0.9]} rotation={[0, 0, x * 0.08]} castShadow>
              <cylinderGeometry args={[0.08, 0.15, 12]} />
              <group rotation={[x * 0.08, 0, 0]} />
            </mesh>
          ))
        )}
        {[-4, -1.5, 1, 3.5].map((y, i) => {
          const w = 1.6 - y * 0.08;
          return (
            <group key={`brace-${i}`} position={[0, y, 0]}>
              <mesh material={metalMaterial} position={[0, 0, w]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.04, 0.04, w * 2]} />
              </mesh>
              <mesh material={metalMaterial} position={[0, 0, -w]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.04, 0.04, w * 2]} />
              </mesh>
              <mesh material={metalMaterial} position={[w, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.04, 0.04, w * 2]} />
              </mesh>
              <mesh material={metalMaterial} position={[-w, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.04, 0.04, w * 2]} />
              </mesh>
            </group>
          );
        })}
      </group>

      <mesh material={metalMaterial} position={[0, 12.2, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 1.2]} rotation={[Math.PI / 2, 0, 0]} />
      </mesh>

      <group position={[0, 12.2, -1.5]}>
        <mesh material={metalMaterial} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 2.5]} />
        </mesh>
        <mesh material={metalMaterial} position={[0, 0, -1]}>
          <boxGeometry args={[0.05, 1.8, 1.5]} />
        </mesh>
      </group>

      <group ref={bladesRef} position={[0, 12.2, 0.8]}>
        <mesh material={metalMaterial} position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.4, 0.8, 16]} />
        </mesh>

        <Instances limit={20} material={bladeMaterial} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i / 16) * Math.PI * 2;
            return (
              <group key={`blade-panel-${i}`} rotation={[0, 0, angle]}>
                <Instance position={[0, 2.5, 0]} rotation={[0.3, 0, 0]} scale={[0.8, 3.5, 0.05]} />
              </group>
            );
          })}
        </Instances>

        <Instances limit={20} material={metalMaterial}>
          <cylinderGeometry args={[1, 1, 1, 8]} />
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i / 16) * Math.PI * 2;
            return (
              <group key={`blade-spoke-${i}`} rotation={[0, 0, angle]}>
                <Instance position={[0, 1, 0]} scale={[0.03, 0.03, 2]} />
              </group>
            );
          })}
        </Instances>

        <mesh material={metalMaterial} position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[4, 0.04, 8, 32]} />
        </mesh>
        <mesh material={metalMaterial} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.5, 0.04, 8, 16]} />
        </mesh>
      </group>
    </group>
  );
}
