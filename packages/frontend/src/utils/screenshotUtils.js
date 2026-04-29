/**
 * screenshotUtils.js
 * Canvas-based news article card generator + download trigger.
 * No external dependencies — pure Canvas 2D API.
 */

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
 * @param {object} article  - { title, description, content, source, publishedAt }
 * @param {string} [emotion] - 'happy' | 'scared' | 'neutral'
 */
export function downloadArticleCard(article, emotion = 'neutral') {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');

  // ── Background gradient ──────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bgGrad.addColorStop(0, '#0d0820');
  bgGrad.addColorStop(1, '#1a0a2e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ── Purple border glow ───────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(153, 69, 255, 0.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, CARD_W - 4, CARD_H - 4);

  // ── Brand bar (top) ──────────────────────────────────────────────────────
  const brandGrad = ctx.createLinearGradient(0, 0, CARD_W, 0);
  brandGrad.addColorStop(0, '#9945FF');
  brandGrad.addColorStop(1, '#14F195');
  ctx.fillStyle = brandGrad;
  ctx.fillRect(0, 0, CARD_W, BRAND_H);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Comic Sans MS", cursive';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('$RCR  ·  The Daily Trenches', PAD, BRAND_H / 2);

  // Emotion tag top-right
  const emojiMap = { happy: '🚀 WAGMI', scared: '😱 NGMI', neutral: '🐕 chillin' };
  const emoTag = emojiMap[emotion] || emojiMap.neutral;
  ctx.textAlign = 'right';
  ctx.fillText(emoTag, CARD_W - PAD, BRAND_H / 2);

  // ── Headline ─────────────────────────────────────────────────────────────
  const headlineY = BRAND_H + PAD;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ff79c6';
  ctx.font = 'bold 24px "Comic Sans MS", cursive';

  const maxHeadlineW = CARD_W - PAD * 2;
  const headlineLines = wrapText(ctx, article.title || 'Untitled', maxHeadlineW);
  const maxLines = 3;
  let hy = headlineY;
  headlineLines.slice(0, maxLines).forEach((line, i) => {
    if (i === maxLines - 1 && headlineLines.length > maxLines) {
      // truncate last visible line with ellipsis
      let truncated = line;
      while (ctx.measureText(truncated + '…').width > maxHeadlineW && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
      }
      ctx.fillText(truncated + '…', PAD, hy);
    } else {
      ctx.fillText(line, PAD, hy);
    }
    hy += 30;
  });

  // ── Divider ──────────────────────────────────────────────────────────────
  const divY = hy + 10;
  ctx.strokeStyle = 'rgba(153, 69, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, divY);
  ctx.lineTo(CARD_W - PAD, divY);
  ctx.stroke();

  // ── Body text ─────────────────────────────────────────────────────────────
  const bodyY = divY + 14;
  const bodyText = (article.description || article.content || '').slice(0, 400);
  ctx.fillStyle = '#e0d6f5';
  ctx.font = '15px "Comic Sans MS", cursive';
  const bodyLines = wrapText(ctx, bodyText || 'No description available.', maxHeadlineW);
  const bodyMaxLines = 5;
  let by = bodyY;
  bodyLines.slice(0, bodyMaxLines).forEach((line, i) => {
    if (i === bodyMaxLines - 1 && bodyLines.length > bodyMaxLines) {
      let truncated = line;
      while (ctx.measureText(truncated + '…').width > maxHeadlineW && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
      }
      ctx.fillText(truncated + '…', PAD, by);
    } else {
      ctx.fillText(line, PAD, by);
    }
    by += 22;
  });

  // ── Source + timestamp (bottom bar) ──────────────────────────────────────
  const footY = CARD_H - PAD;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '13px monospace';
  ctx.textBaseline = 'alphabetic';

  const source = article.source?.name || '';
  const ts = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  ctx.textAlign = 'left';
  ctx.fillText(source, PAD, footY);

  ctx.textAlign = 'right';
  ctx.fillText(ts, CARD_W - PAD, footY);

  // Site watermark center
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(153,69,255,0.55)';
  ctx.fillText('x.com/runcouragerun', CARD_W / 2, footY);

  // ── Trigger download ──────────────────────────────────────────────────────
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = (article.title || 'courage-news')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40);
    a.href = url;
    a.download = `${slug}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}
