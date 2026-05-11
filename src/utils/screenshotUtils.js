/**
 * screenshotUtils.js
 * Canvas-based card generators, screenshot capture, and share utilities.
 * No external dependencies — pure Canvas 2D API + Web Share API.
 */

/** Load an image from a URL/dataURL into an HTMLImageElement */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Capture the active WebGL canvas, respecting original aspect ratio (no squeezing),
 * then composite a selfie face and share via Web Share API or download.
 */
export async function captureAndShareSelfie({ previewUrl, label, worldName, monsterEmoji = '👻', tweetText }) {
  const glCanvas = document.querySelector('.world3d-overlay canvas');

  // 1. High-Res Card Setup (1280x720 for professional HD quality)
  const W = 1280, H = 720;
  const card = document.createElement('canvas');
  card.width = W; card.height = H;
  const ctx = card.getContext('2d', { alpha: false });

  // 2. Game screenshot with World-Class Aspect Ratio Handling (Center-Crop)
  if (glCanvas) {
    try {
      const sw = glCanvas.width;
      const sh = glCanvas.height;
      const sRatio = sw / sh;
      const tRatio = W / H;

      let dx, dy, dw, dh, sx, sy, sWidth, sHeight;

      if (sRatio > tRatio) {
        // Source is wider than target (e.g. 21:9 ultra-wide) -> crop sides
        sHeight = sh;
        sWidth = sh * tRatio;
        sx = (sw - sWidth) / 2;
        sy = 0;
      } else {
        // Source is taller than target (e.g. mobile 19:9) -> crop top/bottom
        sWidth = sw;
        sHeight = sw / tRatio;
        sx = 0;
        sy = (sh - sHeight) / 2;
      }

      // Draw high-quality center-cropped background
      ctx.drawImage(glCanvas, sx, sy, sWidth, sHeight, 0, 0, W, H);
      
      // Subtle vignette for depth
      const grad = ctx.createRadialGradient(W/2, H/2, W/4, W/2, H/2, W/1.2);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

    } catch (e) {
      console.error("[SCREENSHOT] Capture failed:", e);
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#1a0a2e'); g.addColorStop(1, '#0d0820');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }

  // 3. Selfie circle overlay (larger, higher fidelity)
  if (previewUrl) {
    try {
      const size = 220;
      const x = W - size - 40, y = 40;
      const selfieImg = await loadImage(previewUrl);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(selfieImg, x, y, size, size);
      ctx.restore();
      
      // Neon Pink border
      ctx.strokeStyle = '#eb57c1';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.stroke();
    } catch { /* skip selfie */ }
  }

  // 4. Premium Branding Strip
  const stripH = 80;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, H - stripH, W, stripH);
  
  // Decorative line
  ctx.fillStyle = '#eb57c1';
  ctx.fillRect(0, H - stripH, W, 4);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Outfit", "Inter", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(`${monsterEmoji} ${label || 'Monster'} in Courage's World`, 40, H - (stripH / 2));
  
  ctx.textAlign = 'right';
  ctx.fillStyle = '#eb57c1';
  ctx.font = 'bold 24px "Outfit", sans-serif';
  ctx.fillText('@RunCourageRun', W - 40, H - (stripH / 2));

  // 5. Native Share or Download
  const filename = `monster-selfie-${Date.now()}.png`;
  const shareText = tweetText || `${monsterEmoji} I became a monster at ${worldName}! @runcouragerun #CourageRunRun`;

  return new Promise((resolve) => {
    card.toBlob(async (blob) => {
      if (!blob) { resolve(); return; }

      const file = new File([blob], filename, { type: 'image/png' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Monster Selfie',
            text: shareText,
          });
          resolve();
          return;
        } catch (e) {
          // Fall through on cancel/fail
        }
      }

      // Desktop/Fallback
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      setTimeout(() => {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
      }, 800);

      resolve();
    }, 'image/png', 0.95); // High quality PNG
  });
}

const CARD_W = 800;
const CARD_H = 420;
const PAD = 32;
const BRAND_H = 48;

/** Wrap text to fit within maxWidth, returns array of lines */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Draw the article card to a canvas and trigger a PNG download.
 * Matches the 'The Courageous Chronicle' newspaper aesthetic.
 */
/**
 * Draw the article card to a canvas and trigger a PNG download.
 * Matches the 'The Courageous Chronicle' newspaper aesthetic (Straight, High-Quality).
 */
export async function downloadArticleCard(article, emotion = 'neutral') {
  const canvas = document.createElement('canvas');
  const W = 1000, H = 1200, PAD = 40;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const BANNER_H = 60, FOOTER_H = 70;
  const PINK     = '#eb57c1', BG_PAPER = '#e6e1d7', BG_DARK  = '#22252d';

  // 1. Paper Background
  ctx.fillStyle = BG_PAPER;
  ctx.fillRect(0, 0, W, H);

  // 2. Top Banner
  ctx.fillStyle = BG_DARK;
  ctx.fillRect(0, 0, W, BANNER_H);
  ctx.fillStyle = PINK;
  ctx.font = 'bold 22px "Comic Sans MS", cursive';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('[#News4Pluckies]  '.repeat(10), 20, BANNER_H / 2);

  // 3. Heading Section (Full Width)
  let cy = BANNER_H + 30;
  ctx.fillStyle = '#040404';
  ctx.textBaseline = 'top';
  
  // Left: Extra!
  ctx.font = 'bold 28px Serif';
  ctx.fillText('EXTRA!\nEXTRA!', PAD, cy);

  // Center: Title
  ctx.textAlign = 'center';
  ctx.font = 'bold 52px Serif';
  ctx.fillText('The Courageous Chronicle', W/2, cy);
  ctx.font = '20px Serif';
  ctx.fillStyle = '#444';
  ctx.fillText('The Worlds Bravest Newspaper', W/2, cy + 65);

  // Right: Edition
  const h = new Date().getHours();
  let ed = 'MORNING', icon = '🌅';
  if (h >= 11 && h < 17) { ed = 'AFTERNOON'; icon = '☀️'; }
  else if (h >= 17 && h < 21) { ed = 'EVENING'; icon = '🌆'; }
  else if (h < 5 || h >= 21) { ed = 'LATE'; icon = '🌙'; }
  
  ctx.textAlign = 'right';
  ctx.fillStyle = '#040404';
  ctx.font = '24px Serif';
  ctx.fillText(`${icon}\n${ed}\nFINAL`, W - PAD, cy);

  cy += 130;
  ctx.strokeStyle = '#040404';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(PAD, cy); ctx.lineTo(W - PAD, cy); ctx.stroke();
  cy += 10;
  ctx.fillStyle = PINK;
  ctx.font = 'bold 18px Serif';
  ctx.textAlign = 'left';
  ctx.fillText('NOWHERE NEWS', PAD, cy);
  cy += 30;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PAD, cy); ctx.lineTo(W - PAD, cy); ctx.stroke();
  cy += 30;

  // 4. Middle Section: 2 Columns
  const colW = (W - PAD * 3) / 2;
  
  // Left: Image
  const imgUrl = article.image || 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/1145795/paperboy.jpg';
  try {
    const img = await loadImage(imgUrl);
    const scale = Math.max(colW / img.width, colW / img.height);
    const nw = img.width * scale, nh = img.height * scale;
    const xo = (nw - colW) / 2, yo = (nh - colW) / 2;
    ctx.drawImage(img, xo / scale, yo / scale, colW / scale, colW / scale, PAD, cy, colW, colW);
    ctx.strokeStyle = '#040404'; ctx.lineWidth = 3;
    ctx.strokeRect(PAD, cy, colW, colW);
  } catch (e) {
    ctx.fillStyle = '#2a2a32'; ctx.fillRect(PAD, cy, colW, colW);
    ctx.fillStyle = PINK; ctx.textAlign = 'center'; ctx.fillText('NOWHERE NEWS', PAD + colW/2, cy + colW/2);
  }

  // Right: Content
  const rx = PAD + colW + PAD;
  let ry = cy;
  ctx.textAlign = 'left'; ctx.fillStyle = '#040404'; ctx.font = 'bold 34px Serif';
  const headlineLines = wrapText(ctx, (article.title || '').toUpperCase(), colW);
  headlineLines.slice(0, 4).forEach(line => {
    ctx.fillText(line, rx, ry);
    ry += 42;
  });

  ctx.fillStyle = PINK; ctx.font = 'bold 65px "Comic Sans MS", cursive';
  ctx.fillText('!!!', rx, ry);
  ry += 80;

  ctx.strokeStyle = '#444'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + colW, ry); ctx.stroke();
  ry += 20;

  ctx.fillStyle = '#333'; ctx.font = '20px Serif';
  const descLines = wrapText(ctx, article.description || article.content || '', colW);
  descLines.slice(0, 15).forEach(line => {
    if (ry > H - 100) return;
    ctx.fillText(line, rx, ry);
    ry += 28;
  });

  // 5. Footer
  ctx.fillStyle = BG_DARK; ctx.fillRect(0, H - FOOTER_H, W, FOOTER_H);
  ctx.fillStyle = PINK; ctx.font = 'bold 18px "Comic Sans MS", cursive';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('THE THINGS I DO FOR YOU PEOPLE... — COURAGE', W/2, H - FOOTER_H/2);

  // ── Trigger download ──────────────────────────────────────────────────────
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = (article.title || 'courage-chronicle').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    a.href = url; a.download = `${slug}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}
