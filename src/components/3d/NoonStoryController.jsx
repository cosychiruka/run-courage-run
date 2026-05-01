import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { House } from './House3D';
import { Truck } from './Truck3D';
import { Windmill } from './Windmill3D';
import { Euriel } from './Euriel3D';
import { NoonCourage3D } from './NoonCourage3D';

const MemoHouse = React.memo(House);
const MemoWindmill = React.memo(Windmill);

export function NoonStoryController() {
  const courageRef = useRef(null);
  const houseRef = useRef(null);
  const truckGroupRef = useRef(null);
  const eurielRef = useRef(null);

  const [doorOpen, setDoorOpen] = useState(false);
  const [phase, setPhase] = useState(0);
  // 0 = Chill (sit in the yard), 1 = Chase (run after truck)
  const seqRef = useRef(0);
  const startTimeRef = useRef(null);
  const scratchVec1 = useMemo(() => new THREE.Vector3(), []);

  // Derived courage mode for NoonCourage3D
  const courageMode = phase < 2
    ? 'chill'
    : (seqRef.current === 1 && (phase === 2 || phase === 3 || phase === 4))
      ? 'run'
      : 'chill';

  useFrame((state) => {
    if (startTimeRef.current === null) startTimeRef.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - startTimeRef.current;

    let p = 0;
    if (t < 5)       p = 0; // Wait inside
    else if (t < 10) p = 1; // Euriel walks to truck
    else if (t < 15) p = 2; // Truck drives away; Courage appears
    else if (t < 40) p = 3; // Truck is gone — Courage chills or plays
    else if (t < 45) p = 4; // Truck drives back
    else if (t < 50) p = 5; // Euriel walks back to house
    else if (t < 56) p = 6; // Courage walks back inside
    else {
      startTimeRef.current = state.clock.elapsedTime;
      p = 0;
    }

    if (p !== phase) {
      if (p === 2) {
        // Choose branch at the moment the truck leaves
        seqRef.current = Math.random() > 0.5 ? 1 : 0;
      }
      setPhase(p);
      setDoorOpen(p === 1 || p === 5 || p === 6);
    }

    // --- House subtle breathing ---
    if (houseRef.current) {
      if (p === 0) {
        const squishX = 1 + Math.sin(t * 2) * 0.018;
        const squishY = 1 + Math.cos(t * 1.5) * 0.018;
        houseRef.current.scale.lerp(scratchVec1.set(squishX, squishY, 1), 0.1);
      } else {
        houseRef.current.scale.lerp(scratchVec1.set(1, 1, 1), 0.05);
      }
    }

    // --- Euriel --- NoonStoryController owns ALL position/scale; Euriel3D owns only rotations
    if (eurielRef.current) {
      if (p === 0 || p >= 6) {
        eurielRef.current.scale.setScalar(0.001);
      } else if (p === 1) {
        // Walk door → truck
        eurielRef.current.scale.setScalar(0.6);
        const walkT = Math.min((t - 5) / 5, 1);
        eurielRef.current.position.x = THREE.MathUtils.lerp(-2.8, 3.5, walkT);
        eurielRef.current.position.y = -0.1;
        eurielRef.current.position.z = THREE.MathUtils.lerp(2.5, 4.5, walkT);
        eurielRef.current.rotation.y = Math.PI * 0.3;
      } else if (p === 5) {
        // Walk truck → door
        eurielRef.current.scale.setScalar(0.6);
        const walkT = Math.min((t - 45) / 5, 1);
        eurielRef.current.position.x = THREE.MathUtils.lerp(3.5, -2.8, walkT);
        eurielRef.current.position.y = -0.1;
        eurielRef.current.position.z = THREE.MathUtils.lerp(4.5, 2.5, walkT);
        eurielRef.current.rotation.y = -Math.PI * 0.7;
      } else if (p === 2 || p === 3 || p === 4) {
        eurielRef.current.scale.setScalar(0.001); // inside truck
      }
    }

    // --- Truck: stays on ground (y=0.1), moves along X axis ---
    if (truckGroupRef.current) {
      if (p < 2 || p >= 5) {
        // Parked beside house
        truckGroupRef.current.position.set(4, 0.1, 4);
        truckGroupRef.current.rotation.y = Math.PI / 2; // face +X (driveway direction)
      } else if (p === 2) {
        // Drive away forward (+X direction, rotation stays PI/2)
        const driveT = Math.pow(Math.min((t - 10) / 5, 1), 1.5);
        truckGroupRef.current.position.set(
          THREE.MathUtils.lerp(4, 55, driveT),
          0.1 + Math.sin(t * 20) * 0.04,
          4
        );
        truckGroupRef.current.rotation.y = Math.PI / 2;
      } else if (p === 3) {
        // Off-screen — parked far away
        truckGroupRef.current.position.set(55, 0.1, 4);
      } else if (p === 4) {
        // Drive back (-X direction)
        const driveT = Math.pow(Math.min((t - 40) / 5, 1), 1.5);
        truckGroupRef.current.position.set(
          THREE.MathUtils.lerp(55, 4, driveT),
          0.1 + Math.sin(t * 20) * 0.04,
          4
        );
        truckGroupRef.current.rotation.y = -Math.PI / 2; // face -X (returning)
      }
    }

    // --- Courage (4-legged dog, uses ref for position/scale only) ---
    if (courageRef.current) {
      if (p < 2) {
        // Inside house
        courageRef.current.scale.setScalar(0.001);
      } else if (p === 2) {
        // Emerge from door
        courageRef.current.scale.setScalar(1);
        const emergeT = Math.min((t - 10) / 5, 1);
        courageRef.current.position.x = THREE.MathUtils.lerp(-2.8, -0.5, emergeT);
        courageRef.current.position.y = 0;
        courageRef.current.position.z = THREE.MathUtils.lerp(2.5, 4, emergeT);
        courageRef.current.rotation.y = seqRef.current === 1
          ? Math.PI * 0.4   // facing the truck — chasing
          : Math.PI * 0.1;  // facing vaguely forward — chilling
      } else if (p === 3 || p === 4 || p === 5) {
        if (seqRef.current === 0) {
          // CHILL: sit in the front yard looking at camera
          courageRef.current.scale.setScalar(1);
          courageRef.current.position.set(-0.5, 0, 4);
          courageRef.current.rotation.y = Math.PI; // facing camera
        } else {
          // PLAY: run around the yard in a loop
          const playT = (t - 15) / 35;
          const loopAngle = playT * Math.PI * 6;
          courageRef.current.scale.setScalar(1);
          courageRef.current.position.x = 3 + Math.cos(loopAngle) * 5;
          courageRef.current.position.y = 0;
          courageRef.current.position.z = 6 + Math.sin(loopAngle) * 4;
          // Face the direction of travel
          courageRef.current.rotation.y = loopAngle + Math.PI / 2;
        }
      } else if (p === 6) {
        // Run back to the door
        const runT = Math.min((t - 50) / 6, 1);
        const startX = seqRef.current === 0 ? -0.5 : 3;
        const startZ = seqRef.current === 0 ? 4 : 6;
        courageRef.current.scale.setScalar(THREE.MathUtils.lerp(1, 0.3, runT));
        courageRef.current.position.x = THREE.MathUtils.lerp(startX, -2.8, runT);
        courageRef.current.position.y = 0;
        courageRef.current.position.z = THREE.MathUtils.lerp(startZ, 2.5, runT);
        courageRef.current.rotation.y = -Math.PI * 0.7;
      }
    }
  });

  const isChasing = phase >= 2 && phase <= 5 && seqRef.current === 1;
  const isChilling = phase >= 2 && phase <= 5 && seqRef.current === 0;

  return (
    <group>
      <group ref={houseRef}><MemoHouse position={[-2.5, -0.2, 0]} doorOpen={doorOpen} /></group>
      <MemoWindmill position={[7.5, -0.6, -8]} rotation={[0, -Math.PI / 6, 0]} />

      {/* Euriel */}
      <group ref={eurielRef}>
        <Euriel position={[0, 0, 0]} scale={1} isWalking={phase === 1 || phase === 5} />
      </group>

      {/* Truck */}
      <group ref={truckGroupRef}>
        <Truck position={[0, 0, 0]} rotation={[0, 0, 0]} />
      </group>

      {/* Courage — 4-legged pink dog! */}
      <group ref={courageRef}>
        <NoonCourage3D mode={isChasing ? 'run' : 'chill'} />

        {/* Speech bubble for chase */}
        {isChasing && (
          <mesh position={[0, 1.2, 0]}>
            <sphereGeometry args={[0.001]} />
          </mesh>
        )}
      </group>

      {/* Chilling: show "zzzz" thought bubble */}
      {isChilling && phase === 3 && (
        <group position={[-0.5, 1.5, 4]}>
          <mesh>
            <sphereGeometry args={[0.18, 8, 6]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.9} />
          </mesh>
          {[0.25, 0.45, 0.6].map((offset, i) => (
            <mesh key={i} position={[offset * 0.5, offset, 0]}>
              <sphereGeometry args={[0.08 - i * 0.02, 6, 4]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
