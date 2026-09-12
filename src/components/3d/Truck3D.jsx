/* eslint-disable react/no-unknown-property -- React Three Fiber JSX maps props to Three.js objects. */
import { useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { Instance, Instances, RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const WHEEL_POSITIONS = [
  [-1.08, 0.68, 1.58],
  [1.08, 0.68, 1.58],
  [-1.08, 0.68, -2.32],
  [1.08, 0.68, -2.32],
];

function Wheel({ position, wheelRef }) {
  return (
    <group position={position}>
      <group ref={wheelRef} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.66, 0.66, 0.42, 28]} />
          <meshStandardMaterial color="#15161b" roughness={0.88} metalness={0.04} />
        </mesh>
        <mesh position={[0, 0.225, 0]}>
          <cylinderGeometry args={[0.39, 0.39, 0.035, 24]} />
          <meshStandardMaterial color="#bbc2ca" roughness={0.26} metalness={0.78} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.055, 20]} />
          <meshStandardMaterial color="#343b43" roughness={0.32} metalness={0.62} />
        </mesh>
        {[0, 1, 2, 3, 4].map((spoke) => (
          <mesh
            key={spoke}
            position={[Math.cos((spoke / 5) * Math.PI * 2) * 0.22, 0.252, Math.sin((spoke / 5) * Math.PI * 2) * 0.22]}
            rotation={[Math.PI / 2, 0, -(spoke / 5) * Math.PI * 2]}
          >
            <boxGeometry args={[0.06, 0.28, 0.035]} />
            <meshStandardMaterial color="#5e6872" roughness={0.3} metalness={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

Wheel.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
  wheelRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.object })]),
};

function Headlamp({ x, lightsOn }) {
  return (
    <group position={[x, 1.32, 2.66]}>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.31, 0.31, 0.18, 24]} />
        <meshStandardMaterial color="#aeb6c0" roughness={0.28} metalness={0.75} />
      </mesh>
      <mesh position={[0, 0, 0.105]}>
        <circleGeometry args={[0.235, 24]} />
        <meshStandardMaterial
          color={lightsOn ? '#fff8bf' : '#d7dde0'}
          emissive={lightsOn ? '#ffd95b' : '#000000'}
          emissiveIntensity={lightsOn ? 2.2 : 0}
          roughness={0.18}
        />
      </mesh>
    </group>
  );
}

Headlamp.propTypes = {
  lightsOn: PropTypes.bool.isRequired,
  x: PropTypes.number.isRequired,
};

export function Truck({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  driverDoorOpen = false,
  lightsOn = true,
}) {
  const truckRef = useRef(null);
  const outerRef = useRef(null);
  const driverDoorRef = useRef(null);
  const wheelRefs = useRef([]);
  const timeRef = useRef(0);
  const wheelSpinRef = useRef(0);
  const previousWorldPositionRef = useRef(new THREE.Vector3());
  const hasPreviousPositionRef = useRef(false);
  const currentWorldPosition = useMemo(() => new THREE.Vector3(), []);

  const materials = useMemo(() => ({
    paint: new THREE.MeshStandardMaterial({ color: '#8f9baa', roughness: 0.34, metalness: 0.48 }),
    paintDark: new THREE.MeshStandardMaterial({ color: '#677381', roughness: 0.42, metalness: 0.4 }),
    chassis: new THREE.MeshStandardMaterial({ color: '#20232a', roughness: 0.78, metalness: 0.22 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#172b3b', roughness: 0.1, metalness: 0.08, transmission: 0.08, transparent: true, opacity: 0.86 }),
    trim: new THREE.MeshStandardMaterial({ color: '#bfc6cc', roughness: 0.25, metalness: 0.8 }),
    grill: new THREE.MeshStandardMaterial({ color: '#24292d', roughness: 0.38, metalness: 0.58 }),
    wood: new THREE.MeshStandardMaterial({ color: '#8d6547', roughness: 0.86, metalness: 0 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#17191d', roughness: 0.9, metalness: 0 }),
    tail: new THREE.MeshStandardMaterial({ color: '#8f151f', emissive: '#d51d29', emissiveIntensity: 0.5, roughness: 0.35 }),
  }), []);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (truckRef.current) {
      const engine = Math.sin(timeRef.current * 38) * 0.009;
      truckRef.current.position.y = engine;
      truckRef.current.rotation.z = Math.sin(timeRef.current * 31) * 0.0015;
    }

    if (driverDoorRef.current) {
      const target = driverDoorOpen ? -1.05 : 0;
      driverDoorRef.current.rotation.y = THREE.MathUtils.damp(
        driverDoorRef.current.rotation.y,
        target,
        7.5,
        delta,
      );
    }

    if (outerRef.current) {
      outerRef.current.getWorldPosition(currentWorldPosition);
      if (hasPreviousPositionRef.current) {
        const dx = currentWorldPosition.x - previousWorldPositionRef.current.x;
        const dz = currentWorldPosition.z - previousWorldPositionRef.current.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 5) wheelSpinRef.current += distance / 0.66;
      }
      previousWorldPositionRef.current.copy(currentWorldPosition);
      hasPreviousPositionRef.current = true;
      wheelRefs.current.forEach((wheel) => {
        if (wheel) wheel.rotation.y = wheelSpinRef.current;
      });
    }

  });

  return (
    <group ref={outerRef} position={position} rotation={rotation} scale={0.9}>
      <group ref={truckRef}>
        <mesh material={materials.chassis} position={[0, 0.77, -0.28]} castShadow receiveShadow>
          <boxGeometry args={[1.48, 0.22, 6.2]} />
        </mesh>

        <RoundedBox args={[2.1, 1.38, 1.85]} radius={0.18} smoothness={3} position={[0, 1.78, -0.06]} castShadow receiveShadow>
          <primitive object={materials.paint} attach="material" />
        </RoundedBox>
        <RoundedBox args={[2.24, 0.26, 1.94]} radius={0.12} smoothness={3} position={[0, 2.58, -0.08]} castShadow>
          <primitive object={materials.paintDark} attach="material" />
        </RoundedBox>
        <RoundedBox args={[1.88, 0.76, 1.78]} radius={0.18} smoothness={3} position={[0, 1.38, 1.52]} castShadow receiveShadow>
          <primitive object={materials.paint} attach="material" />
        </RoundedBox>
        <RoundedBox args={[1.72, 0.1, 1.55]} radius={0.05} smoothness={2} position={[0, 1.81, 1.5]}>
          <primitive object={materials.paintDark} attach="material" />
        </RoundedBox>

        <mesh material={materials.glass} position={[0, 2.17, 0.895]} rotation={[-0.05, 0, 0]}>
          <boxGeometry args={[1.68, 0.63, 0.045]} />
        </mesh>
        <mesh material={materials.trim} position={[0, 2.17, 0.922]}>
          <boxGeometry args={[0.045, 0.68, 0.025]} />
        </mesh>
        <mesh material={materials.glass} position={[0, 2.15, -0.995]}>
          <boxGeometry args={[1.55, 0.56, 0.04]} />
        </mesh>
        <mesh material={materials.glass} position={[1.068, 2.15, -0.05]}>
          <boxGeometry args={[0.04, 0.58, 1.38]} />
        </mesh>

        <group ref={driverDoorRef} position={[-1.075, 1.66, 0.63]}>
          <group position={[0, 0, -0.68]}>
            <RoundedBox args={[0.09, 1.17, 1.38]} radius={0.04} smoothness={2} castShadow>
              <primitive object={materials.paintDark} attach="material" />
            </RoundedBox>
            <mesh material={materials.glass} position={[-0.052, 0.34, 0]}>
              <boxGeometry args={[0.035, 0.48, 1.08]} />
            </mesh>
            <mesh material={materials.trim} position={[-0.064, -0.08, 0.34]}>
              <boxGeometry args={[0.025, 0.07, 0.25]} />
            </mesh>
          </group>
        </group>

        <group position={[-1.18, 2.13, 0.42]}>
          <mesh material={materials.trim} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 0.23, 10]} />
          </mesh>
          <mesh material={materials.glass} position={[-0.12, 0, 0.04]} scale={[0.16, 0.1, 0.22]}>
            <sphereGeometry args={[1, 14, 10]} />
          </mesh>
        </group>
        <group position={[1.18, 2.13, 0.42]}>
          <mesh material={materials.trim} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 0.23, 10]} />
          </mesh>
          <mesh material={materials.glass} position={[0.12, 0, 0.04]} scale={[0.16, 0.1, 0.22]}>
            <sphereGeometry args={[1, 14, 10]} />
          </mesh>
        </group>

        <RoundedBox args={[1.98, 1.12, 0.18]} radius={0.05} smoothness={2} position={[0, 1.22, 2.43]} castShadow>
          <primitive object={materials.paintDark} attach="material" />
        </RoundedBox>
        <mesh material={materials.grill} position={[0, 1.23, 2.535]}>
          <boxGeometry args={[1.34, 0.72, 0.05]} />
        </mesh>
        <Instances limit={7} material={materials.trim}>
          <boxGeometry args={[1, 1, 1]} />
          {Array.from({ length: 7 }, (_, index) => (
            <Instance key={index} position={[-0.51 + index * 0.17, 1.23, 2.57]} scale={[0.035, 0.62, 0.045]} />
          ))}
        </Instances>
        <RoundedBox args={[2.35, 0.18, 0.25]} radius={0.06} smoothness={2} position={[0, 0.76, 2.6]}>
          <primitive object={materials.trim} attach="material" />
        </RoundedBox>
        <Headlamp x={-0.72} lightsOn={lightsOn} />
        <Headlamp x={0.72} lightsOn={lightsOn} />

        {WHEEL_POSITIONS.map((wheelPosition, index) => (
          <mesh
            key={`fender-${index}`}
            material={materials.paintDark}
            position={[wheelPosition[0] * 1.01, 0.78, wheelPosition[2]]}
            rotation={[0, Math.PI / 2, 0]}
            castShadow
          >
            <torusGeometry args={[0.69, 0.13, 8, 24]} />
          </mesh>
        ))}

        <mesh material={materials.chassis} position={[-1.26, 0.66, -0.3]}>
          <boxGeometry args={[0.22, 0.1, 3.0]} />
        </mesh>
        <mesh material={materials.chassis} position={[1.26, 0.66, -0.3]}>
          <boxGeometry args={[0.22, 0.1, 3.0]} />
        </mesh>

        <RoundedBox args={[2.24, 0.2, 3.08]} radius={0.06} smoothness={2} position={[0, 1.03, -2.22]} castShadow receiveShadow>
          <primitive object={materials.paintDark} attach="material" />
        </RoundedBox>
        <RoundedBox args={[0.16, 0.72, 3.04]} radius={0.05} smoothness={2} position={[-1.06, 1.4, -2.22]} castShadow>
          <primitive object={materials.paint} attach="material" />
        </RoundedBox>
        <RoundedBox args={[0.16, 0.72, 3.04]} radius={0.05} smoothness={2} position={[1.06, 1.4, -2.22]} castShadow>
          <primitive object={materials.paint} attach="material" />
        </RoundedBox>
        <RoundedBox args={[2.12, 0.72, 0.16]} radius={0.05} smoothness={2} position={[0, 1.4, -3.72]} castShadow>
          <primitive object={materials.paint} attach="material" />
        </RoundedBox>
        <Instances limit={6} material={materials.wood} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          {Array.from({ length: 6 }, (_, index) => (
            <Instance key={index} position={[-0.78 + index * 0.31, 1.18, -2.21]} scale={[0.24, 0.08, 2.72]} />
          ))}
        </Instances>
        <mesh material={materials.tail} position={[-0.68, 1.35, -3.815]}>
          <boxGeometry args={[0.32, 0.2, 0.035]} />
        </mesh>
        <mesh material={materials.tail} position={[0.68, 1.35, -3.815]}>
          <boxGeometry args={[0.32, 0.2, 0.035]} />
        </mesh>
      </group>

      {WHEEL_POSITIONS.map((wheelPosition, index) => (
        <Wheel
          key={`wheel-${index}`}
          position={wheelPosition}
          wheelRef={(node) => { wheelRefs.current[index] = node; }}
        />
      ))}
    </group>
  );
}

Truck.propTypes = {
  driverDoorOpen: PropTypes.bool,
  lightsOn: PropTypes.bool,
  position: PropTypes.arrayOf(PropTypes.number),
  rotation: PropTypes.arrayOf(PropTypes.number),
};
