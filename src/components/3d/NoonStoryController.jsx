import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { House } from './House3D';
import { Truck } from './Truck3D';
import { Windmill } from './Windmill3D';
import { Euriel } from './Euriel3D';
import CourageRunningAnimationComplete from './CourageRunningAnimationComplete';

const MemoHouse = React.memo(House);
const MemoWindmill = React.memo(Windmill);

export function NoonStoryController({ eventLine = '' }) {
  const courageRef = useRef(null);
  const houseRef = useRef(null);
  const truckGroupRef = useRef(null);
  const eurielRef = useRef(null);

  const [doorOpen, setDoorOpen] = useState(false);
  const [phase, setPhase] = useState(0);
  // 0 = Chill (sit in yard), 1 = Chase (run after truck)
  const seqRef = useRef(0);
  const startTimeRef = useRef(null);
  const scratchVec1 = useMemo(() => new THREE.Vector3(), []);
  const truckTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (startTimeRef.current === null) startTimeRef.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - startTimeRef.current;

    let p = 0;
    // 60s Loop
    if (t < 5) p = 0; // Wait inside
    else if (t < 10) p = 1; // Euriel walks to truck
    else if (t < 15) p = 2; // Truck drives off, Courage comes out
    else if (t < 40) p = 3; // Truck is gone. Courage chills or plays
    else if (t < 45) p = 4; // Truck drives back
    else if (t < 50) p = 5; // Euriel walks back to house
    else if (t < 55) p = 6; // Courage walks back inside
    else {
      startTimeRef.current = state.clock.elapsedTime;
      p = 0;
    }

    if (p !== phase) {
      if (p === 0 && phase !== 0) {
        seqRef.current = Math.random() > 0.5 ? 1 : 0; // 0=Chill, 1=Play
      }
      setPhase(p);
      setDoorOpen(p === 1 || p === 5 || p === 6);
    }

    // --- House subtle breathing ---
    if (houseRef.current) {
      if (p === 0) {
        const bounceT = t;
        const squishX = 1 + Math.sin(bounceT * 2) * 0.02;
        const squishY = 1 + Math.cos(bounceT * 1.5) * 0.02;
        houseRef.current.scale.lerp(scratchVec1.set(squishX, squishY, 1), 0.1);
      } else {
        houseRef.current.scale.lerp(scratchVec1.set(1, 1, 1), 0.1);
      }
    }

    // --- Euriel Logic ---
    if (eurielRef.current) {
      if (p === 0 || p >= 6) {
        eurielRef.current.scale.setScalar(0.001); // hidden inside
      } else if (p === 1) {
        // Walks from house to truck
        eurielRef.current.scale.setScalar(0.6);
        const walkT = (t - 5) / 5;
        eurielRef.current.position.set(
          THREE.MathUtils.lerp(-2.8, 3.5, walkT),
          -0.1,
          THREE.MathUtils.lerp(2.5, 4.5, walkT)
        );
        eurielRef.current.rotation.y = Math.PI * 0.3;
      } else if (p === 5) {
        // Walks from truck back to house
        eurielRef.current.scale.setScalar(0.6);
        const walkT = (t - 45) / 5;
        eurielRef.current.position.set(
          THREE.MathUtils.lerp(3.5, -2.8, walkT),
          -0.1,
          THREE.MathUtils.lerp(4.5, 2.5, walkT)
        );
        eurielRef.current.rotation.y = -Math.PI * 0.7;
      } else {
        eurielRef.current.scale.setScalar(0.001); // hidden in truck
      }
    }

    // --- Truck Logic ---
    if (truckGroupRef.current) {
      if (p < 2 || p >= 5) {
        // Parked beside house
        truckGroupRef.current.position.set(4, 0.1, 4);
        truckGroupRef.current.rotation.y = Math.PI / 2; // face +X
      } else if (p === 2) {
        // Drive away along +X — accelerating
        const driveT = Math.pow((t - 10) / 5, 1.5);
        const nextX = THREE.MathUtils.lerp(4, 55, driveT);
        truckGroupRef.current.position.set(nextX, 0.1 + Math.sin(t * 20) * 0.05, 4);
        truckGroupRef.current.rotation.y = Math.PI / 2;
      } else if (p === 3) {
        // Fully off-screen — push far beyond canvas edge
        truckGroupRef.current.position.set(500, 0.1, 4);
      } else if (p === 4) {
        // Drive back from +X — decelerating
        const driveT = 1 - Math.pow((45 - t) / 5, 1.5);
        const nextX = THREE.MathUtils.lerp(55, 4, driveT);
        truckGroupRef.current.position.set(nextX, 0.1 + Math.sin(t * 20) * 0.05, 4);
        truckGroupRef.current.rotation.y = -Math.PI / 2; // face -X while returning
      }
    }

    // --- Courage Logic ---
    if (courageRef.current) {
      if (p < 2) {
        courageRef.current.scale.setScalar(0.001); // Inside house
      } else if (p >= 2 && p < 6) {
        if (seqRef.current === 0) {
          // CHILL: Courage walks out (p=2), sits in yard (p=3+)
          if (p === 2) {
            const walkT = (t - 10) / 5;
            courageRef.current.rotation.y = Math.PI * 0.1;
            courageRef.current.position.set(
              THREE.MathUtils.lerp(-2.8, -1, walkT),
              -0.1,
              THREE.MathUtils.lerp(2.5, 4, walkT)
            );
            courageRef.current.scale.setScalar(THREE.MathUtils.lerp(0.25, 0.4, walkT));
          } else {
            // Sitting/Chilling — face camera
            courageRef.current.scale.setScalar(0.4);
            courageRef.current.position.set(-1, -0.3, 4);
            courageRef.current.rotation.y = Math.PI * 0.5;
          }
        } else {
          // PLAY: Courage chases truck (p=2), sniffs yard (p=3+)
          if (p === 2) {
            const runT = (t - 10) / 5;
            courageRef.current.rotation.y = Math.PI * 0.4;
            courageRef.current.position.set(
              THREE.MathUtils.lerp(-2.8, 4, runT),
              -0.1,
              THREE.MathUtils.lerp(2.5, 5, runT)
            );
            courageRef.current.scale.setScalar(THREE.MathUtils.lerp(0.25, 0.5, runT));
          } else if (p === 3 || p === 4 || p === 5) {
            const playT = (t - 15) / 35;
            courageRef.current.rotation.y = Math.PI * 0.8 + playT * Math.PI * 4;
            courageRef.current.position.set(
              4 + Math.cos(playT * Math.PI * 6) * 4,
              -0.1,
              5 + Math.sin(playT * Math.PI * 6) * 4
            );
            courageRef.current.scale.setScalar(0.5);
          }
        }
      } else if (p === 6) {
        // Return to house
        const runT = (t - 50) / 5;
        courageRef.current.rotation.y = -Math.PI * 0.8;
        courageRef.current.position.set(
          THREE.MathUtils.lerp(courageRef.current.position.x, -2.8, runT),
          -0.1,
          THREE.MathUtils.lerp(courageRef.current.position.z, 2.5, runT)
        );
        courageRef.current.scale.setScalar(THREE.MathUtils.lerp(0.5, 0.25, runT));
      }
    }
  });

  return (
    <group>
      <group ref={houseRef}><MemoHouse position={[-2.5, -0.2, 0]} doorOpen={doorOpen} /></group>
      <MemoWindmill position={[7.5, -0.6, -8]} rotation={[0, -Math.PI / 6, 0]} />

      {/* Euriel Character */}
      <group ref={eurielRef}>
        <Euriel position={[0, 0, 0]} scale={1} isWalking={phase === 1 || phase === 5} />
      </group>

      {/* Animated Truck Group */}
      <group ref={truckGroupRef}>
        <Truck position={[0, 0, 0]} rotation={[0, 0, 0]} />
      </group>

      {/* Courage — 2D animated character in Html billboard */}
      <group ref={courageRef}>
        <Html transform center eps={0.001} style={{ pointerEvents: 'none' }}>
          <CourageRunningAnimationComplete isSniffing={phase >= 3 && phase <= 5} />
          {/* Speech bubble: show during chase or chill */}
          {phase >= 2 && phase <= 5 && seqRef.current === 1 && (
            <div style={{
              position: 'absolute', top: '-70px', left: '50%', transform: 'translateX(-50%)',
              backgroundColor: '#ffffff', color: '#000000', fontWeight: 900, fontSize: '1.2rem',
              padding: '10px 15px', borderRadius: '20px', border: '3px solid #000000',
              whiteSpace: 'nowrap', WebkitTextStroke: '0.5px black', zIndex: 100,
              boxShadow: '0 5px 0 rgba(0,0,0,0.2)',
            }}>
              {phase === 2 ? 'VROOOM!' : 'Sniff sniff...'}
              <div style={{
                position: 'absolute', bottom: '-12px', left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: '14px', height: '14px', backgroundColor: '#ffffff',
                borderBottom: '3px solid #000000', borderLeft: '3px solid #000000',
                borderRadius: '2px',
              }} />
            </div>
          )}
        </Html>
      </group>
    </group>
  );
}
