import { useState, useRef, useCallback } from 'react';
import * as THREE from 'three';

/**
 * useSelfie — shared Monster Selfie state machine.
 * Used by DiscoWorld3D (ghost head) and SunriseWorld3D (fly head).
 *
 * phases: 'idle' | 'processing' | 'confirm' | 'active' | 'removing'
 */
export function useSelfie({ autoRemoveMs = 10 * 60 * 1000 } = {}) {
  const [phase, setPhase] = useState('idle');
  const [texture, setTexture] = useState(null);
  const [label, setLabel] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

  const fileInputRef = useRef(null);
  const autoRemoveTimerRef = useRef(null);

  /** Open file picker (or camera on mobile) */
  const openPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /** Process the raw File object → canvas crop → THREE texture */
  const processFile = useCallback((file) => {
    if (!file) return;
    setPhase('processing');

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Pink ghost background
      ctx.fillStyle = '#ff99dd';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();

      // Center-crop + slight upward bias to capture face
      const srcSize = Math.min(img.width, img.height);
      const srcX = (img.width - srcSize) / 2;
      const srcY = (img.height - srcSize) * 0.28; // 28% from top = faces tend to be here

      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, size, size);
      ctx.restore();

      // White border ring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2);
      ctx.stroke();

      // Pink accent ring
      ctx.strokeStyle = '#ff00cc';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.stroke();

      URL.revokeObjectURL(url);

      const dataUrl = canvas.toDataURL('image/png');
      setPreviewUrl(dataUrl);

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      setTexture(tex);
      setPhase('confirm');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      setPhase('idle');
    };

    img.src = url;
  }, []);

  /** Confirm + name → go active */
  const activate = useCallback(() => {
    setLabel(nameInput.trim() || 'YOU');
    setPhase('active');
    clearTimeout(autoRemoveTimerRef.current);
    autoRemoveTimerRef.current = setTimeout(() => remove(), autoRemoveMs);
  }, [nameInput, autoRemoveMs]);

  /** Graceful remove with fade */
  const remove = useCallback(() => {
    setPhase('removing');
    clearTimeout(autoRemoveTimerRef.current);
    setTimeout(() => {
      setTexture(null);
      setLabel('');
      setNameInput('');
      setPreviewUrl(null);
      setPhase('idle');
    }, 600);
  }, []);

  /** Retake — back to idle without clearing texture until new one comes */
  const retake = useCallback(() => {
    setTexture(null);
    setPreviewUrl(null);
    setPhase('idle');
  }, []);

  return {
    phase,
    texture,
    label,
    nameInput,
    previewUrl,
    setNameInput,
    fileInputRef,
    openPicker,
    processFile,
    activate,
    remove,
    retake,
    isActive: phase === 'active' || phase === 'removing',
  };
}
