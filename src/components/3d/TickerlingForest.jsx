/* eslint-disable react/no-unknown-property -- React Three Fiber JSX maps props to Three.js objects. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Html, Instance, Instances } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTrendingTokens } from '../../hooks/useTrendingTokens';
import { resolveTokenLogoUrl } from '../../services/tokenService';
import './TickerlingForest.css';

const HERO_BUSHES = [
  { id: 'porch-west', position: [-9.2, -0.35, 3.2], scale: 1.08, tint: 0 },
  { id: 'road-east', position: [9.4, -0.4, 4.6], scale: 1.15, tint: 1 },
  { id: 'windmill-path', position: [10.8, -0.55, -5.8], scale: 0.95, tint: 2 },
  { id: 'back-fence', position: [-10.6, -0.52, -5.5], scale: 1.02, tint: 1 },
  { id: 'north-glade', position: [-5.7, -0.72, -11.8], scale: 0.9, tint: 2 },
  { id: 'river-turn', position: [6.8, -0.75, -12.4], scale: 0.96, tint: 0 },
  { id: 'far-west', position: [-15.2, -1.15, -8.8], scale: 0.82, tint: 0 },
  { id: 'far-east', position: [15.6, -1.25, -9.7], scale: 0.84, tint: 2 },
];

const CLUMPS = [
  { position: [-1.18, 0.34, 0], scale: [0.82, 0.64, 0.7], rotation: [0.1, 0.2, -0.12] },
  { position: [-0.62, 0.62, -0.08], scale: [0.95, 0.78, 0.8], rotation: [-0.1, -0.3, 0.08] },
  { position: [0, 0.72, -0.16], scale: [1.08, 0.88, 0.88], rotation: [0.15, 0.1, -0.04] },
  { position: [0.67, 0.58, -0.06], scale: [0.98, 0.75, 0.78], rotation: [-0.08, 0.4, 0.1] },
  { position: [1.2, 0.32, 0], scale: [0.78, 0.6, 0.68], rotation: [0.12, -0.2, 0.14] },
  { position: [-0.92, 0.12, 0.35], scale: [0.96, 0.58, 0.75], rotation: [-0.12, 0.5, -0.08] },
  { position: [-0.28, 0.22, 0.44], scale: [1.12, 0.62, 0.82], rotation: [0.08, -0.2, 0.02] },
  { position: [0.46, 0.2, 0.42], scale: [1.08, 0.6, 0.8], rotation: [-0.08, 0.25, -0.04] },
  { position: [1.02, 0.08, 0.28], scale: [0.88, 0.52, 0.7], rotation: [0.1, -0.4, 0.06] },
];

const THEME = {
  evening: {
    leaf: ['#153d2c', '#1f5637', '#2b6841'],
    cavity: '#050a08',
    eyes: '#caff62',
    glow: '#8cff4f',
  },
  sunrise: {
    leaf: ['#285b32', '#35733c', '#43884a'],
    cavity: '#07130b',
    eyes: '#f3ff9a',
    glow: '#c8ff68',
  },
  noon: {
    leaf: ['#1f5d32', '#2f783e', '#45954c'],
    cavity: '#07140a',
    eyes: '#e9ff96',
    glow: '#b8ff52',
  },
};

const TOKEN_SHAPE = PropTypes.shape({
  logo_url: PropTypes.string,
  name: PropTypes.string,
  symbol: PropTypes.string,
  token_address: PropTypes.string,
});

function smoothStep(value) {
  return value * value * (3 - 2 * value);
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSessionSeed() {
  const key = 'courage_tickerling_seed_v1';
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const seed = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    window.sessionStorage.setItem(key, seed);
    return seed;
  } catch {
    return `${Date.now()}-${Math.random()}`;
  }
}

function assignTokens(tokens, seed, bushes) {
  if (!tokens.length) return new Map();
  const shuffled = [...tokens].sort((left, right) => (
    hashText(`${seed}:${left.token_address}`) - hashText(`${seed}:${right.token_address}`)
  ));
  return new Map(bushes.map((bush, index) => [bush.id, shuffled[index % shuffled.length]]));
}

function TokenMonsterFace({ active, token, glowColor }) {
  const faceRef = useRef(null);
  const logoUrl = resolveTokenLogoUrl(token);

  useFrame(({ clock }) => {
    if (!faceRef.current || !active) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 9) * 0.035;
    faceRef.current.scale.setScalar(pulse);
    faceRef.current.rotation.z = Math.sin(clock.elapsedTime * 6) * 0.045;
  });

  if (!active) return null;

  return (
    <group ref={faceRef} position={[0, 1.02, 0.56]}>
      <pointLight color={glowColor} intensity={1.2} distance={4.5} decay={2} />
      <mesh position={[0, 0, -0.04]}>
        <circleGeometry args={[0.62, 24]} />
        <meshStandardMaterial color="#101914" roughness={0.42} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0, -0.09]}>
        <ringGeometry args={[0.62, 0.74, 28]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.72} side={THREE.DoubleSide} />
      </mesh>
      <Html transform center sprite distanceFactor={7.5} position={[0, 0, 0.03]} style={{ pointerEvents: 'none' }}>
        <div className="tickerling-face" role="status" aria-live="polite">
          {logoUrl ? (
            <img src={logoUrl} alt="" draggable="false" />
          ) : (
            <span className="tickerling-signal-rune" aria-hidden="true">C</span>
          )}
          <span className="tickerling-brow tickerling-brow-left" />
          <span className="tickerling-brow tickerling-brow-right" />
          <span className="tickerling-pupil tickerling-pupil-left" />
          <span className="tickerling-pupil tickerling-pupil-right" />
          <span className="tickerling-mouth" />
          <span className="tickerling-name">{token?.symbol || 'SIGNAL LOST'}</span>
        </div>
      </Html>
    </group>
  );
}

TokenMonsterFace.propTypes = {
  active: PropTypes.bool.isRequired,
  glowColor: PropTypes.string.isRequired,
  token: TOKEN_SHAPE,
};

function TickerlingBush({ bush, index, active, activationKey, token, colors, register, trigger }) {
  const rootRef = useRef(null);
  const leafRef = useRef(null);
  const eyeRigRef = useRef(null);
  const leftEyeRef = useRef(null);
  const rightEyeRef = useRef(null);
  const activeStartRef = useRef(null);
  const baseScale = bush.scale;

  const setRootRef = useCallback((node) => {
    rootRef.current = node;
    register(index, node);
  }, [index, register]);

  useEffect(() => {
    if (active) activeStartRef.current = null;
  }, [active, activationKey]);

  useFrame(({ camera, clock }) => {
    if (!rootRef.current || !leafRef.current || !eyeRigRef.current) return;
    const time = clock.elapsedTime;
    const blinkCycle = (time + index * 1.73) % (3.4 + (index % 3) * 0.65);
    const blink = blinkCycle > 0.09 ? 1 : Math.max(0.08, blinkCycle / 0.09);
    leftEyeRef.current?.scale.set(0.23, 0.29 * blink, 0.12);
    rightEyeRef.current?.scale.set(0.23, 0.29 * blink, 0.12);

    eyeRigRef.current.lookAt(camera.position);
    const idle = Math.sin(time * 0.75 + index) * 0.012;
    let squash = 0;
    let surprise = 0;
    if (active) {
      if (activeStartRef.current === null) activeStartRef.current = time;
      const elapsed = time - activeStartRef.current;
      const attack = smoothStep(THREE.MathUtils.clamp(elapsed / 0.24, 0, 1));
      const release = 1 - smoothStep(THREE.MathUtils.clamp((elapsed - 1.45) / 0.48, 0, 1));
      surprise = attack * release;
      squash = Math.sin(Math.min(elapsed / 0.24, 1) * Math.PI) * 0.15;
    }

    leafRef.current.scale.set(
      baseScale * (1 + squash),
      baseScale * (1 - squash * 0.65 + idle),
      baseScale * (1 + squash * 0.42),
    );
    eyeRigRef.current.position.y = 0.58 + surprise * 0.38;
    eyeRigRef.current.position.z = 0.58 + surprise * 0.16;
  });

  return (
    <group
      ref={setRootRef}
      position={bush.position}
      onClick={(event) => {
        event.stopPropagation();
        trigger(bush.id);
      }}
    >
      <group ref={leafRef} scale={baseScale}>
        <Instances limit={CLUMPS.length} castShadow receiveShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={colors.leaf[bush.tint]}
            roughness={0.94}
            metalness={0}
            flatShading
          />
          {CLUMPS.map((clump, clumpIndex) => (
            <Instance
              key={clumpIndex}
              position={clump.position}
              scale={clump.scale}
              rotation={clump.rotation}
            />
          ))}
        </Instances>
      </group>

      <group ref={eyeRigRef} position={[0, 0.58, 0.58]}>
        <mesh position={[0, -0.02, -0.07]} scale={[1.08, 0.58, 0.24]}>
          <sphereGeometry args={[0.52, 16, 10]} />
          <meshStandardMaterial color={colors.cavity} roughness={1} />
        </mesh>
        <mesh ref={leftEyeRef} position={[-0.25, 0.02, 0.18]} scale={[0.23, 0.29, 0.12]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color={colors.eyes} emissive={colors.eyes} emissiveIntensity={0.55} />
        </mesh>
        <mesh ref={rightEyeRef} position={[0.25, 0.02, 0.18]} scale={[0.23, 0.29, 0.12]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color={colors.eyes} emissive={colors.eyes} emissiveIntensity={0.55} />
        </mesh>
        <mesh position={[-0.25, 0.02, 0.3]} scale={[0.075, 0.1, 0.04]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshBasicMaterial color="#06100a" />
        </mesh>
        <mesh position={[0.25, 0.02, 0.3]} scale={[0.075, 0.1, 0.04]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshBasicMaterial color="#06100a" />
        </mesh>
        <TokenMonsterFace active={active} token={token} glowColor={colors.glow} />
      </group>
    </group>
  );
}

TickerlingBush.propTypes = {
  activationKey: PropTypes.number.isRequired,
  active: PropTypes.bool.isRequired,
  bush: PropTypes.shape({
    id: PropTypes.string.isRequired,
    position: PropTypes.arrayOf(PropTypes.number).isRequired,
    scale: PropTypes.number.isRequired,
    tint: PropTypes.number.isRequired,
  }).isRequired,
  colors: PropTypes.shape({
    cavity: PropTypes.string.isRequired,
    eyes: PropTypes.string.isRequired,
    glow: PropTypes.string.isRequired,
    leaf: PropTypes.arrayOf(PropTypes.string).isRequired,
  }).isRequired,
  index: PropTypes.number.isRequired,
  register: PropTypes.func.isRequired,
  token: TOKEN_SHAPE,
  trigger: PropTypes.func.isRequired,
};

function FarBushRing({ colors }) {
  const clumps = useMemo(() => {
    const generated = [];
    for (let bushIndex = 0; bushIndex < 18; bushIndex += 1) {
      const angle = (bushIndex / 18) * Math.PI * 2 + 0.18;
      const radius = 23 + (bushIndex % 3) * 3.2;
      const centerX = Math.sin(angle) * radius;
      const centerZ = Math.cos(angle) * radius;
      const groundY = 0.2 - (radius * radius) / 210;
      const scale = 0.72 + (bushIndex % 4) * 0.06;
      [-0.72, 0, 0.72].forEach((offset, clumpIndex) => {
        generated.push({
          key: `${bushIndex}-${clumpIndex}`,
          position: [centerX + offset * scale, groundY + (clumpIndex === 1 ? 0.42 : 0.18), centerZ],
          scale: [0.88 * scale, (clumpIndex === 1 ? 0.68 : 0.52) * scale, 0.72 * scale],
          rotation: [0, angle + clumpIndex * 0.4, (clumpIndex - 1) * 0.1],
        });
      });
    }
    return generated;
  }, []);

  return (
    <Instances limit={clumps.length}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={colors.leaf[0]} roughness={1} flatShading />
      {clumps.map((clump) => (
        <Instance
          key={clump.key}
          position={clump.position}
          scale={clump.scale}
          rotation={clump.rotation}
        />
      ))}
    </Instances>
  );
}

FarBushRing.propTypes = {
  colors: PropTypes.shape({
    leaf: PropTypes.arrayOf(PropTypes.string).isRequired,
  }).isRequired,
};

export function TickerlingForest({ scene = 'evening' }) {
  const { camera, gl } = useThree();
  const isMobile = useMemo(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent), []);
  const bushes = useMemo(() => HERO_BUSHES.slice(0, isMobile ? 4 : HERO_BUSHES.length), [isMobile]);
  const colors = THEME[scene] || THEME.evening;
  const { tokens } = useTrendingTokens(true);
  const [seed] = useState(createSessionSeed);
  const assignments = useMemo(() => assignTokens(tokens, seed, bushes), [bushes, seed, tokens]);
  const [encounter, setEncounter] = useState({ id: null, key: 0 });
  const bushRefs = useRef([]);
  const clearTimerRef = useRef(null);
  const explorationUntilRef = useRef(0);
  const attentionRef = useRef({ id: null, dwell: 0, sampledAt: 0 });
  const projectedRef = useRef(new THREE.Vector3());

  const register = useCallback((index, node) => {
    bushRefs.current[index] = node;
  }, []);

  const trigger = useCallback((id) => {
    window.clearTimeout(clearTimerRef.current);
    setEncounter((current) => ({ id, key: current.key + 1 }));
    clearTimerRef.current = window.setTimeout(() => {
      setEncounter((current) => ({ id: null, key: current.key }));
    }, 2_150);
  }, []);

  useEffect(() => {
    const markExploring = () => { explorationUntilRef.current = performance.now() + 8_000; };
    const canvas = gl.domElement;
    canvas.addEventListener('pointerdown', markExploring, { passive: true });
    canvas.addEventListener('wheel', markExploring, { passive: true });
    canvas.addEventListener('touchstart', markExploring, { passive: true });
    return () => {
      window.clearTimeout(clearTimerRef.current);
      canvas.removeEventListener('pointerdown', markExploring);
      canvas.removeEventListener('wheel', markExploring);
      canvas.removeEventListener('touchstart', markExploring);
    };
  }, [gl]);

  useFrame(() => {
    const now = performance.now();
    if (encounter.id || now > explorationUntilRef.current || now - attentionRef.current.sampledAt < 110) return;
    attentionRef.current.sampledAt = now;

    let candidate = null;
    let closestToCenter = Number.POSITIVE_INFINITY;
    bushRefs.current.forEach((bush, index) => {
      if (!bush) return;
      const projected = projectedRef.current;
      bush.getWorldPosition(projected);
      if (camera.position.distanceTo(projected) > 42) return;
      projected.project(camera);
      if (projected.z < -1 || projected.z > 1) return;
      const centerDistance = Math.hypot(projected.x, projected.y * 0.85);
      if (centerDistance < 0.28 && centerDistance < closestToCenter) {
        closestToCenter = centerDistance;
        candidate = bushes[index]?.id || null;
      }
    });

    if (!candidate) {
      attentionRef.current.id = null;
      attentionRef.current.dwell = 0;
      return;
    }
    if (attentionRef.current.id !== candidate) {
      attentionRef.current.id = candidate;
      attentionRef.current.dwell = 0;
      return;
    }

    attentionRef.current.dwell += 0.11;
    if (attentionRef.current.dwell >= 0.55) {
      attentionRef.current.id = null;
      attentionRef.current.dwell = 0;
      explorationUntilRef.current = 0;
      trigger(candidate);
    }
  });

  return (
    <group name="tickerling-forest">
      <FarBushRing colors={colors} />
      {bushes.map((bush, index) => (
        <TickerlingBush
          key={bush.id}
          bush={bush}
          index={index}
          colors={colors}
          active={encounter.id === bush.id}
          activationKey={encounter.key}
          token={assignments.get(bush.id)}
          register={register}
          trigger={trigger}
        />
      ))}
    </group>
  );
}

TickerlingForest.propTypes = {
  scene: PropTypes.oneOf(['evening', 'midnight', 'sunrise', 'noon']),
};
