/* eslint-disable react/no-unknown-property -- React Three Fiber JSX maps props to Three.js objects. */
import { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { Instance, Instances } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PORTAL_THEME = {
  evening: { river: '#0b5060', glow: '#4fffe5', accent: '#ff4ec7', canopy: '#102d29' },
  midnight: { river: '#071e3a', glow: '#52eaff', accent: '#b04cff', canopy: '#071819' },
  sunrise: { river: '#4c9db0', glow: '#7effd0', accent: '#ff9b72', canopy: '#21452d' },
  noon: { river: '#2c91b1', glow: '#6dffd0', accent: '#ffd35d', canopy: '#245b32' },
};

function mulberry32(seed) {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function BackdropForest({ colors }) {
  const treeData = useMemo(() => {
    const random = mulberry32(7319);
    return Array.from({ length: 30 }, (_, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      const lane = Math.floor(index / 2);
      const x = side * (5.5 + random() * 21);
      const z = -15.5 - lane * 1.25 - random() * 4.5;
      const height = 4.8 + random() * 6;
      return {
        key: index,
        trunkPosition: [x, height * 0.5 - 0.3, z],
        trunkScale: [0.3 + height * 0.025, height, 0.3 + height * 0.025],
        crownPosition: [x, height + 0.15, z],
        crownScale: [1.45 + random(), 2.3 + random() * 1.6, 1.45 + random()],
        rotation: [0, random() * Math.PI, 0],
      };
    });
  }, []);

  return (
    <group name="forest-backdrop">
      <Instances limit={treeData.length}>
        <cylinderGeometry args={[1, 1.22, 1, 7]} />
        <meshStandardMaterial color="#30251f" roughness={1} flatShading />
        {treeData.map((tree) => (
          <Instance
            key={tree.key}
            position={tree.trunkPosition}
            scale={tree.trunkScale}
            rotation={tree.rotation}
          />
        ))}
      </Instances>
      <Instances limit={treeData.length}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={colors.canopy} roughness={1} flatShading />
        {treeData.map((tree) => (
          <Instance
            key={tree.key}
            position={tree.crownPosition}
            scale={tree.crownScale}
            rotation={tree.rotation}
          />
        ))}
      </Instances>
    </group>
  );
}

BackdropForest.propTypes = {
  colors: PropTypes.shape({ canopy: PropTypes.string.isRequired }).isRequired,
};

function River({ color }) {
  const materialRef = useRef(null);
  const geometry = useMemo(() => {
    const positions = [];
    const segments = 18;
    for (let index = 0; index < segments; index += 1) {
      const z0 = -11.5 - index * 1.25;
      const z1 = -11.5 - (index + 1) * 1.25;
      const center0 = Math.sin(index * 0.48) * 1.4;
      const center1 = Math.sin((index + 1) * 0.48) * 1.4;
      const halfWidth0 = 2.2 + index * 0.1;
      const halfWidth1 = 2.2 + (index + 1) * 0.1;
      positions.push(
        center0 - halfWidth0, 0.04, z0,
        center0 + halfWidth0, 0.04, z0,
        center1 + halfWidth1, 0.02, z1,
        center0 - halfWidth0, 0.04, z0,
        center1 + halfWidth1, 0.02, z1,
        center1 - halfWidth1, 0.02, z1,
      );
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    buffer.computeVertexNormals();
    return buffer;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    materialRef.current.emissiveIntensity = 0.1 + Math.sin(clock.elapsedTime * 1.4) * 0.035;
  });

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshPhysicalMaterial
        ref={materialRef}
        color={color}
        emissive={color}
        emissiveIntensity={0.1}
        roughness={0.18}
        metalness={0.08}
        clearcoat={0.82}
        clearcoatRoughness={0.2}
        transparent
        opacity={0.84}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

River.propTypes = {
  color: PropTypes.string.isRequired,
};

function SignalTrail({ glow }) {
  const groupRef = useRef(null);
  const shards = useMemo(() => Array.from({ length: 11 }, (_, index) => {
    const progress = index / 10;
    return {
      key: index,
      position: [Math.sin(index * 0.72) * (0.4 + progress), 0.2, -5.8 - index * 1.12],
      scale: [0.24 - progress * 0.055, 0.08, 0.33 - progress * 0.07],
      rotation: [0, index * 0.68, 0],
    };
  }), []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.4) * 0.07;
    groupRef.current.scale.set(pulse, 1, pulse);
  });

  return (
    <group ref={groupRef} name="courage-signal-trail">
      <Instances limit={shards.length}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.7} roughness={0.25} />
        {shards.map((shard) => (
          <Instance
            key={shard.key}
            position={shard.position}
            scale={shard.scale}
            rotation={shard.rotation}
          />
        ))}
      </Instances>
    </group>
  );
}

SignalTrail.propTypes = {
  glow: PropTypes.string.isRequired,
};

function Portal({ colors }) {
  const portalRef = useRef(null);
  const outerRingRef = useRef(null);
  const innerRingRef = useRef(null);
  const particleRef = useRef(null);
  const lightRef = useRef(null);
  const particleGeometry = useMemo(() => {
    const random = mulberry32(90210);
    const positions = [];
    for (let index = 0; index < 44; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = 1.6 + random() * 1.65;
      positions.push(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        (random() - 0.5) * 0.7,
      );
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return buffer;
  }, []);

  useEffect(() => () => particleGeometry.dispose(), [particleGeometry]);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    if (portalRef.current) portalRef.current.position.y = 2.85 + Math.sin(time * 0.9) * 0.09;
    if (outerRingRef.current) outerRingRef.current.rotation.z = time * 0.19;
    if (innerRingRef.current) innerRingRef.current.rotation.z = -time * 0.34;
    if (particleRef.current) {
      particleRef.current.rotation.z = -time * 0.12;
      particleRef.current.scale.setScalar(0.95 + Math.sin(time * 1.8) * 0.06);
    }
    if (lightRef.current) lightRef.current.intensity = 1.65 + Math.sin(time * 2.1) * 0.28;
  });

  return (
    <group ref={portalRef} position={[0, 2.85, -20.7]} name="river-portal">
      <mesh position={[0, 0, -0.12]}>
        <circleGeometry args={[2.05, 40]} />
        <meshBasicMaterial color="#10134a" transparent opacity={0.72} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={outerRingRef}>
        <torusGeometry args={[2.34, 0.24, 10, 48]} />
        <meshStandardMaterial color={colors.glow} emissive={colors.glow} emissiveIntensity={2.2} roughness={0.25} />
      </mesh>
      <mesh ref={innerRingRef} rotation={[0, 0, 0.45]}>
        <torusKnotGeometry args={[1.75, 0.075, 72, 8, 2, 5]} />
        <meshBasicMaterial color={colors.accent} transparent opacity={0.78} />
      </mesh>
      <points ref={particleRef} geometry={particleGeometry}>
        <pointsMaterial color={colors.glow} size={0.09} sizeAttenuation transparent opacity={0.88} depthWrite={false} />
      </points>
      <pointLight ref={lightRef} color={colors.glow} intensity={1.7} distance={13} decay={2} />
    </group>
  );
}

Portal.propTypes = {
  colors: PropTypes.shape({
    accent: PropTypes.string.isRequired,
    glow: PropTypes.string.isRequired,
  }).isRequired,
};

function GodRays({ glow }) {
  return (
    <group name="forest-god-rays">
      {[-7.5, 0.5, 8].map((x, index) => (
        <mesh key={x} position={[x, 9.8 + index, -19 - index * 2]} rotation={[0, 0, (index - 1) * 0.08]}>
          <coneGeometry args={[2.4 + index * 0.4, 18, 12, 1, true]} />
          <meshBasicMaterial
            color={glow}
            transparent
            opacity={0.035}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

GodRays.propTypes = {
  glow: PropTypes.string.isRequired,
};

export function ForestPortal({ scene = 'evening' }) {
  const colors = PORTAL_THEME[scene] || PORTAL_THEME.evening;
  return (
    <group name="portal-clearing">
      <BackdropForest colors={colors} />
      <River color={colors.river} />
      <SignalTrail glow={colors.glow} />
      <Portal colors={colors} />
      {scene !== 'noon' && <GodRays glow={colors.glow} />}
    </group>
  );
}

ForestPortal.propTypes = {
  scene: PropTypes.oneOf(['evening', 'midnight', 'sunrise', 'noon']),
};
