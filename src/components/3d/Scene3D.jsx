import React, { useRef, useMemo, useState, useEffect, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { House } from './House3D';
import { Truck } from './Truck3D';
import { Windmill } from './Windmill3D';
import { Terrain } from './Terrain3D';
import CourageRunningAnimationComplete from './CourageRunningAnimationComplete';
import { NoonStoryController } from './NoonStoryController';

const MemoHouse = memo(House);
const MemoWindmill = memo(Windmill);
const MemoTruck = memo(Truck);
const MemoTerrain = memo(Terrain);

function GiantFly({ courageRef, sequenceRef, sequenceStartTime, offsetTime = 0, offsetPosition = [0, 0, 0], visible = true, phase = 0, selfieTexture = null, selfieLabel = '', selfiePreviewUrl = null, isSelfie = false }) {
  const groupRef = useRef(null);
  const leftWingRef = useRef(null);
  const rightWingRef = useRef(null);
  const scratchVec1 = useMemo(() => new THREE.Vector3(), []);
  
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#1a1005', roughness: 0.8
  }), []);

  const wingMat = useMemo(() => new THREE.MeshBasicMaterial({ 
    color: isSelfie ? '#aaffcc' : '#bed2ff', transparent: true, opacity: 0.6, side: THREE.DoubleSide
  }), [isSelfie]);

  const selfieMat = useMemo(() => selfieTexture
    ? new THREE.MeshBasicMaterial({ map: selfieTexture })
    : null,
  [selfieTexture]);

  const haloMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#00ff88', wireframe: true }), []);

  const wingGeo = useMemo(() => new THREE.CircleGeometry(0.6, 16), []);
  const eyeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff3c00' }), []);

  useFrame((state) => {
    if (groupRef.current && courageRef.current) {
      if (leftWingRef.current && rightWingRef.current) {
         const flap = Math.sin(state.clock.elapsedTime * 60) * 0.8;
         leftWingRef.current.rotation.x = flap;
         rightWingRef.current.rotation.x = -flap;
         groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 10 + offsetTime) * 0.2;
         groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 15 + offsetTime) * 0.1;
      }

      let targetX, targetY, targetZ;
      if (sequenceRef?.current === 1) {
        if (phase === 4) {
           const pathT = state.clock.elapsedTime - sequenceStartTime - 7;
           const fakeT = THREE.MathUtils.clamp((pathT - 5) / 10, 0, 1);
           targetX = THREE.MathUtils.lerp(-2.5, 35, fakeT) + offsetPosition[0];
           targetY = THREE.MathUtils.lerp(2.5, 10, fakeT) + offsetPosition[1];
           targetZ = THREE.MathUtils.lerp(1, 15, fakeT) + offsetPosition[2];
           if (visible) groupRef.current.scale.setScalar(isSelfie ? 1.4 : 1);
        } else {
           groupRef.current.scale.setScalar(0); 
           targetX = 0; targetY=0; targetZ=0;
        }
      } else {
        if (phase === 1 || phase === 2 || phase === 3) {
           targetX = courageRef.current.position.x + offsetPosition[0];
           targetY = 2 + offsetPosition[1];
           targetZ = courageRef.current.position.z + offsetPosition[2];
           if (visible) groupRef.current.scale.setScalar(isSelfie ? 1.4 : 1);
        } else {
           groupRef.current.scale.setScalar(0);
           targetX = 0; targetY=0; targetZ=0;
        }
      }
      groupRef.current.position.lerp(scratchVec1.set(targetX, targetY, targetZ), 0.1);
      
      scratchVec1.copy(state.camera.position);
      scratchVec1.y = groupRef.current.position.y;
      groupRef.current.lookAt(scratchVec1);
    }
  });

  return (
    <group ref={groupRef} visible={visible} scale={visible ? 1 : 0.001}>
      <pointLight color={isSelfie ? '#00ff88' : '#ff3c00'} intensity={isSelfie ? 1.5 : 0.5} distance={5} />
      {/* Body */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
        <capsuleGeometry args={[0.3, 0.6, 4, 8]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>
      {/* Wings */}
      <group position={[-0.3, 0.4, 0]}>
         <mesh ref={leftWingRef} position={[-0.4, 0, 0]} rotation={[0, Math.PI/2, 0]}>
            <primitive object={wingGeo} attach="geometry" />
            <primitive object={wingMat} attach="material" />
         </mesh>
      </group>
      <group position={[0.3, 0.4, 0]}>
         <mesh ref={rightWingRef} position={[0.4, 0, 0]} rotation={[0, Math.PI/2, 0]}>
            <primitive object={wingGeo} attach="geometry" />
            <primitive object={wingMat} attach="material" />
         </mesh>
      </group>
      {/* Head: selfie face OR default bug eyes */}
      {selfieMat ? (
        <>
          {/* Selfie face sphere — larger so photo is clearly visible */}
          <mesh position={[0, 0.65, 0.3]}>
            <sphereGeometry args={[0.65, 16, 16]} />
            <primitive object={selfieMat} attach="material" />
          </mesh>
          {/* Photo overlay — same technique as Courage HTML/CSS in 3D scene */}
          {selfiePreviewUrl && (
            <Html position={[0, 0.65, 0.3]} center sprite occlude={false}>
              <img
                src={selfiePreviewUrl}
                alt=""
                style={{
                  width: '130px', height: '130px',
                  borderRadius: '50%', objectFit: 'cover',
                  border: '5px solid #fff',
                  boxShadow: '0 0 20px rgba(0,255,136,0.9)',
                  pointerEvents: 'none',
                }}
              />
            </Html>
          )}
          {/* Green halo ring */}
          <mesh position={[0, 0.65, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.78, 0.07, 8, 24]} />
            <primitive object={haloMat} attach="material" />
          </mesh>
          {/* Floating nametag — moved further up to clear the bigger face */}
          <Html position={[0, 1.8, 0]} center sprite>
            <div style={{
              background: 'linear-gradient(135deg, #00cc44, #00aaff)',
              color: '#fff',
              fontFamily: '"Comic Sans MS", cursive',
              fontWeight: 900,
              fontSize: '18px',
              padding: '5px 12px',
              borderRadius: '18px',
              border: '2px solid #fff',
              boxShadow: '0 3px 0 rgba(0,0,0,0.4), 0 0 16px rgba(0,255,100,0.8)',
              whiteSpace: 'nowrap',
            }}>
              🪰 {selfieLabel || 'YOU'}
            </div>
          </Html>
        </>
      ) : (
        <>
          <mesh position={[-0.15, 0.2, 0.4]}><sphereGeometry args={[0.15, 8, 8]} /><primitive object={eyeMat} attach="material" /></mesh>
          <mesh position={[0.15, 0.2, 0.4]}><sphereGeometry args={[0.15, 8, 8]} /><primitive object={eyeMat} attach="material" /></mesh>
        </>
      )}
    </group>
  );
}

function Ghost({ courageRef, offsetTime = 0, offsetPosition = [0, 0, 0], visible = true, phase = 0 }) {
  const groupRef = useRef(null);
  const scratchVec1 = useMemo(() => new THREE.Vector3(), []);
  
  const ghostMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#ffffff', emissive: '#d7d4ff', emissiveIntensity: 0.8,
    transparent: true, opacity: 0.85, roughness: 0.8
  }), []);

  const eyeGeo = useMemo(() => new THREE.CircleGeometry(0.08, 16), []);
  const eyeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#111122' }), []);

  useFrame((state) => {
    if (groupRef.current && courageRef.current) {
      const t = state.clock.elapsedTime % 30;
      if (t < 0.1) { groupRef.current.scale.setScalar(0); return; }

      let targetX, targetY, targetZ;
      if (phase === 5 || phase === 0) {
        const retreatT = THREE.MathUtils.clamp((t - 26) / 3.5, 0, 1);
        targetX = THREE.MathUtils.lerp(courageRef.current.position.x, -2.5, retreatT) + offsetPosition[0];
        targetY = THREE.MathUtils.lerp(1.5, 4, retreatT) + offsetPosition[1];
        targetZ = THREE.MathUtils.lerp(courageRef.current.position.z, 0, retreatT) + offsetPosition[2];
        groupRef.current.scale.setScalar(THREE.MathUtils.lerp(1, 0, retreatT));
      } else {
        targetX = courageRef.current.position.x + offsetPosition[0] + Math.sin(state.clock.elapsedTime * 2 + offsetTime * 2) * 0.5;
        targetY = 1 + offsetPosition[1] + Math.sin(state.clock.elapsedTime * 4 + offsetTime) * 0.6;
        targetZ = courageRef.current.position.z + offsetPosition[2];
        if (visible) groupRef.current.scale.setScalar(1);
      }
      groupRef.current.position.lerp(scratchVec1.set(targetX, targetY, targetZ), 0.1);
      groupRef.current.lookAt(state.camera.position);
    }
  });

  return (
    <group ref={groupRef} visible={visible} scale={visible ? 1 : 0.001}>
      <pointLight color="#d7d4ff" intensity={visible ? 1.5 : 0} distance={8} />
      <mesh position={[0, 0.4, 0]}><sphereGeometry args={[0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><primitive object={ghostMat} attach="material" /></mesh>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.35, 0.35, 0.4, 16]} /><primitive object={ghostMat} attach="material" /></mesh>
      <mesh position={[-0.23, 0, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.12, 0.25, 8]} /><primitive object={ghostMat} attach="material" /></mesh>
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.12, 0.25, 8]} /><primitive object={ghostMat} attach="material" /></mesh>
      <mesh position={[0.23, 0, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.12, 0.25, 8]} /><primitive object={ghostMat} attach="material" /></mesh>
      <mesh position={[-0.12, 0.45, 0.35]}><primitive object={eyeGeo} attach="geometry" /><primitive object={eyeMat} attach="material" /></mesh>
      <mesh position={[0.12, 0.45, 0.35]}><primitive object={eyeGeo} attach="geometry" /><primitive object={eyeMat} attach="material" /></mesh>
    </group>
  );
}

function EveningStoryController({ eventLine = '' }) {
  const courageRef = useRef(null);
  const houseRef = useRef(null);
  const [doorOpen, setDoorOpen] = useState(false);
  const [phase, setPhase] = useState(0);
  const scratchVec1 = useMemo(() => new THREE.Vector3(), []);
  
  useFrame((state) => {
    const t = state.clock.elapsedTime % 30;
    let p = 0;
    if (t < 4) p = 0; else if (t < 8) p = 1; else if (t < 12) p = 2; else if (t < 20) p = 3; else if (t < 26) p = 4; else p = 5;
    if (p !== phase) { setPhase(p); setDoorOpen(p === 2 || p === 4); }

    if (courageRef.current && houseRef.current) {
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
        houseRef.current.scale.lerp(scratchVec1.set(1, 1, 1), 0.1);
      } else if (p === 3) {
        courageRef.current.scale.setScalar(0);
        const pT = (t - 12);
        const squishX = 1 + Math.sin(pT * 15) * 0.08;
        const squishY = 1 + Math.cos(pT * 12) * 0.08;
        const squishZ = 1 + Math.sin(pT * 18) * 0.08;
        houseRef.current.scale.lerp(scratchVec1.set(squishX, squishY, squishZ), 0.5);
      } else if (p === 4) {
        const pT = (t - 20) / 6;
        courageRef.current.rotation.y = 0;
        courageRef.current.position.set(THREE.MathUtils.lerp(-2.8, 22, pT), -0.1, THREE.MathUtils.lerp(2.5, 9, pT));
        courageRef.current.scale.setScalar(THREE.MathUtils.lerp(0.25, 0.7, pT));
        houseRef.current.scale.lerp(scratchVec1.set(1, 1, 1), 0.1);
      } else {
        courageRef.current.scale.setScalar(0);
        houseRef.current.scale.lerp(scratchVec1.set(1, 1, 1), 0.1);
      }
    }
  });

  return (
    <group>
      <group ref={houseRef}><MemoHouse position={[-2.5, -0.2, 0]} doorOpen={doorOpen} /></group>
      <MemoWindmill position={[7.5, -0.6, -8]} rotation={[0, -Math.PI / 6, 0]} />
      <MemoTruck position={[4, 0.1, 4]} rotation={[0, -Math.PI / 4, 0]} />
      <group ref={courageRef}>
        <Html transform center eps={0.001} style={{ pointerEvents: 'none' }}>
           <CourageRunningAnimationComplete />
           {/* Thought bubble: LLM line overrides HELP! — toggle, never both */}
           {(phase === 4 || eventLine) && (
             <div style={{
               position: 'absolute', top: '-90px', left: '50%', transform: 'translateX(-50%)',
               backgroundColor: eventLine ? 'rgba(20,0,40,0.92)' : '#ffffff',
               color: eventLine ? '#e0ccff' : '#000000',
               fontWeight: 900,
               fontSize: eventLine ? '1.1rem' : '2rem',
               padding: eventLine ? '10px 18px' : '15px 25px',
               borderRadius: '50px',
               border: eventLine ? '2px solid rgba(150,0,255,0.6)' : '5px solid #000000',
               WebkitTextStroke: eventLine ? 'unset' : '1px black',
               zIndex: 100,
               boxShadow: eventLine
                 ? '0 4px 20px rgba(120,0,255,0.5)'
                 : '0 10px 0 rgba(0,0,0,0.2)',
               fontFamily: '"Comic Sans MS", cursive',
               maxWidth: '220px', whiteSpace: 'normal', textAlign: 'center',
               transition: 'all 0.3s ease',
             }}>
               {eventLine || 'HELP!'}
               <div style={{
                 position: 'absolute', bottom: '-18px', left: '50%',
                 transform: 'translateX(-50%) rotate(45deg)',
                 width: '20px', height: '20px',
                 backgroundColor: eventLine ? 'rgba(20,0,40,0.92)' : '#ffffff',
                 borderBottom: eventLine ? '2px solid rgba(150,0,255,0.6)' : '5px solid #000000',
                 borderLeft:  eventLine ? '2px solid rgba(150,0,255,0.6)' : '5px solid #000000',
                 borderRadius: '3px',
               }} />
             </div>
           )}
        </Html>
      </group>
      <group>
         <Ghost courageRef={courageRef} offsetPosition={[-1, 0.5, -1]} offsetTime={0} visible={phase === 4 || phase === 5} phase={phase} />
         <Ghost courageRef={courageRef} offsetPosition={[-2, 1.5, -2]} offsetTime={2} visible={phase === 4 || phase === 5} phase={phase} />
         <Ghost courageRef={courageRef} offsetPosition={[-3, 2.5, -0.5]} offsetTime={4} visible={phase === 4 || phase === 5} phase={phase} />
      </group>
    </group>
  );
}

function SunriseStoryController({ selfieFlyTexture = null, selfieFlyLabel = '', selfieFlyPreviewUrl = null, eventLine = '' }) {
  const courageRef = useRef(null);
  const houseRef = useRef(null);
  const [doorOpen, setDoorOpen] = useState(false);
  const [phase, setPhase] = useState(0);
  const seqRef = useRef(0);
  const startTimeRef = useRef(null);
  const scratchVec1 = useMemo(() => new THREE.Vector3(), []);
  
  useFrame((state) => {
    if (startTimeRef.current === null) startTimeRef.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - startTimeRef.current;
    
    let p = 0;
    if (t < 7) {
       p = -1; // 7s suspense
    } else if (t < 12) {
       p = 0; // 5s bouncing
    } else {
       const pathT = t - 7;
       if (seqRef.current === 0) {
          if (pathT < 12) p = 1;      // Exit -> Top Right
          else if (pathT < 18) p = 2; // Top Right -> Top Left
          else if (pathT < 24) p = 3; // Top Left -> Enter House
          else { startTimeRef.current = state.clock.elapsedTime; p = -1; }
       } else {
          if (pathT < 15) p = 4;      // Fakeout Exit & Hide
          else if (pathT < 18) p = 5; // Sneak Back in
          else { startTimeRef.current = state.clock.elapsedTime; p = -1; }
       }
    }
    
    if (p !== phase) { 
      // Roll branch when entering house suspense phase
      if (p === -1 && phase !== -1) seqRef.current = Math.random() > 0.5 ? 1 : 0; 
      setPhase(p); 
      setDoorOpen(p === 1 || p === 3 || p === 4 || p === 5); 
    }

    if (courageRef.current && houseRef.current) {
      if (p === -1) {
        courageRef.current.scale.setScalar(0.001); // Hidden inside
        houseRef.current.scale.lerp(scratchVec1.set(1, 1, 1), 0.1);
      } else if (p === 0) {
        courageRef.current.scale.setScalar(0.001); // Shrink Courage so he's hidden inside
        const bounceT = t - 7;
        const squishX = 1 + Math.sin(bounceT * 15) * 0.08;
        const squishY = 1 + Math.cos(bounceT * 12) * 0.08;
        const squishZ = 1 + Math.sin(bounceT * 18) * 0.08;
        houseRef.current.scale.lerp(scratchVec1.set(squishX, squishY, squishZ), 0.5);
      } else {
        houseRef.current.scale.lerp(scratchVec1.set(1, 1, 1), 0.1);
        const pathT = t - 7;
        if (p === 1) { 
           // Seq0: Run starting from door to Top Right
           const pT = (pathT - 5) / 7;
           courageRef.current.rotation.y = 0;
           courageRef.current.position.set(THREE.MathUtils.lerp(-2.8, 22, pT), -0.1, THREE.MathUtils.lerp(2.5, 9, pT));
           courageRef.current.scale.setScalar(THREE.MathUtils.lerp(0.25, 0.7, pT));
        } else if (p === 2) { 
           // Seq0: Top Right to Top Left across screen
           const pT = (pathT - 12) / 6;
           courageRef.current.rotation.y = Math.PI;
           courageRef.current.position.set(THREE.MathUtils.lerp(22, -22, pT), -0.1, 8);
           courageRef.current.scale.setScalar(0.7);
        } else if (p === 3) { 
           // Seq0: Top Left back to Door
           const pT = Math.pow((pathT - 18) / 6, 1.2);
           courageRef.current.rotation.y = Math.PI * 0.8;
           courageRef.current.position.set(THREE.MathUtils.lerp(-22, -2.8, pT), -0.1, THREE.MathUtils.lerp(8, 2.5, pT));
           courageRef.current.scale.setScalar(THREE.MathUtils.lerp(0.7, 0.25, pT));
        } else if (p === 4) { 
           // Seq1 Fakeout: Run from door straight to back of house
           const pT = Math.min((pathT - 5) / 2, 1);
           courageRef.current.rotation.y = Math.PI * 0.8;
           courageRef.current.position.set(THREE.MathUtils.lerp(-2.8, -8, pT), -0.1, THREE.MathUtils.lerp(2.5, -4, pT));
           courageRef.current.scale.setScalar(0.4);
        } else if (p === 5) { 
           // Seq1 Fakeout: Sneak back to Door
           const pT = Math.min((pathT - 15) / 3, 1);
           courageRef.current.rotation.y = -Math.PI * 0.2;
           courageRef.current.position.set(THREE.MathUtils.lerp(-8, -2.8, pT), -0.1, THREE.MathUtils.lerp(-4, 2.5, pT));
           courageRef.current.scale.setScalar(THREE.MathUtils.lerp(0.4, 0.25, pT));
        }
      }
    }
  });

  return (
    <group>
      <group ref={houseRef}><MemoHouse position={[-2.5, -0.2, 0]} doorOpen={doorOpen} /></group>
      <MemoWindmill position={[7.5, -0.6, -8]} rotation={[0, -Math.PI / 6, 0]} />
      <MemoTruck position={[4, 0.1, 4]} rotation={[0, -Math.PI / 4, 0]} />
      <group ref={courageRef}>
        <Html transform center eps={0.001} style={{ pointerEvents: 'none' }}>
           <CourageRunningAnimationComplete />
           {/* Thought bubble: 'HELP!' only (LLM narration moved to screen center card) */}
           {((phase === 1 || phase === 2) && seqRef.current === 0) && (
             <div style={{
               position: 'absolute', top: '-90px', left: '50%', transform: 'translateX(-50%)',
               backgroundColor: '#ffffff',
               color: '#000000',
               fontWeight: 900,
               fontSize: '2rem',
               padding: '15px 25px',
               borderRadius: '50px',
               border: '5px solid #000000',
               zIndex: 100,
               boxShadow: '0 10px 0 rgba(0,0,0,0.2)',
               fontFamily: '"Comic Sans MS", cursive',
               maxWidth: '220px', whiteSpace: 'nowrap', textAlign: 'center',
             }}>
               HELP!
               <div style={{
                 position: 'absolute', bottom: '-18px', left: '50%',
                 transform: 'translateX(-50%) rotate(45deg)',
                 width: '20px', height: '20px',
                 backgroundColor: '#ffffff',
                 borderBottom: '5px solid #000000',
                 borderLeft: '5px solid #000000',
                 borderRadius: '3px',
               }} />
             </div>
           )}
        </Html>
      </group>
      <group>
         <GiantFly courageRef={courageRef} sequenceRef={seqRef} sequenceStartTime={startTimeRef.current} offsetPosition={[-1, 0.5, -1]} offsetTime={0} visible={phase > 0} phase={phase} />
         <GiantFly courageRef={courageRef} sequenceRef={seqRef} sequenceStartTime={startTimeRef.current} offsetPosition={[-2, 1.5, -2]} offsetTime={2} visible={phase > 0} phase={phase} />
         {/* Fly 3: selfie fly when active, otherwise NPC */}
         <GiantFly
           courageRef={courageRef}
           sequenceRef={seqRef}
           sequenceStartTime={startTimeRef.current}
           offsetPosition={[-3, 2.5, -0.5]}
           offsetTime={4}
           visible={phase > 0}
           phase={phase}
           selfieTexture={selfieFlyTexture}
           selfieLabel={selfieFlyLabel}
           selfiePreviewUrl={selfieFlyPreviewUrl}
           isSelfie={!!selfieFlyTexture}
         />
      </group>
    </group>
  );
}

/**
 * ShootingStar — pure CSS shooting star rendered in a Html overlay.
 * Looks clean on all devices, no geometry quality issues.
 * Fires every 5 minutes for ~3 seconds.
 */
function ShootingStar() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Fire immediately on mount, then every 5 minutes
    const fire = () => { setVisible(true); setTimeout(() => setVisible(false), 3200); };
    fire();
    const interval = setInterval(fire, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  if (!visible) return null;
  return (
    <Html
      position={[-60, 45, -80]}
      style={{ pointerEvents: 'none', overflow: 'visible' }}
      zIndexRange={[0, 0]}
    >
      <style>{`
        @keyframes shootStar {
          0%   { transform: translate(0, 0) rotate(-35deg); opacity: 1; }
          100% { transform: translate(340px, 180px) rotate(-35deg); opacity: 0; }
        }
        .shooting-star-wrap { animation: shootStar 3s ease-in forwards; }
        .shooting-star-head {
          width: 14px; height: 14px; border-radius: 50%;
          background: radial-gradient(circle, #ffffff 0%, #ffe599 50%, rgba(255,200,80,0) 100%);
          box-shadow: 0 0 12px 6px rgba(255,230,120,0.9), 0 0 30px 10px rgba(255,160,40,0.4);
        }
        .shooting-star-tail {
          position: absolute; top: 50%; left: 14px;
          transform: translateY(-50%);
          width: 90px; height: 3px;
          background: linear-gradient(to right, rgba(255,230,120,0.9), rgba(255,160,40,0.3), transparent);
          border-radius: 2px;
          filter: blur(1px);
        }
      `}</style>
      <div className="shooting-star-wrap" style={{ position: 'relative' }}>
        <div className="shooting-star-head" />
        <div className="shooting-star-tail" />
      </div>
    </Html>
  );
}

function StylizedCloud({ position, scale = 1, opacity = 0.5, speed = 0.05, morning = false }) {
  const meshRef = useRef();
  const color = morning ? '#ffd1b3' : '#aaccff'; 
  useFrame((state) => {
    if (meshRef.current) {
        meshRef.current.position.x += speed * scale;
        if (meshRef.current.position.x > 150) meshRef.current.position.x = -150;
    }
  });
  return (
     <group ref={meshRef} position={position} scale={[scale, scale, scale]}>
       <mesh position={[0, 0, 0]}><sphereGeometry args={[4, 16, 16]} /><meshStandardMaterial color={color} transparent opacity={opacity} roughness={1} /></mesh>
       <mesh position={[4, -1, 0]}><sphereGeometry args={[3, 16, 16]} /><meshStandardMaterial color={color} transparent opacity={opacity} roughness={1} /></mesh>
       <mesh position={[-4, -1, 0]}><sphereGeometry args={[3, 16, 16]} /><meshStandardMaterial color={color} transparent opacity={opacity} roughness={1} /></mesh>
       <mesh position={[0, -2, 2]}><sphereGeometry args={[3.5, 16, 16]} /><meshStandardMaterial color={color} transparent opacity={opacity} roughness={1} /></mesh>
     </group>
  );
}

export function Scene({ scene = 'evening', showStory = true, selfieFlyTexture = null, selfieFlyLabel = '', selfieFlyPreviewUrl = null, eventLine = '' }) {
  const isSunrise = scene === 'sunrise';
  const isNoon = scene === 'noon';
  const ambientColor = isNoon ? '#ffffff' : isSunrise ? '#ff9944' : '#bd80e8';
  const ambientIntensity = isNoon ? 1.4 : isSunrise ? 0.8 : 0.4;
  const dirLightColor = isNoon ? '#ffffff' : isSunrise ? '#ffcc66' : '#ffccf5';
  const dirLightIntensity = isNoon ? 4.5 : isSunrise ? 2.0 : 2.8;
  // Sun: directly overhead for noon, low-angle warm for sunrise
  const dirLightPos = isNoon ? [5, 40, 5] : isSunrise ? [20, 8, 10] : [40, 15, 10];
  
  const gradientTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 512;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createLinearGradient(0, 0, 0, 512);
      
      if (scene === 'sunrise') {
        // Warm dawn: deep orange-red at zenith fading to peach-gold horizon
        gradient.addColorStop(0.0, '#c44b00'); gradient.addColorStop(0.25, '#e8762a');
        gradient.addColorStop(0.55, '#ffb347'); gradient.addColorStop(0.8, '#ffd88a');
        gradient.addColorStop(1.0, '#fff0c0');
      } else if (scene === 'noon') {
        // Bright midday: saturated sky blue at zenith to pale cyan horizon
        gradient.addColorStop(0.0, '#0e5fb5'); gradient.addColorStop(0.3, '#1e88e5');
        gradient.addColorStop(0.6, '#64b5f6'); gradient.addColorStop(1.0, '#bbdefb');
      } else if (scene === 'midnight') {
        gradient.addColorStop(0.0, '#000000'); gradient.addColorStop(0.4, '#0a001a');
        gradient.addColorStop(0.7, '#1a0033'); gradient.addColorStop(1.0, '#2d1b69');
      } else {
        gradient.addColorStop(0.0, '#0a001a'); gradient.addColorStop(0.4, '#240046');
        gradient.addColorStop(0.65, '#5c006b'); gradient.addColorStop(0.75, '#b90082');
        gradient.addColorStop(1.0, '#ff1a9c');
      }
      
      context.fillStyle = gradient; context.fillRect(0, 0, 2, 512);
    }
    return new THREE.CanvasTexture(canvas);
  }, [scene]);

  const bgColor = isNoon ? '#1e88e5' : isSunrise ? '#e8762a' : '#0a001a';

  return (
    <>
      <color attach="background" args={[bgColor]} />
      <mesh position={[0, -5, 0]}><sphereGeometry args={[120, 16, 16]} /><meshBasicMaterial side={THREE.BackSide} depthWrite={false} map={gradientTexture} /></mesh>
      {/* Stars only for night/evening scenes */}
      {!isNoon && <Stars radius={80} depth={30} count={2000} factor={6} saturation={0.5} fade speed={0.5} />}
      {scene === 'sunrise' && (
        <>
          <StylizedCloud position={[-40, 30, -50]} scale={1.2} morning={true} opacity={0.6} />
          <StylizedCloud position={[20, 45, -60]} scale={1.8} morning={true} speed={0.03} opacity={0.4} />
          <StylizedCloud position={[80, 25, -40]} scale={0.9} morning={true} speed={0.07} opacity={0.7} />
        </>
      )}
      {/* Noon: bright white-yellow sun sphere high in sky */}
      {isNoon && (
        <>
          <mesh position={[10, 55, -60]}>
            <sphereGeometry args={[6, 16, 16]} />
            <meshStandardMaterial color="#fff5a0" emissive="#ffee44" emissiveIntensity={3} />
          </mesh>
          {/* Sun halo glow */}
          <mesh position={[10, 55, -60]}>
            <sphereGeometry args={[9, 12, 12]} />
            <meshStandardMaterial color="#fffbe0" transparent opacity={0.15} />
          </mesh>
          {/* Noon poofy white clouds */}
          <StylizedCloud position={[-50, 35, -70]} scale={1.5} morning={false} opacity={0.85} />
          <StylizedCloud position={[40, 42, -65]} scale={2.0} morning={false} speed={0.02} opacity={0.7} />
          <StylizedCloud position={[85, 30, -55]} scale={1.1} morning={false} speed={0.06} opacity={0.9} />
        </>
      )}
      <ambientLight intensity={ambientIntensity} color={ambientColor} />
      <directionalLight
        position={dirLightPos}
        intensity={dirLightIntensity}
        color={dirLightColor}
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
      {/* CSS shooting star — only in evening/sunrise (not noon) */}
      {!isNoon && <ShootingStar />}
      <group position={[0, -2, 0]}>
        <MemoTerrain scene={scene} />
        {showStory && (
          scene === 'noon' ? <NoonStoryController eventLine={eventLine} /> :
          scene === 'sunrise' ? <SunriseStoryController selfieFlyTexture={selfieFlyTexture} selfieFlyLabel={selfieFlyLabel} selfieFlyPreviewUrl={selfieFlyPreviewUrl} eventLine={eventLine} /> : <EveningStoryController eventLine={eventLine} />
        )}
      </group>
    </>
  );
}
