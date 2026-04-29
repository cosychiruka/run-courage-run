/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Scene } from './components/Scene';
import CourageRunningAnimationComplete from './components/CourageRunningAnimationComplete';
import * as THREE from 'three';

export default function App() {
  return (
    <div className="relative w-full h-screen bg-[#050014] overflow-hidden">
      <Canvas 
        shadows 
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, powerPreference: "high-performance" }}
      >
        <PerspectiveCamera makeDefault position={[0, 3, 50]} fov={30} />
        <Scene />
        <OrbitControls 
          enablePan={true} 
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 8}
          minDistance={10}
          maxDistance={100}
          target={[0, 1.5, 0]}
        />
      </Canvas>
    </div>
  );
}

