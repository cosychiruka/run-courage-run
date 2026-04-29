import React, { useMemo } from 'react';
import * as THREE from 'three';

export function Terrain() {
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

  return (
    <mesh receiveShadow position={[0, -99.5, 0]}>
      <sphereGeometry args={[100, 32, 32]} />
      <meshStandardMaterial
        color="#70129c"
        roughness={1.0}
        metalness={0.0}
        bumpMap={noiseBumpMap}
        bumpScale={0.12}
      />
    </mesh>
  );
}
