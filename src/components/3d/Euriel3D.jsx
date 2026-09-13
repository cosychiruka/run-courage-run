/* eslint-disable react/no-unknown-property -- React Three Fiber JSX maps props to Three.js objects. */
import { useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDisposableThreeResources } from './useDisposableThreeResource';

function Arm({ side, shoulderRef, elbowRef, materials }) {
  const direction = side === 'left' ? -1 : 1;
  return (
    <group ref={shoulderRef} position={[direction * 0.46, 2.48, 0]}>
      <mesh position={[0, -0.32, 0]} castShadow>
        <capsuleGeometry args={[0.135, 0.47, 6, 12]} />
        <primitive object={materials.jacket} attach="material" />
      </mesh>
      <mesh position={[0, -0.64, 0]} scale={[0.15, 0.13, 0.15]} castShadow>
        <sphereGeometry args={[1, 12, 10]} />
        <primitive object={materials.jacketDark} attach="material" />
      </mesh>
      <group ref={elbowRef} position={[0, -0.66, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <capsuleGeometry args={[0.115, 0.42, 6, 12]} />
          <primitive object={materials.skin} attach="material" />
        </mesh>
        <mesh position={[0, -0.58, 0.035]} scale={[0.14, 0.18, 0.11]} castShadow>
          <sphereGeometry args={[1, 14, 10]} />
          <primitive object={materials.skin} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

Arm.propTypes = {
  elbowRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.object })]),
  materials: PropTypes.objectOf(PropTypes.object).isRequired,
  shoulderRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.object })]),
  side: PropTypes.oneOf(['left', 'right']).isRequired,
};

function Leg({ side, hipRef, kneeRef, materials }) {
  const direction = side === 'left' ? -1 : 1;
  return (
    <group ref={hipRef} position={[direction * 0.22, 1.55, 0]}>
      <mesh position={[0, -0.38, 0]} castShadow>
        <capsuleGeometry args={[0.17, 0.55, 6, 12]} />
        <primitive object={materials.denim} attach="material" />
      </mesh>
      <mesh position={[0, -0.76, 0]} scale={[0.18, 0.15, 0.18]} castShadow>
        <sphereGeometry args={[1, 12, 10]} />
        <primitive object={materials.denimDark} attach="material" />
      </mesh>
      <group ref={kneeRef} position={[0, -0.77, 0]}>
        <mesh position={[0, -0.34, 0]} castShadow>
          <capsuleGeometry args={[0.145, 0.52, 6, 12]} />
          <primitive object={materials.denimDark} attach="material" />
        </mesh>
        <RoundedBox args={[0.34, 0.23, 0.58]} radius={0.09} smoothness={3} position={[0, -0.71, 0.1]} castShadow>
          <primitive object={materials.boot} attach="material" />
        </RoundedBox>
        <mesh position={[0, -0.75, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.045, 0.18, 4, 8]} />
          <primitive object={materials.sole} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

Leg.propTypes = {
  hipRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.object })]),
  kneeRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.object })]),
  materials: PropTypes.objectOf(PropTypes.object).isRequired,
  side: PropTypes.oneOf(['left', 'right']).isRequired,
};

export function Euriel({
  position = [0, 0, 0],
  scale = 1,
  rotation = [0, 0, 0],
  isWalking = false,
}) {
  const groupRef = useRef(null);
  const bodyRef = useRef(null);
  const headRef = useRef(null);
  const leftEyeRef = useRef(null);
  const rightEyeRef = useRef(null);
  const leftHipRef = useRef(null);
  const rightHipRef = useRef(null);
  const leftKneeRef = useRef(null);
  const rightKneeRef = useRef(null);
  const leftShoulderRef = useRef(null);
  const rightShoulderRef = useRef(null);
  const leftElbowRef = useRef(null);
  const rightElbowRef = useRef(null);

  const materials = useMemo(() => ({
    skin: new THREE.MeshStandardMaterial({ color: '#dca57f', roughness: 0.88, metalness: 0 }),
    skinWarm: new THREE.MeshStandardMaterial({ color: '#c98568', roughness: 0.9, metalness: 0 }),
    jacket: new THREE.MeshStandardMaterial({ color: '#9b315f', roughness: 0.82, metalness: 0 }),
    jacketDark: new THREE.MeshStandardMaterial({ color: '#62243f', roughness: 0.86, metalness: 0 }),
    shirt: new THREE.MeshStandardMaterial({ color: '#ebc9a8', roughness: 0.9, metalness: 0 }),
    denim: new THREE.MeshStandardMaterial({ color: '#385978', roughness: 0.92, metalness: 0 }),
    denimDark: new THREE.MeshStandardMaterial({ color: '#263d57', roughness: 0.95, metalness: 0 }),
    hair: new THREE.MeshStandardMaterial({ color: '#38241f', roughness: 0.96, metalness: 0 }),
    boot: new THREE.MeshStandardMaterial({ color: '#4a3025', roughness: 0.93, metalness: 0 }),
    sole: new THREE.MeshStandardMaterial({ color: '#171719', roughness: 1, metalness: 0 }),
    eye: new THREE.MeshStandardMaterial({ color: '#f3eadf', roughness: 0.55, metalness: 0 }),
    pupil: new THREE.MeshBasicMaterial({ color: '#251915' }),
  }), []);
  useDisposableThreeResources(materials);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current || !bodyRef.current) return;
    const time = clock.elapsedTime;
    const phase = time * 7.2;
    const stride = isWalking ? Math.sin(phase) : 0;
    const opposite = -stride;
    const settle = isWalking ? 1 : Math.min(1, delta * 10);

    const setJoint = (joint, target, damping = 12) => {
      if (joint.current) joint.current.rotation.x = THREE.MathUtils.damp(joint.current.rotation.x, target, damping, delta);
    };

    setJoint(leftHipRef, stride * 0.58 * settle);
    setJoint(rightHipRef, opposite * 0.58 * settle);
    setJoint(leftKneeRef, isWalking ? Math.max(0, -stride) * 0.68 : 0);
    setJoint(rightKneeRef, isWalking ? Math.max(0, stride) * 0.68 : 0);
    setJoint(leftShoulderRef, opposite * 0.48 * settle);
    setJoint(rightShoulderRef, stride * 0.48 * settle);
    setJoint(leftElbowRef, isWalking ? -0.18 - Math.max(0, stride) * 0.16 : -0.08);
    setJoint(rightElbowRef, isWalking ? -0.18 - Math.max(0, -stride) * 0.16 : -0.08);

    const bobTarget = isWalking ? Math.abs(Math.sin(phase)) * 0.07 : Math.sin(time * 1.5) * 0.012;
    bodyRef.current.position.y = THREE.MathUtils.damp(bodyRef.current.position.y, bobTarget, 12, delta);
    bodyRef.current.rotation.z = THREE.MathUtils.damp(
      bodyRef.current.rotation.z,
      isWalking ? stride * 0.025 : 0,
      10,
      delta,
    );
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(time * 0.8) * (isWalking ? 0.025 : 0.055);
      headRef.current.rotation.z = isWalking ? -stride * 0.018 : 0;
    }

    const blinkCycle = time % 4.7;
    const eyeScale = blinkCycle < 0.1 ? Math.max(0.12, blinkCycle / 0.1) : 1;
    leftEyeRef.current?.scale.set(0.09, 0.115 * eyeScale, 0.045);
    rightEyeRef.current?.scale.set(0.09, 0.115 * eyeScale, 0.045);
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <group ref={bodyRef}>
        <group ref={headRef} position={[0, 3.13, 0]}>
          <mesh scale={[0.82, 1, 0.84]} castShadow>
            <sphereGeometry args={[0.43, 24, 18]} />
            <primitive object={materials.skin} attach="material" />
          </mesh>
          <mesh position={[0, 0.13, -0.14]} scale={[0.9, 0.72, 0.9]} castShadow>
            <sphereGeometry args={[0.45, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            <primitive object={materials.hair} attach="material" />
          </mesh>
          <mesh position={[-0.3, 0.02, -0.09]} scale={[0.18, 0.34, 0.13]} castShadow>
            <sphereGeometry args={[1, 12, 10]} />
            <primitive object={materials.hair} attach="material" />
          </mesh>
          <mesh position={[0.31, 0.02, -0.09]} scale={[0.18, 0.34, 0.13]} castShadow>
            <sphereGeometry args={[1, 12, 10]} />
            <primitive object={materials.hair} attach="material" />
          </mesh>
          <mesh position={[0.34, 0.2, -0.3]} scale={[0.24, 0.28, 0.24]} castShadow>
            <sphereGeometry args={[1, 14, 12]} />
            <primitive object={materials.hair} attach="material" />
          </mesh>
          <mesh ref={leftEyeRef} position={[-0.145, 0.055, 0.36]} scale={[0.09, 0.115, 0.045]}>
            <sphereGeometry args={[1, 14, 10]} />
            <primitive object={materials.eye} attach="material" />
          </mesh>
          <mesh ref={rightEyeRef} position={[0.145, 0.055, 0.36]} scale={[0.09, 0.115, 0.045]}>
            <sphereGeometry args={[1, 14, 10]} />
            <primitive object={materials.eye} attach="material" />
          </mesh>
          <mesh position={[-0.145, 0.045, 0.405]} scale={[0.035, 0.05, 0.02]}>
            <sphereGeometry args={[1, 10, 8]} />
            <primitive object={materials.pupil} attach="material" />
          </mesh>
          <mesh position={[0.145, 0.045, 0.405]} scale={[0.035, 0.05, 0.02]}>
            <sphereGeometry args={[1, 10, 8]} />
            <primitive object={materials.pupil} attach="material" />
          </mesh>
          <mesh position={[0, -0.05, 0.39]} rotation={[Math.PI / 2, 0, 0]} scale={[0.08, 0.12, 0.07]}>
            <coneGeometry args={[1, 1, 12]} />
            <primitive object={materials.skinWarm} attach="material" />
          </mesh>
          <mesh position={[0, -0.205, 0.385]} scale={[0.13, 0.035, 0.02]}>
            <sphereGeometry args={[1, 14, 8]} />
            <primitive object={materials.jacketDark} attach="material" />
          </mesh>
          <mesh position={[-0.39, -0.03, 0]} scale={[0.08, 0.13, 0.06]}>
            <sphereGeometry args={[1, 10, 8]} />
            <primitive object={materials.skinWarm} attach="material" />
          </mesh>
          <mesh position={[0.39, -0.03, 0]} scale={[0.08, 0.13, 0.06]}>
            <sphereGeometry args={[1, 10, 8]} />
            <primitive object={materials.skinWarm} attach="material" />
          </mesh>
        </group>

        <mesh position={[0, 2.68, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.17, 0.36, 14]} />
          <primitive object={materials.skin} attach="material" />
        </mesh>
        <mesh position={[0, 2.22, 0]} scale={[1.12, 1, 0.72]} castShadow>
          <capsuleGeometry args={[0.36, 0.72, 8, 16]} />
          <primitive object={materials.jacket} attach="material" />
        </mesh>
        <mesh position={[0, 2.23, 0.36]} scale={[0.44, 0.7, 0.08]}>
          <capsuleGeometry args={[0.33, 0.46, 6, 14]} />
          <primitive object={materials.shirt} attach="material" />
        </mesh>
        <mesh position={[0, 1.7, 0]} scale={[0.5, 0.22, 0.37]} castShadow>
          <sphereGeometry args={[1, 16, 10]} />
          <primitive object={materials.denim} attach="material" />
        </mesh>
        <mesh position={[0, 1.58, 0.38]}>
          <boxGeometry args={[0.68, 0.08, 0.05]} />
          <primitive object={materials.jacketDark} attach="material" />
        </mesh>

        <Arm side="left" shoulderRef={leftShoulderRef} elbowRef={leftElbowRef} materials={materials} />
        <Arm side="right" shoulderRef={rightShoulderRef} elbowRef={rightElbowRef} materials={materials} />
        <Leg side="left" hipRef={leftHipRef} kneeRef={leftKneeRef} materials={materials} />
        <Leg side="right" hipRef={rightHipRef} kneeRef={rightKneeRef} materials={materials} />
      </group>
    </group>
  );
}

Euriel.propTypes = {
  isWalking: PropTypes.bool,
  position: PropTypes.arrayOf(PropTypes.number),
  rotation: PropTypes.arrayOf(PropTypes.number),
  scale: PropTypes.number,
};
