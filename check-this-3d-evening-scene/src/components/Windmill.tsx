import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instances, Instance } from '@react-three/drei';
import { motion } from 'framer-motion-3d';
import * as THREE from 'three';

export function Windmill({ position = [0, 0, 0], rotation = [0, 0, 0] }: { position?: [number, number, number], rotation?: [number, number, number] }) {
  const bladesRef = useRef<THREE.Group>(null);
  
  // Animation: windmill turning
  useFrame((state, delta) => {
    if (bladesRef.current) {
      bladesRef.current.rotation.z -= delta * 0.4;
    }
  });

  const metalMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#443c52', roughness: 0.8, metalness: 0.5 }), []);
  const bladeMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5b4a6b', roughness: 0.7, metalness: 0.2 }), []);

  return (
    <motion.group 
      position={position as any} 
      rotation={rotation as any}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: position[1] || 0, opacity: 1 }}
      transition={{ type: "spring", duration: 2, bounce: 0.3 }}
    >
      {/* Tower Base */}
      <group position={[0, 6, 0]}>
        {/* Legs */}
        {[-1, 1].map((x) => 
          [-1, 1].map((z) => (
            <mesh key={`leg-${x}-${z}`} material={metalMaterial} position={[x * 0.9, 0, z * 0.9]} rotation={[0, 0, x * 0.08]} castShadow>
              {/* Need to adjust rotation for both x and z slope */}
              <cylinderGeometry args={[0.08, 0.15, 12]} />
              <group rotation={[x * 0.08, 0, 0]} />
            </mesh>
          ))
        )}

        {/* Crossbraces */}
        {[-4, -1.5, 1, 3.5].map((y, i) => {
          const w = 1.6 - y * 0.08;
          return (
            <group key={`brace-${i}`} position={[0, y, 0]}>
              <mesh material={metalMaterial} position={[0, 0, w]} rotation={[0, 0, Math.PI/2]}>
                <cylinderGeometry args={[0.04, 0.04, w * 2]} />
              </mesh>
              <mesh material={metalMaterial} position={[0, 0, -w]} rotation={[0, 0, Math.PI/2]}>
                <cylinderGeometry args={[0.04, 0.04, w * 2]} />
              </mesh>
              <mesh material={metalMaterial} position={[w, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.04, 0.04, w * 2]} />
              </mesh>
              <mesh material={metalMaterial} position={[-w, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.04, 0.04, w * 2]} />
              </mesh>
            </group>
          )
        })}
      </group>

      {/* Top Mechanism Hub */}
      <mesh material={metalMaterial} position={[0, 12.2, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 1.2]} rotation={[Math.PI/2, 0, 0]} />
      </mesh>

      {/* Tail Assembly */}
      <group position={[0, 12.2, -1.5]}>
        <mesh material={metalMaterial} position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 2.5]} />
        </mesh>
        <mesh material={metalMaterial} position={[0, 0, -1]}>
          <boxGeometry args={[0.05, 1.8, 1.5]} />
        </mesh>
      </group>

      {/* Blades Assembly */}
      <group ref={bladesRef} position={[0, 12.2, 0.8]} rotation={[0, 0, 0]}>
        <mesh material={metalMaterial} position={[0, 0, 0.2]} rotation={[Math.PI/2, 0, 0]} castShadow>
          <coneGeometry args={[0.4, 0.8, 16]} />
        </mesh>
        
        {/* Generate 16 blades (Optimized with Instances) */}
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

        {/* Generate 16 spokes (Optimized with Instances) */}
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

        {/* Outer Ring */}
        <mesh material={metalMaterial} position={[0, 0, -0.1]} rotation={[Math.PI/2, 0, 0]}>
          <torusGeometry args={[4, 0.04, 8, 32]} />
        </mesh>
        {/* Inner Ring */}
        <mesh material={metalMaterial} position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
          <torusGeometry args={[1.5, 0.04, 8, 16]} />
        </mesh>
      </group>
    </motion.group>
  );
}
