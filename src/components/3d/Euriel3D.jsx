import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Euriel({ position = [0, 0, 0], scale = 1, rotation = [0, 0, 0], isWalking = false }) {
  const groupRef = useRef();
  const leftLegRef = useRef();
  const rightLegRef = useRef();
  const leftArmRef = useRef();
  const rightArmRef = useRef();

  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffccaa', roughness: 0.6 }), []);
  const shirtMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff66b2', roughness: 0.8 }), []);
  const pantsMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3366cc', roughness: 0.9 }), []);
  const hairMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#442211', roughness: 0.8 }), []);

  useFrame((state) => {
    if (isWalking && groupRef.current) {
      const t = state.clock.elapsedTime * 8;
      if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(t) * 0.5;
      if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(t + Math.PI) * 0.5;
      if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(t + Math.PI) * 0.5;
      if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t) * 0.5;
      // Bob is applied as a local child offset, NOT overriding group.position.y
      // so NoonStoryController.position.set() always wins
    } else if (groupRef.current) {
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0;
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Head */}
      <mesh position={[0, 3.2, 0]} castShadow>
        <sphereGeometry args={[0.4, 16, 16]} />
        <primitive object={skinMat} attach="material" />
      </mesh>
      {/* Hair (simple bun/ponytail) */}
      <mesh position={[0, 3.5, -0.2]} castShadow>
        <sphereGeometry args={[0.45, 16, 16]} />
        <primitive object={hairMat} attach="material" />
      </mesh>
      {/* Body */}
      <mesh position={[0, 2.2, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.4, 1.2, 16]} />
        <primitive object={shirtMat} attach="material" />
      </mesh>
      {/* Arms */}
      <group position={[-0.45, 2.6, 0]}>
        <mesh ref={leftArmRef} position={[0, -0.4, 0]} castShadow>
          <capsuleGeometry args={[0.12, 0.8, 8, 8]} />
          <primitive object={skinMat} attach="material" />
        </mesh>
      </group>
      <group position={[0.45, 2.6, 0]}>
        <mesh ref={rightArmRef} position={[0, -0.4, 0]} castShadow>
          <capsuleGeometry args={[0.12, 0.8, 8, 8]} />
          <primitive object={skinMat} attach="material" />
        </mesh>
      </group>
      {/* Legs */}
      <group position={[-0.2, 1.4, 0]}>
        <mesh ref={leftLegRef} position={[0, -0.6, 0]} castShadow>
          <capsuleGeometry args={[0.15, 1.2, 8, 8]} />
          <primitive object={pantsMat} attach="material" />
        </mesh>
      </group>
      <group position={[0.2, 1.4, 0]}>
        <mesh ref={rightLegRef} position={[0, -0.6, 0]} castShadow>
          <capsuleGeometry args={[0.15, 1.2, 8, 8]} />
          <primitive object={pantsMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}
