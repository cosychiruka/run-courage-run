import { useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { House } from './House';
import { Truck } from './Truck';
import { Windmill } from './Windmill';
import { Terrain } from './Terrain';
import CourageRunningAnimationComplete from './CourageRunningAnimationComplete';

function Ghost({ courageRef, offsetTime = 0, offsetPosition = [0, 0, 0] }: { courageRef: React.RefObject<THREE.Group>, offsetTime?: number, offsetPosition?: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  
  const ghostMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#ffffff', 
    emissive: '#d7d4ff', 
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.85,
    roughness: 0.8
  }), []);

  const eyeGeo = useMemo(() => new THREE.CircleGeometry(0.08, 16), []);
  const eyeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#111122' }), []);

  const scratchVec1 = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (groupRef.current && courageRef.current) {
      const t = state.clock.elapsedTime % 30;
      let disperseX = 0;
      let disperseY = 0;
      let disperseZ = 0;
      
      if (t > 28) {
        const disperseT = t - 28; // 0 to 2
        disperseX = offsetPosition[0] * disperseT * 15;
        disperseY = disperseT * 10;
        disperseZ = offsetPosition[2] * disperseT * 15;
      }
      
      // Follow courage with some delay/wave
      const targetX = courageRef.current.position.x + offsetPosition[0] + Math.sin(state.clock.elapsedTime * 2 + offsetTime * 2) * 0.5 + disperseX;
      const targetY = 1 + offsetPosition[1] + Math.sin(state.clock.elapsedTime * 4 + offsetTime) * 0.6 + disperseY;
      const targetZ = courageRef.current.position.z + offsetPosition[2] + disperseZ;

      groupRef.current.position.lerp(scratchVec1.set(targetX, targetY, targetZ), 0.1);
      
      // Always look at camera instead of courage to see eyes
      groupRef.current.lookAt(state.camera.position);
    }
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
      {/* jagged bottom */}
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
  const { camera } = useThree();
  const courageRef = useRef<THREE.Group>(null);
  const houseRef = useRef<THREE.Group>(null);
  
  const [doorOpen, setDoorOpen] = useState(false);
  const [phase, setPhase] = useState(0);

  // Phases:
  // 0: Sideways run left (0-4)
  // 1: Sideways run right (4-8)
  // 2: Run to house (8-12)
  // 3: Inside house chaos (12-20)
  // 4: Run away (20-26)
  // 5: Hide (26-30)

  // Use cached vectors for lerping to avoid garbage collection hitches
  const scratchVec1 = useMemo(() => new THREE.Vector3(), []);
  
  useFrame((state) => {
    const t = state.clock.elapsedTime % 30; // loop fully every 30s
    
    let p = 0;
    if (t < 4) p = 0;
    else if (t < 8) p = 1;
    else if (t < 12) p = 2;
    else if (t < 20) p = 3;
    else if (t < 26) p = 4;
    else p = 5;
    
    if (p !== phase) {
      setPhase(p);
      setDoorOpen(p === 2 || p === 4);
    }

    if (courageRef.current && houseRef.current) {
      if (p === 0) {
        // Run left 
        const pT = t / 4; 
        courageRef.current.rotation.y = Math.PI; // Do not skew!
        courageRef.current.position.set(THREE.MathUtils.lerp(22, -22, pT), -0.1, 8);
        courageRef.current.scale.setScalar(0.7);
        houseRef.current.scale.lerp(scratchVec1.set(1, 1, 1), 0.1);
      } else if (p === 1) {
        // Run right
        const pT = (t - 4) / 4;
        courageRef.current.rotation.y = 0; // Do not skew!
        courageRef.current.position.set(THREE.MathUtils.lerp(-22, 10, pT), -0.1, 8);
        courageRef.current.scale.setScalar(0.7);
        houseRef.current.scale.lerp(scratchVec1.set(1, 1, 1), 0.1);
      } else if (p === 2) {
        // Run into house
        const pT = Math.pow((t - 8) / 4, 1.2);
        courageRef.current.rotation.y = Math.PI; // Face strictly left, no skewing away from camera constraint
        courageRef.current.position.set(THREE.MathUtils.lerp(10, -3.3, pT), -0.1, THREE.MathUtils.lerp(8, 2.5, pT));
        courageRef.current.scale.setScalar(THREE.MathUtils.lerp(0.7, 0.25, pT)); // Shrink heavily into distance
      } else if (p === 3) {
        // Inside house chaos
        courageRef.current.scale.setScalar(0);
        const pT = (t - 12);
        const squishX = 1 + Math.sin(pT * 15) * 0.08;
        const squishY = 1 + Math.cos(pT * 12) * 0.08;
        const squishZ = 1 + Math.sin(pT * 18) * 0.08;
        houseRef.current.scale.lerp(scratchVec1.set(squishX, squishY, squishZ), 0.5);
      } else if (p === 4) {
        // Escape!
        const pT = (t - 20) / 6;
        courageRef.current.scale.setScalar(THREE.MathUtils.lerp(0.25, 0.7, pT));
        courageRef.current.rotation.y = 0; // Face strictly right perfectly straight
        courageRef.current.position.set(THREE.MathUtils.lerp(-3.3, 22, pT), -0.1, THREE.MathUtils.lerp(2.5, 9, pT));
        houseRef.current.scale.lerp(scratchVec1.set(1, 1, 1), 0.1);
      } else {
        // Offscreen wait
        courageRef.current.scale.setScalar(0);
        houseRef.current.scale.lerp(scratchVec1.set(1, 1, 1), 0.1);
      }
    }
  });

  return (
    <group>
      <group ref={houseRef}>
        <House position={[-2.5, -0.2, 0]} doorOpen={doorOpen} />
      </group>
      <Windmill position={[7.5, -0.6, -8]} rotation={[0, -Math.PI / 6, 0]} />
      <Truck position={[4, 0.1, 4]} rotation={[0, -Math.PI / 4, 0]} />
      
      {/* courage ref */}
      <group ref={courageRef}>
        <Html transform center style={{ pointerEvents: 'none' }}>
           <CourageRunningAnimationComplete />
           {phase === 4 && (
             <div className="absolute top-[-80px] left-[50%] transform -translate-x-1/2 bg-white text-black font-black text-3xl px-5 py-3 rounded-full border-4 border-black whitespace-nowrap" style={{ WebkitTextStroke: '1px black', fontWeight: 900 }}>
                HELP!
                <div className="absolute bottom-[-16px] left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-b-4 border-l-4 border-black rotate-[45deg] rounded-sm"></div>
             </div>
           )}
        </Html>
      </group>

      {/* Ghosts spawning behind courage */}
      {phase === 4 && (
        <group>
           {/* Offset the ghosts slightly behind courage path running from door to right */}
           <Ghost courageRef={courageRef} offsetPosition={[-1, 0.5, -1]} offsetTime={0} />
           <Ghost courageRef={courageRef} offsetPosition={[-2, 1.5, -2]} offsetTime={2} />
           <Ghost courageRef={courageRef} offsetPosition={[-3, 2.5, -0.5]} offsetTime={4} />
        </group>
      )}
    </group>
  );
}

export function Scene() {
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);

  const gradientTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createLinearGradient(0, 0, 0, 512);
      gradient.addColorStop(0.0, '#0a001a'); // Deep space
      gradient.addColorStop(0.4, '#240046'); // Dark purple
      gradient.addColorStop(0.65, '#5c006b'); // Magenta hue
      gradient.addColorStop(0.75, '#b90082'); // Bright pink horizon
      gradient.addColorStop(1.0, '#ff1a9c'); // Ground reflection/below horizon
      context.fillStyle = gradient;
      context.fillRect(0, 0, 2, 512);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <>
      <color attach="background" args={['#0a001a']} />
      
      {/* Sky Sphere */}
      <mesh position={[0, -5, 0]}>
        <sphereGeometry args={[120, 16, 16]} />
        <meshBasicMaterial side={THREE.BackSide} depthWrite={false} map={gradientTexture} />
      </mesh>

      <Stars radius={80} depth={30} count={2000} factor={6} saturation={0.5} fade speed={0.5} />

      <ambientLight intensity={0.4} color="#bd80e8" />
      
      {/* Global Moon/Key directional light from far right casting long shadows left */}
      <directionalLight
        ref={directionalLightRef}
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
