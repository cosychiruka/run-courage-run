import React, { useRef, useMemo, useState, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { House } from './House3D';
import { Truck } from './Truck3D';
import { Windmill } from './Windmill3D';
import { Terrain } from './Terrain3D';
import CourageRunningAnimationComplete from './CourageRunningAnimationComplete';

const MemoHouse = memo(House);
const MemoWindmill = memo(Windmill);
const MemoTruck = memo(Truck);
const MemoTerrain = memo(Terrain);

function GiantFly({ courageRef, sequenceRef, sequenceStartTime, offsetTime = 0, offsetPosition = [0, 0, 0], visible = true, phase = 0 }) {
  const groupRef = useRef(null);
  const leftWingRef = useRef(null);
  const rightWingRef = useRef(null);
  const scratchVec1 = useMemo(() => new THREE.Vector3(), []);
  
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#1a1005', roughness: 0.8
  }), []);

  const wingMat = useMemo(() => new THREE.MeshBasicMaterial({ 
    color: '#bed2ff', transparent: true, opacity: 0.6, side: THREE.DoubleSide
  }), []);

  const wingGeo = useMemo(() => new THREE.CircleGeometry(0.6, 16), []);
  const eyeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff3c00' }), []);

  useFrame((state) => {
    if (groupRef.current && courageRef.current) {
      if (leftWingRef.current && rightWingRef.current) {
         // Intense wing flap
         const flap = Math.sin(state.clock.elapsedTime * 60) * 0.8;
         leftWingRef.current.rotation.x = flap;
         rightWingRef.current.rotation.x = -flap;
         
         // Wobble the entire fly
         groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 10 + offsetTime) * 0.2;
         groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 15 + offsetTime) * 0.1;
      }

      let targetX, targetY, targetZ;
      // Phase mappings: 
      // -1, 0: inside house, 1, 2, 3: Sequence 0 chase. 4, 5: Sequence 1 Fakeout
      if (sequenceRef?.current === 1) {
        if (phase === 4) {
           // Flies blindly fly diagonally across screen tracking fake path
           const pathT = state.clock.elapsedTime - sequenceStartTime - 7;
           const fakeT = THREE.MathUtils.clamp((pathT - 5) / 10, 0, 1);
           targetX = THREE.MathUtils.lerp(-2.5, 35, fakeT) + offsetPosition[0];
           targetY = THREE.MathUtils.lerp(2.5, 10, fakeT) + offsetPosition[1];
           targetZ = THREE.MathUtils.lerp(1, 15, fakeT) + offsetPosition[2];
           if (visible) groupRef.current.scale.setScalar(1);
        } else {
           groupRef.current.scale.setScalar(0); 
           targetX = 0; targetY=0; targetZ=0;
        }
      } else {
        if (phase === 1 || phase === 2 || phase === 3) {
           // Chase Courage directly
           targetX = courageRef.current.position.x + offsetPosition[0];
           targetY = 2 + offsetPosition[1];
           targetZ = courageRef.current.position.z + offsetPosition[2];
           if (visible) groupRef.current.scale.setScalar(1);
        } else {
           groupRef.current.scale.setScalar(0);
           targetX = 0; targetY=0; targetZ=0;
        }
      }
      groupRef.current.position.lerp(scratchVec1.set(targetX, targetY, targetZ), 0.1);
      
      // Calculate look direction but keep flies relatively flat
      scratchVec1.copy(state.camera.position);
      scratchVec1.y = groupRef.current.position.y;
      groupRef.current.lookAt(scratchVec1);
    }
  });

  return (
    <group ref={groupRef} visible={visible} scale={visible ? 1 : 0.001}>
      <pointLight color="#ff3c00" intensity={0.5} distance={5} />
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
      {/* Eyes */}
      <mesh position={[-0.15, 0.2, 0.4]}><sphereGeometry args={[0.15, 8, 8]} /><primitive object={eyeMat} attach="material" /></mesh>
      <mesh position={[0.15, 0.2, 0.4]}><sphereGeometry args={[0.15, 8, 8]} /><primitive object={eyeMat} attach="material" /></mesh>
    </group>
  );
}

function StoryController() {
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
           {(phase === 1 || phase === 2) && seqRef.current === 0 && (
             <div style={{ 
               position: 'absolute', top: '-90px', left: '50%', transform: 'translateX(-50%)', 
               backgroundColor: '#ffffff', color: '#000000', fontWeight: 900, fontSize: '2rem', 
               padding: '15px 25px', borderRadius: '50px', border: '5px solid #000000', 
               whiteSpace: 'nowrap', WebkitTextStroke: '1px black', zIndex: 100,
               boxShadow: '0 10px 0 rgba(0,0,0,0.2)' 
             }}>
                HELP!
                <div style={{ 
                  position: 'absolute', bottom: '-18px', left: '50%', transform: 'translateX(-50%) rotate(45deg)', 
                  width: '20px', height: '20px', backgroundColor: '#ffffff', borderBottom: '5px solid #000000', 
                  borderLeft: '5px solid #000000', borderRadius: '3px' 
                }} />
             </div>
           )}
        </Html>
      </group>
      <group>
         <GiantFly courageRef={courageRef} sequenceRef={seqRef} sequenceStartTime={startTimeRef.current} offsetPosition={[-1, 0.5, -1]} offsetTime={0} visible={phase > 0} phase={phase} />
         <GiantFly courageRef={courageRef} sequenceRef={seqRef} sequenceStartTime={startTimeRef.current} offsetPosition={[-2, 1.5, -2]} offsetTime={2} visible={phase > 0} phase={phase} />
         <GiantFly courageRef={courageRef} sequenceRef={seqRef} sequenceStartTime={startTimeRef.current} offsetPosition={[-3, 2.5, -0.5]} offsetTime={4} visible={phase > 0} phase={phase} />
      </group>
    </group>
  );
}

function Meteor() {
  const meshRef = useRef();
  const trailRef = useRef();
  const headRef = useRef();
  
  useFrame((state) => {
     // 5 minutes = 300 seconds. Runs for 30 seconds.
     const t = state.clock.elapsedTime % 300;
     if (t < 30 && meshRef.current) {
         meshRef.current.visible = true;
         const progress = t / 30; // 0 to 1
         meshRef.current.position.set(THREE.MathUtils.lerp(-120, 120, progress), THREE.MathUtils.lerp(60, 10, progress), -90);
         
         if (headRef.current) {
            headRef.current.rotation.x += 0.05;
            headRef.current.rotation.y += 0.08;
         }
         
         if (trailRef.current) {
            trailRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 20) * 0.05;
         }
     } else if (meshRef.current) {
         meshRef.current.visible = false;
     }
  });

  const angle = Math.atan2(-50, 240);

  return (
      <group ref={meshRef} visible={false} rotation={[0, 0, angle]}>
         {/* Solid dark rocky head with sharp edges */}
         <mesh ref={headRef}>
            <icosahedronGeometry args={[2.5, 0]} />
            <meshStandardMaterial color="#1a0a00" roughness={0.9} />
         </mesh>
         {/* Bright inner glow popping through edges */}
         <mesh scale={[0.98, 0.98, 0.98]}>
            <icosahedronGeometry args={[2.5, 0]} />
            <meshStandardMaterial color="#ffffff" emissive="#ff3300" emissiveIntensity={5} wireframe />
         </mesh>
         {/* Trailing tail (pencil-stroked/wireframe overlapping cones) */}
         <mesh ref={trailRef} position={[-8, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[2.2, 16, 8, 1, true]} />
            <meshBasicMaterial color="#ff5500" transparent opacity={0.8} wireframe />
         </mesh>
         <mesh position={[-12, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[1.5, 24, 6, 1, true]} />
            <meshBasicMaterial color="#ffcc00" transparent opacity={0.4} wireframe />
         </mesh>
         <pointLight color="#ff4400" intensity={8} distance={200} />
      </group>
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

export function Scene({ scene = 'evening', showStory = true }) {
  const isSunrise = scene === 'sunrise';
  const ambientColor = isSunrise ? '#88ccff' : '#bd80e8';
  const dirLightColor = isSunrise ? '#ffffff' : '#ffccf5';
  
  const gradientTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 512;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createLinearGradient(0, 0, 0, 512);
      
      // Different gradients for different scenes
      if (scene === 'sunrise') {
        gradient.addColorStop(0.0, '#1e90ff'); gradient.addColorStop(0.3, '#66bbff');
        gradient.addColorStop(0.6, '#aaddff'); gradient.addColorStop(1.0, '#e0f6ff');
      } else if (scene === 'noon') {
        gradient.addColorStop(0.0, '#87ceeb'); gradient.addColorStop(0.4, '#98d8e8');
        gradient.addColorStop(0.7, '#b0e0e6'); gradient.addColorStop(1.0, '#e0f6ff');
      } else if (scene === 'midnight') {
        gradient.addColorStop(0.0, '#000000'); gradient.addColorStop(0.4, '#0a001a');
        gradient.addColorStop(0.7, '#1a0033'); gradient.addColorStop(1.0, '#2d1b69');
      } else {
        // evening (default)
        gradient.addColorStop(0.0, '#0a001a'); gradient.addColorStop(0.4, '#240046');
        gradient.addColorStop(0.65, '#5c006b'); gradient.addColorStop(0.75, '#b90082');
        gradient.addColorStop(1.0, '#ff1a9c');
      }
      
      context.fillStyle = gradient; context.fillRect(0, 0, 2, 512);
    }
    return new THREE.CanvasTexture(canvas);
  }, [scene]);

  return (
    <>
      <color attach="background" args={['#0a001a']} />
      <mesh position={[0, -5, 0]}><sphereGeometry args={[120, 16, 16]} /><meshBasicMaterial side={THREE.BackSide} depthWrite={false} map={gradientTexture} /></mesh>
      <Stars radius={80} depth={30} count={2000} factor={6} saturation={0.5} fade speed={0.5} />
      {scene === 'sunrise' && (
        <>
          <StylizedCloud position={[-40, 30, -50]} scale={1.2} morning={true} opacity={0.6} />
          <StylizedCloud position={[20, 45, -60]} scale={1.8} morning={true} speed={0.03} opacity={0.4} />
          <StylizedCloud position={[80, 25, -40]} scale={0.9} morning={true} speed={0.07} opacity={0.7} />
        </>
      )}
      <ambientLight intensity={isSunrise ? 0.7 : 0.4} color={ambientColor} />
      <directionalLight position={[40, 15, 10]} intensity={2.8} color={dirLightColor} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-near={0.5} shadow-camera-far={120} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-bias={-0.0005} />
      <Meteor />
      <group position={[0, -2, 0]}>
        <MemoTerrain scene={scene} />
        {showStory && <StoryController />}
      </group>
    </>
  );
}
