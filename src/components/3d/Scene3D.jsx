import React, { useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { House } from './House3D';
import { Truck } from './Truck3D';
import { Windmill } from './Windmill3D';
import { Terrain } from './Terrain3D';
import CourageRunningAnimationComplete from './CourageRunningAnimationComplete';

function Ghost({ courageRef, offsetTime = 0, offsetPosition = [0, 0, 0] }) {
  const groupRef = useRef(null);

  const ghostMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#d7d4ff',
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.85,
    roughness: 0.8,
  }), []);

  const eyeGeo = useMemo(() => new THREE.CircleGeometry(0.08, 16), []);
  const eyeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#111122' }), []);
  const scratchVec1 = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!groupRef.current || !courageRef.current) return;
    const t = state.clock.elapsedTime % 30;
    let dX = 0, dY = 0, dZ = 0;
    if (t > 28) {
      const dt = t - 28;
      dX = offsetPosition[0] * dt * 15;
      dY = dt * 10;
      dZ = offsetPosition[2] * dt * 15;
    }
    const targetX = courageRef.current.position.x + offsetPosition[0] + Math.sin(state.clock.elapsedTime * 2 + offsetTime * 2) * 0.5 + dX;
    const targetY = 1 + offsetPosition[1] + Math.sin(state.clock.elapsedTime * 4 + offsetTime) * 0.6 + dY;
    const targetZ = courageRef.current.position.z + offsetPosition[2] + dZ;
    groupRef.current.position.lerp(scratchVec1.set(targetX, targetY, targetZ), 0.1);
    groupRef.current.lookAt(state.camera.position);
  });

  return (
    <group ref={groupRef}>
      <pointLight color="#d7d4ff" intensity={1.5} distance={8} />
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <primitive object={ghostMat} attach="material" />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.4, 16]} />
        <primitive object={ghostMat} attach="material" />
      </mesh>
      {/* Jagged bottom */}
      <mesh position={[-0.23, 0, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.12, 0.25, 8]} />
        <primitive object={ghostMat} attach="material" />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.12, 0.25, 8]} />
        <primitive object={ghostMat} attach="material" />
      </mesh>
      <mesh position={[0.23, 0, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.12, 0.25, 8]} />
        <primitive object={ghostMat} attach="material" />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.12, 0.45, 0.35]}>
        <primitive object={eyeGeo} attach="geometry" />
        <primitive object={eyeMat} attach="material" />
      </mesh>
      <mesh position={[0.12, 0.45, 0.35]}>
        <primitive object={eyeGeo} attach="geometry" />
        <primitive object={eyeMat} attach="material" />
      </mesh>
    </group>
  );
}

function StoryController() {
  const courageRef = useRef(null);
  const houseRef   = useRef(null);
  const [doorOpen, setDoorOpen] = useState(false);
  const [phase, setPhase]       = useState(0);
  const scratchVec1 = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime % 30;

    let p = 0;
    if      (t < 4)  p = 0;
    else if (t < 8)  p = 1;
    else if (t < 12) p = 2;
    else if (t < 20) p = 3;
    else if (t < 26) p = 4;
    else             p = 5;

    if (p !== phase) {
      setPhase(p);
      setDoorOpen(p === 2 || p === 4);
    }

    if (!courageRef.current || !houseRef.current) return;

    if (p === 0) {
      const pT = t / 4;
      courageRef.current.rotation.y = Math.PI;
      courageRef.current.position.set(THREE.MathUtils.lerp(22, -22, pT), -0.1, 8);
      courageRef.current.scale.setScalar(0.7);
      houseRef.current.scale.lerp(scratchVec1.set(1, 1, 1), 0.1);
    } else if (p === 1) {
      const pT = (t - 4) / 4;
      courageRef.current.rotation.y = 0;
      courageRef.current.position.set(THREE.MathUtils.lerp(-22, 10, pT), -0.1, 8);
      courageRef.current.scale.setScalar(0.7);
      houseRef.current.scale.lerp(scratchVec1.set(1, 1, 1), 0.1);
    } else if (p === 2) {
      const pT = Math.pow((t - 8) / 4, 1.2);
      courageRef.current.rotation.y = Math.PI;
      courageRef.current.position.set(THREE.MathUtils.lerp(10, -3.3, pT), -0.1, THREE.MathUtils.lerp(8, 2.5, pT));
      courageRef.current.scale.setScalar(THREE.MathUtils.lerp(0.7, 0.25, pT));
    } else if (p === 3) {
      courageRef.current.scale.setScalar(0);
      const pT = t - 12;
      houseRef.current.scale.lerp(scratchVec1.set(
        1 + Math.sin(pT * 15) * 0.08,
        1 + Math.cos(pT * 12) * 0.08,
        1 + Math.sin(pT * 18) * 0.08,
      ), 0.5);
    } else if (p === 4) {
      const pT = (t - 20) / 6;
      courageRef.current.scale.setScalar(THREE.MathUtils.lerp(0.25, 0.7, pT));
      courageRef.current.rotation.y = 0;
      courageRef.current.position.set(THREE.MathUtils.lerp(-3.3, 22, pT), -0.1, THREE.MathUtils.lerp(2.5, 9, pT));
      houseRef.current.scale.lerp(scratchVec1.set(1, 1, 1), 0.1);
    } else {
      courageRef.current.scale.setScalar(0);
      houseRef.current.scale.lerp(scratchVec1.set(1, 1, 1), 0.1);
    }
  });

  return (
    <group>
      <group ref={houseRef}>
        <House position={[-2.5, -0.2, 0]} doorOpen={doorOpen} />
      </group>
      <Windmill position={[7.5, -0.6, -8]} rotation={[0, -Math.PI / 6, 0]} />
      <Truck position={[4, 0.1, 4]} rotation={[0, -Math.PI / 4, 0]} />

      {/* Courage — CSS character embedded in 3D via Html overlay */}
      <group ref={courageRef}>
        <Html transform center style={{ pointerEvents: 'none' }}>
          <CourageRunningAnimationComplete />
          {phase === 4 && (
            <div style={{
              position: 'absolute',
              top: '-80px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'white',
              color: 'black',
              fontWeight: 900,
              fontSize: '1.875rem',
              padding: '12px 20px',
              borderRadius: '9999px',
              border: '4px solid black',
              whiteSpace: 'nowrap',
              WebkitTextStroke: '1px black',
            }}>
              HELP!
              <div style={{
                position: 'absolute',
                bottom: '-16px',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: '16px',
                height: '16px',
                background: 'white',
                borderBottom: '4px solid black',
                borderLeft: '4px solid black',
                borderRadius: '2px',
              }} />
            </div>
          )}
        </Html>
      </group>

      {/* Ghosts spawn during escape phase */}
      {phase === 4 && (
        <group>
          <Ghost courageRef={courageRef} offsetPosition={[-1, 0.5, -1]}  offsetTime={0} />
          <Ghost courageRef={courageRef} offsetPosition={[-2, 1.5, -2]}  offsetTime={2} />
          <Ghost courageRef={courageRef} offsetPosition={[-3, 2.5, -0.5]} offsetTime={4} />
        </group>
      )}
    </group>
  );
}

export function Scene() {
  const gradientTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 512);
      gradient.addColorStop(0.0,  '#0a001a');
      gradient.addColorStop(0.4,  '#240046');
      gradient.addColorStop(0.65, '#5c006b');
      gradient.addColorStop(0.75, '#b90082');
      gradient.addColorStop(1.0,  '#ff1a9c');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 2, 512);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <>
      <color attach="background" args={['#0a001a']} />

      {/* Sky sphere */}
      <mesh position={[0, -5, 0]}>
        <sphereGeometry args={[120, 16, 16]} />
        <meshBasicMaterial side={THREE.BackSide} depthWrite={false} map={gradientTexture} />
      </mesh>

      <Stars radius={80} depth={30} count={2000} factor={6} saturation={0.5} fade speed={0.5} />

      <ambientLight intensity={0.4} color="#bd80e8" />

      <directionalLight
        position={[40, 15, 10]}
        intensity={2.8}
        color="#ffccf5"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={120}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0005}
      />

      <group position={[0, -2, 0]}>
        <Terrain />
        <StoryController />
      </group>
    </>
  );
}
