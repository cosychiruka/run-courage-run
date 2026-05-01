import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * NoonCourage3D — a calm, 4-legged dog for the Noon World.
 * Inspired by the cartoon Courage standing upright on the Noon landing page,
 * but rendered as a real dog on all fours when chilling or playing.
 * 
 * mode: 'chill' | 'run' | 'sit'
 */
export function NoonCourage3D({ mode = 'chill' }) {
  const groupRef = useRef();
  const headRef = useRef();
  const tailRef = useRef();
  const frontLeftRef = useRef();
  const frontRightRef = useRef();
  const backLeftRef = useRef();
  const backRightRef = useRef();
  const earLeftRef = useRef();
  const earRightRef = useRef();

  const pinkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f8b4c8', roughness: 0.7 }), []);
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a0a12', roughness: 0.9 }), []);
  const whiteMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.6 }), []);
  const brownMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a3b1e', roughness: 0.8 }), []);
  const eyeWhiteMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }), []);
  const pupilMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#1a0a12' }), []);
  const noseMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5c1a10', roughness: 0.5 }), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    if (mode === 'sit' || mode === 'chill') {
      // Gentle idle breathing bob
      groupRef.current.position.y = Math.sin(t * 1.2) * 0.04;

      // Slow curious head turns — looking at the camera
      if (headRef.current) {
        headRef.current.rotation.y = Math.sin(t * 0.4) * 0.25;
        headRef.current.rotation.z = Math.sin(t * 0.3) * 0.08; // cute head tilt
      }

      // Ears wiggle
      if (earLeftRef.current) earLeftRef.current.rotation.z = 0.3 + Math.sin(t * 2) * 0.1;
      if (earRightRef.current) earRightRef.current.rotation.z = -0.3 - Math.sin(t * 2 + 0.5) * 0.1;

      // Tail wag — friendly
      if (tailRef.current) tailRef.current.rotation.z = Math.sin(t * 4) * 0.5;

      // Legs relaxed — just small sway
      const legSway = Math.sin(t * 1.5) * 0.05;
      if (frontLeftRef.current) frontLeftRef.current.rotation.x = legSway;
      if (frontRightRef.current) frontRightRef.current.rotation.x = -legSway;
      if (backLeftRef.current) backLeftRef.current.rotation.x = -legSway;
      if (backRightRef.current) backRightRef.current.rotation.x = legSway;

    } else if (mode === 'run') {
      // Gallop animation — legs swing in pairs
      const speed = 12;
      groupRef.current.position.y = Math.abs(Math.sin(t * speed * 0.5)) * 0.15;

      if (headRef.current) {
        headRef.current.rotation.x = Math.sin(t * speed * 0.5) * 0.1;
      }
      if (tailRef.current) tailRef.current.rotation.z = Math.sin(t * speed * 0.5) * 0.8;

      // Diagonal pairs: FL+BR swing together, FR+BL swing together
      const gallop = Math.sin(t * speed) * 0.6;
      if (frontLeftRef.current) frontLeftRef.current.rotation.x = gallop;
      if (backRightRef.current) backRightRef.current.rotation.x = gallop;
      if (frontRightRef.current) frontRightRef.current.rotation.x = -gallop;
      if (backLeftRef.current) backLeftRef.current.rotation.x = -gallop;
    }
  });

  // Body dimensions
  const bodyL = 1.0; // length
  const bodyH = 0.45;
  const bodyW = 0.38;

  return (
    <group ref={groupRef}>
      {/* === BODY === */}
      <mesh position={[0, 0, 0]} material={pinkMat} castShadow>
        <capsuleGeometry args={[bodyH * 0.7, bodyL * 0.65, 8, 16]} />
        {/* capsule along Z axis by default; we want X, so rotate */}
      </mesh>
      {/* Use an ellipsoid via scaled sphere for the body */}
      <mesh position={[0, 0, 0]} scale={[bodyL, bodyH, bodyW]} material={pinkMat} castShadow>
        <sphereGeometry args={[0.8, 16, 12]} />
      </mesh>

      {/* === NECK === */}
      <mesh position={[0.52, 0.12, 0]} rotation={[0, 0, -0.5]} material={pinkMat} castShadow>
        <capsuleGeometry args={[0.13, 0.28, 6, 8]} />
      </mesh>

      {/* === HEAD === */}
      <group ref={headRef} position={[0.82, 0.22, 0]}>
        {/* Skull */}
        <mesh material={pinkMat} castShadow>
          <sphereGeometry args={[0.28, 16, 12]} />
        </mesh>
        {/* Snout */}
        <mesh position={[0.22, -0.06, 0]} scale={[1.1, 0.7, 0.85]} material={pinkMat} castShadow>
          <sphereGeometry args={[0.14, 12, 10]} />
        </mesh>
        {/* Nose */}
        <mesh position={[0.34, -0.04, 0]} material={noseMat}>
          <sphereGeometry args={[0.055, 10, 8]} />
        </mesh>

        {/* Eyes */}
        <group position={[0.16, 0.08, 0.14]}>
          <mesh material={eyeWhiteMat}><sphereGeometry args={[0.085, 10, 8]} /></mesh>
          <mesh position={[0.035, 0, 0]} material={pupilMat}><sphereGeometry args={[0.048, 8, 6]} /></mesh>
          {/* Thick cartoon outline on eyes */}
          <mesh material={darkMat} scale={[1.0, 1.1, 1.1]}><sphereGeometry args={[0.1, 10, 8]} /></mesh>
        </group>
        <group position={[0.16, 0.08, -0.14]}>
          <mesh material={eyeWhiteMat}><sphereGeometry args={[0.085, 10, 8]} /></mesh>
          <mesh position={[0.035, 0, 0]} material={pupilMat}><sphereGeometry args={[0.048, 8, 6]} /></mesh>
          <mesh material={darkMat} scale={[1.0, 1.1, 1.1]}><sphereGeometry args={[0.1, 10, 8]} /></mesh>
        </group>

        {/* Ears — long floppy brown ears */}
        <group ref={earLeftRef} position={[-0.08, 0.2, 0.22]} rotation={[0, 0, 0.3]}>
          <mesh material={brownMat} castShadow>
            <capsuleGeometry args={[0.07, 0.32, 4, 8]} />
          </mesh>
        </group>
        <group ref={earRightRef} position={[-0.08, 0.2, -0.22]} rotation={[0, 0, -0.3]}>
          <mesh material={brownMat} castShadow>
            <capsuleGeometry args={[0.07, 0.32, 4, 8]} />
          </mesh>
        </group>
      </group>

      {/* === TAIL === */}
      <group ref={tailRef} position={[-0.72, 0.18, 0]} rotation={[0, 0, 0.5]}>
        <mesh material={pinkMat} castShadow>
          <capsuleGeometry args={[0.06, 0.35, 4, 8]} />
        </mesh>
      </group>

      {/* === LEGS — 4 legs, each anchored to body === */}
      {/* Front Left */}
      <group ref={frontLeftRef} position={[0.35, -0.28, 0.2]}>
        <mesh material={pinkMat} castShadow>
          <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
        </mesh>
        {/* Paw */}
        <mesh position={[0, -0.26, 0]} material={darkMat}><sphereGeometry args={[0.08, 8, 6]} /></mesh>
      </group>
      {/* Front Right */}
      <group ref={frontRightRef} position={[0.35, -0.28, -0.2]}>
        <mesh material={pinkMat} castShadow>
          <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
        </mesh>
        <mesh position={[0, -0.26, 0]} material={darkMat}><sphereGeometry args={[0.08, 8, 6]} /></mesh>
      </group>
      {/* Back Left */}
      <group ref={backLeftRef} position={[-0.38, -0.28, 0.2]}>
        <mesh material={pinkMat} castShadow>
          <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
        </mesh>
        <mesh position={[0, -0.26, 0]} material={darkMat}><sphereGeometry args={[0.08, 8, 6]} /></mesh>
      </group>
      {/* Back Right */}
      <group ref={backRightRef} position={[-0.38, -0.28, -0.2]}>
        <mesh material={pinkMat} castShadow>
          <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
        </mesh>
        <mesh position={[0, -0.26, 0]} material={darkMat}><sphereGeometry args={[0.08, 8, 6]} /></mesh>
      </group>
    </group>
  );
}
