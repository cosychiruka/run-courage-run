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

export function NoonStoryController() {
  const courageRef = useRef(null);
  const houseRef = useRef(null);
  const truckGroupRef = useRef(null);
  const eurielRef = useRef(null);
  const exhaustRef = useRef(null);

  const [doorOpen, setDoorOpen] = useState(false);
  const [phase, setPhase] = useState(0);
  const seqRef = useRef(0);
  const startTimeRef = useRef(null);
  const scratchVec1 = useMemo(() => new THREE.Vector3(), []);

  // Simple particle system for truck exhaust
  const exhaustParticles = useMemo(() => {
    return Array.from({ length: 30 }).map(() => ({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      life: 0,
      active: false
    }));
  }, []);

  useFrame((state, delta) => {
    if (startTimeRef.current === null) startTimeRef.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - startTimeRef.current;

    let p = 0;
    // 30s Loop
    if (t < 5) p = 0; // Phase 0: Suspense/Wait
    else if (t < 10) p = 1; // Phase 1: Euriel walks to truck
    else if (t < 15) p = 2; // Phase 2: Truck drives off
    else if (t < 25) p = 3; // Phase 3: Courage decides to Chill or Play
    else {
      // Loop reset
      startTimeRef.current = state.clock.elapsedTime;
      p = 0;
    }

    if (p !== phase) {
      if (p === 0 && phase !== 0) {
        seqRef.current = Math.random() > 0.5 ? 1 : 0; // 0 = Chill, 1 = Play
      }
      setPhase(p);
      setDoorOpen(p === 1 || p === 3 || p === 4);
    }

    // --- House & Door ---
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
      if (p === 0) {
        eurielRef.current.scale.setScalar(0.001); // inside
      } else if (p === 1) {
        eurielRef.current.scale.setScalar(1);
        const walkT = (t - 5) / 5; // 0 to 1
        eurielRef.current.position.set(
          THREE.MathUtils.lerp(-2.8, 3.5, walkT),
          -0.1,
          THREE.MathUtils.lerp(2.5, 4.5, walkT)
        );
        eurielRef.current.rotation.y = Math.PI * 0.3;
      } else {
        eurielRef.current.scale.setScalar(0.001); // hidden in truck
      }
    }

    // --- Truck Logic ---
    if (truckGroupRef.current) {
      if (p < 2) {
        // Truck parked
        truckGroupRef.current.position.set(4, 0.1, 4);
        truckGroupRef.current.rotation.y = -Math.PI / 4;
      } else if (p === 2) {
        // Truck drives off
        const driveT = Math.pow((t - 10) / 5, 1.5); // Accel
        truckGroupRef.current.position.set(
          THREE.MathUtils.lerp(4, 40, driveT),
          0.1 + Math.sin(t * 20) * 0.05, // bumpy
          THREE.MathUtils.lerp(4, 20, driveT)
        );
      } else {
        // Gone
        truckGroupRef.current.position.set(40, -10, 20);
      }
    }

    // --- Courage Logic ---
    if (courageRef.current) {
      if (p < 3) {
        courageRef.current.scale.setScalar(0.001);
      } else if (p === 3) {
        const pathT = (t - 15) / 10;
        if (seqRef.current === 0) {
          // Chill Sequence
          if (pathT < 0.2) {
            const walkT = pathT / 0.2;
            courageRef.current.rotation.y = Math.PI * 0.1;
            courageRef.current.position.set(
              THREE.MathUtils.lerp(-2.8, -1, walkT),
              -0.1,
              THREE.MathUtils.lerp(2.5, 4, walkT)
            );
            courageRef.current.scale.setScalar(THREE.MathUtils.lerp(0.25, 0.4, walkT));
          } else {
            // Sitting/Chilling (using a squished scale as fake sit)
            courageRef.current.scale.setScalar(0.4);
            courageRef.current.position.y = -0.3; // Lower down
            courageRef.current.rotation.y = Math.PI * 0.5; // looking side
          }
        } else {
          // Play Sequence
          if (pathT < 0.3) {
            // Run to where truck was
            const runT = pathT / 0.3;
            courageRef.current.rotation.y = Math.PI * 0.4;
            courageRef.current.position.set(
              THREE.MathUtils.lerp(-2.8, 4, runT),
              -0.1,
              THREE.MathUtils.lerp(2.5, 5, runT)
            );
            courageRef.current.scale.setScalar(THREE.MathUtils.lerp(0.25, 0.5, runT));
          } else if (pathT < 0.7) {
            // Run around yard sniffing
            const runT = (pathT - 0.3) / 0.4;
            courageRef.current.rotation.y = Math.PI * 0.8 + runT * Math.PI;
            courageRef.current.position.set(
              4 + Math.cos(runT * Math.PI * 2) * 3,
              -0.1,
              5 + Math.sin(runT * Math.PI * 2) * 3
            );
            courageRef.current.scale.setScalar(0.5);
          } else {
            // Return to house
            const runT = (pathT - 0.7) / 0.3;
            courageRef.current.rotation.y = -Math.PI * 0.8;
            courageRef.current.position.set(
              THREE.MathUtils.lerp(7, -2.8, runT),
              -0.1,
              THREE.MathUtils.lerp(5, 2.5, runT)
            );
            courageRef.current.scale.setScalar(THREE.MathUtils.lerp(0.5, 0.25, runT));
          }
        }
      }
    }
  });

  return (
    <group>
      <group ref={houseRef}><MemoHouse position={[-2.5, -0.2, 0]} doorOpen={doorOpen} /></group>
      <MemoWindmill position={[7.5, -0.6, -8]} rotation={[0, -Math.PI / 6, 0]} />
      
      {/* Euriel Character */}
      <Euriel position={[-2.8, -0.1, 2.5]} scale={0.6} isWalking={phase === 1} />
      
      {/* Animated Truck Group */}
      <group ref={truckGroupRef}>
        <Truck position={[0, 0, 0]} rotation={[0, 0, 0]} />
      </group>

      <group ref={courageRef}>
        <Html transform center eps={0.001} style={{ pointerEvents: 'none' }}>
           <CourageRunningAnimationComplete />
           {phase === 3 && seqRef.current === 1 && (
             <div style={{ 
               position: 'absolute', top: '-70px', left: '50%', transform: 'translateX(-50%)', 
               backgroundColor: '#ffffff', color: '#000000', fontWeight: 900, fontSize: '1.2rem', 
               padding: '10px 15px', borderRadius: '20px', border: '3px solid #000000', 
               whiteSpace: 'nowrap', WebkitTextStroke: '0.5px black', zIndex: 100,
               boxShadow: '0 5px 0 rgba(0,0,0,0.2)' 
             }}>
                VROOOM!
             </div>
           )}
        </Html>
      </group>
    </group>
  );
}
