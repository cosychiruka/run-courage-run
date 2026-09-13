/* eslint-disable react/no-unknown-property -- React Three Fiber JSX maps props to Three.js objects. */
import { useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import * as THREE from 'three';
import { WORLD_GROUND_RADIUS, WORLD_GROUND_Y } from './worldGround';

export function Terrain({ scene = 'evening' }) {
  const noiseBumpMap = useMemo(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imageData = ctx.createImageData(size, size);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const val = Math.random() * 255;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(80, 80);
    return tex;
  }, []);

  // Noon: canvas grass texture with yellowish speckles for natural lawn look
  const noonGrassTex = useMemo(() => {
    if (scene !== 'noon') return null;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(0, 0, size, size);
    // Yellowish grass patches
    const patches = [
      { color: '#8bc34a', count: 120, r: [4, 14] },
      { color: '#cddc39', count: 60,  r: [3, 10] },
      { color: '#388e3c', count: 80,  r: [5, 16] },
      { color: '#aed581', count: 50,  r: [3, 9]  },
    ];
    patches.forEach(({ color, count, r }) => {
      ctx.fillStyle = color;
      for (let i = 0; i < count; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = r[0] + Math.random() * (r[1] - r[0]);
        ctx.globalAlpha = 0.45 + Math.random() * 0.45;
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * (0.5 + Math.random() * 0.8), Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 40);
    return tex;
  }, [scene]);

  useEffect(() => { return () => { noiseBumpMap.dispose(); }; }, [noiseBumpMap]);
  useEffect(() => { return () => { noonGrassTex?.dispose(); }; }, [noonGrassTex]);

  let terrainColor = '#70129c'; // evening — purple/gothic
  if (scene === 'sunrise') terrainColor = '#5b9e35'; // dawn — fresh morning green
  if (scene === 'noon')    terrainColor = '#4caf50'; // noon — vivid bright green
  if (scene === 'midnight') terrainColor = '#1a0d33';

  return (
    <mesh receiveShadow position={[0, WORLD_GROUND_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[WORLD_GROUND_RADIUS, 64]} />
      <meshStandardMaterial
        color={terrainColor}
        map={noonGrassTex ?? undefined}
        roughness={1.0}
        metalness={0.0}
        bumpMap={noiseBumpMap}
        bumpScale={0.08}
      />
    </mesh>
  );
}

Terrain.propTypes = {
  scene: PropTypes.oneOf(['evening', 'midnight', 'sunrise', 'noon']),
};
