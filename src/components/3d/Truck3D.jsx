import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instances, Instance } from '@react-three/drei';
import * as THREE from 'three';

export function Truck({ position = [0, 0, 0], rotation = [0, 0, 0] }) {
  const outerRef = useRef(null);
  const truckRef = useRef(null);
  const time     = useRef(0);

  // Spring entry — matches framer-motion spring { bounce:0.4, duration:1.5, delay:0.5 }
  // k = (2π/1.5)² ≈ 17.5  →  stiffness ≈ 18
  // c = 2*(1-0.4)*√k ≈ 5.02  →  per-frame decay = e^(-5.02/60) ≈ 0.920
  const spring = useRef({ scale: 0, y: 10, vs: 0, vy: 0, elapsed: 0, done: false });

  useFrame((state, delta) => {
    if (truckRef.current) {
      time.current += delta;
      truckRef.current.position.y = Math.sin(time.current * 45) * 0.015;
      truckRef.current.position.x = Math.cos(time.current * 38) * 0.005;
    }
    if (outerRef.current && !spring.current.done) {
      spring.current.elapsed += delta;
      if (spring.current.elapsed < 0.5) return; // 0.5s delay
      const stiffness = 18;
      const damping   = 0.920;
      spring.current.vs += (0.9 - spring.current.scale) * stiffness * delta;
      spring.current.vs *= Math.pow(damping, delta * 60);
      spring.current.scale += spring.current.vs * delta;
      spring.current.vy += (position[1] - spring.current.y) * stiffness * delta;
      spring.current.vy *= Math.pow(damping, delta * 60);
      spring.current.y  += spring.current.vy * delta;
      outerRef.current.scale.setScalar(spring.current.scale);
      outerRef.current.position.y = spring.current.y;
      if (
        Math.abs(0.9 - spring.current.scale) < 0.002 && Math.abs(spring.current.vs) < 0.002 &&
        Math.abs(position[1] - spring.current.y) < 0.01  && Math.abs(spring.current.vy) < 0.01
      ) {
        spring.current.done = true;
        outerRef.current.scale.setScalar(0.9);
        outerRef.current.position.y = position[1];
      }
    }
  });

  const bodyMaterial          = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c4c8d9', roughness: 0.5, metalness: 0.2 }), []);
  const chassisMaterial       = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b2633', roughness: 0.8 }), []);
  const darkGlassMaterial     = useMemo(() => new THREE.MeshStandardMaterial({ color: '#111116', roughness: 0.1, metalness: 0.8 }), []);
  const grillMaterial         = useMemo(() => new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.4 }), []);
  const headlightBeamMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fffb80', emissive: '#ffd438', emissiveIntensity: 1 }), []);
  const woodMaterial          = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ab8d7c', roughness: 0.9 }), []);

  return (
    <group ref={outerRef} position={[position[0], 10, position[2]]} rotation={rotation} scale={0}>
      <group ref={truckRef}>
        {/* Cab */}
        <mesh material={bodyMaterial} position={[0, 1.8, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.8, 1.6, 1.8]} />
        </mesh>
        <mesh material={bodyMaterial} position={[0, 2.65, -0.2]} rotation={[0.1, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.85, 0.1, 1.3]} />
        </mesh>

        {/* Engine Hood */}
        <mesh material={bodyMaterial} position={[0, 1.3, 1.8]} castShadow receiveShadow>
          <boxGeometry args={[1.4, 1.2, 1.8]} />
        </mesh>

        {/* Front Grill Frame */}
        <mesh material={bodyMaterial} position={[0, 1.2, 2.75]} castShadow receiveShadow>
          <boxGeometry args={[1.4, 1.4, 0.1]} />
        </mesh>
        <mesh material={grillMaterial} position={[0, 1.2, 2.81]}>
          <boxGeometry args={[1.1, 1.1, 0.05]} />
        </mesh>

        {/* Fenders Front */}
        <mesh material={bodyMaterial} position={[-1.0, 1.0, 1.8]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.2, 2.2]} />
        </mesh>
        <mesh material={bodyMaterial} position={[1.0, 1.0, 1.8]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.2, 2.2]} />
        </mesh>

        {/* Headlights */}
        <group position={[-1.1, 1.4, 2.6]}>
          <mesh material={bodyMaterial} castShadow>
            <sphereGeometry args={[0.3, 16, 16]} />
          </mesh>
          <mesh material={headlightBeamMaterial} position={[0, 0, 0.25]}>
            <circleGeometry args={[0.22, 16]} />
          </mesh>
          <spotLight position={[0, 0, 0]} target={new THREE.Object3D()} angle={Math.PI / 6} penumbra={0.3} intensity={5} distance={10} color="#ffd438" castShadow />
        </group>
        <group position={[1.1, 1.4, 2.6]}>
          <mesh material={bodyMaterial} castShadow>
            <sphereGeometry args={[0.3, 16, 16]} />
          </mesh>
          <mesh material={headlightBeamMaterial} position={[0, 0, 0.25]}>
            <circleGeometry args={[0.22, 16]} />
          </mesh>
          <spotLight position={[0, 0, 0]} target={new THREE.Object3D()} angle={Math.PI / 6} penumbra={0.3} intensity={5} distance={10} color="#ffd438" castShadow />
        </group>

        {/* Cab Windows */}
        <mesh material={darkGlassMaterial} position={[0, 2.1, 0.91]}>
          <boxGeometry args={[1.5, 0.8, 0.05]} />
        </mesh>
        <mesh material={darkGlassMaterial} position={[-0.91, 2.1, -0.1]}>
          <boxGeometry args={[0.05, 0.8, 1.2]} />
        </mesh>
        <mesh material={darkGlassMaterial} position={[0.91, 2.1, -0.1]}>
          <boxGeometry args={[0.05, 0.8, 1.2]} />
        </mesh>
        <mesh material={darkGlassMaterial} position={[0, 2.1, -0.91]}>
          <boxGeometry args={[1.2, 0.6, 0.05]} />
        </mesh>

        {/* Flatbed Base */}
        <mesh material={chassisMaterial} position={[0, 1.1, -2.5]} castShadow receiveShadow>
          <boxGeometry args={[2.2, 0.2, 3.2]} />
        </mesh>

        {/* Wood Logs/Planks on Bed */}
        <group position={[0, 1.35, -2.5]}>
          <Instances limit={20} material={woodMaterial} castShadow receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            {Array.from({ length: 15 }).map((_, i) => (
              <Instance key={`log-${i}`} position={[(Math.random() - 0.5) * 1.8, Math.random() * 0.5, 0]} rotation={[0, (Math.random() - 0.5) * 0.1, 0]} scale={[0.25, 0.15, 3]} />
            ))}
          </Instances>
        </group>

        {/* Chassis Frame */}
        <mesh material={chassisMaterial} position={[0, 0.7, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 0.2, 6]} />
        </mesh>
      </group>

      {/* Wheels */}
      <mesh material={chassisMaterial} position={[-1.0, 0.65, 2.0]} castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.65, 0.65, 0.4, 24]} />
      </mesh>
      <mesh material={chassisMaterial} position={[1.0, 0.65, 2.0]} castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.65, 0.65, 0.4, 24]} />
      </mesh>
      <mesh material={chassisMaterial} position={[-1.0, 0.65, -3.0]} castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.65, 0.65, 0.4, 24]} />
      </mesh>
      <mesh material={chassisMaterial} position={[1.0, 0.65, -3.0]} castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.65, 0.65, 0.4, 24]} />
      </mesh>
    </group>
  );
}
