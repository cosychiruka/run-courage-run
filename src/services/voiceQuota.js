/**
 * voiceQuota.js — Browser-side voice chat rate limiter.
 *
 * Enforces a rolling 60-minute quota of 15 minutes (900 seconds) of active
 * voice time. Works across ALL mic buttons (landing page + 3D worlds) by
 * sharing a single localStorage key.
 *
 * Quota resets on a rolling window — not at the top of every clock hour.
 * So if you used 15 min at 2:00pm, you can speak again starting from 3:00pm.
 *
 * Storage key: "courage_voice_quota"
 * Format: JSON array of { start: ms, end: ms } intervals
 *
 * Usage:
 *   import { quotaStart, quotaEnd, quotaStatus } from './voiceQuota';
 *
 *   // When mic button is pressed:
 *   const status = quotaStatus();
 *   if (!status.canSpeak) { show warning; return; }
 *   quotaStart();          // record session start
 *
 *   // When mic is released / audio finishes:
 *   quotaEnd();            // record session end, persist to localStorage
 *
 *   // Display:
 *   const { usedSecs, remainingSecs, canSpeak } = quotaStatus();
 */

const QUOTA_KEY        = 'courage_voice_quota';
const WINDOW_MS        = 60 * 60 * 1000;   // 1 hour rolling window
const MAX_SECS         = 15 * 60;           // 900 seconds = 15 minutes
const GRACE_SECS       = 5;                 // 5s buffer so we don't cut off mid-sentence

let _sessionStart = null;  // timestamp (ms) of the current active mic session

// ── Internal helpers ──────────────────────────────────────────────────────────

function _loadIntervals() {
  try {
    const raw = localStorage.getItem(QUOTA_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function _saveIntervals(intervals) {
  try {
    localStorage.setItem(QUOTA_KEY, JSON.stringify(intervals));
  } catch { /* storage full or unavailable */ }
}

function _trimOld(intervals) {
  const cutoff = Date.now() - WINDOW_MS;
  return intervals.filter(iv => iv.end > cutoff || iv.end === 0);
}

function _usedSeconds(intervals) {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  let total = 0;
  for (const iv of intervals) {
    const start = Math.max(iv.start, cutoff);
    const end   = iv.end > 0 ? Math.min(iv.end, now) : now;  // ongoing session counts live
    if (end > start) total += (end - start) / 1000;
  }
  return total;
}


// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get the current quota status.
 * Call this before allowing the user to start recording.
 */
export function quotaStatus() {
  const intervals = _trimOld(_loadIntervals());
  // Add any live session to the calculation
  const withLive = _sessionStart
    ? [...intervals, { start: _sessionStart, end: 0 }]
    : intervals;
  const usedSecs      = Math.min(_usedSeconds(withLive), MAX_SECS);
  const remainingSecs = Math.max(0, MAX_SECS - usedSecs - GRACE_SECS);
  const canSpeak      = remainingSecs > 0;

  // Find when oldest interval expires to tell user when they can speak again
  let resetInSecs = 0;
  if (!canSpeak) {
    const oldest = intervals.reduce((min, iv) => Math.min(min, iv.start), Infinity);
    if (oldest < Infinity) {
      resetInSecs = Math.max(0, Math.ceil((oldest + WINDOW_MS - Date.now()) / 1000));
    }
  }

  return { usedSecs, remainingSecs, canSpeak, resetInSecs };
}

/**
 * Call when the user starts speaking (mic button pressed / hold begins).
 */
export function quotaStart() {
  _sessionStart = Date.now();
}

/**
 * Call when the user stops speaking (mic released or audio playback ends).
 * Saves the completed interval to localStorage.
 */
export function quotaEnd() {
  if (_sessionStart === null) return;
  const iv = { start: _sessionStart, end: Date.now() };
  _sessionStart = null;

  const intervals = _trimOld(_loadIntervals());
  intervals.push(iv);
  _saveIntervals(intervals);
}

/**
 * Cancel a session without recording it (e.g. mic error, very short tap).
 */
export function quotaCancel() {
  _sessionStart = null;
}

/**
 * Format remaining seconds as "Mm Ss" or "Xs".
 */
export function formatTime(secs) {
  secs = Math.round(secs);
  if (secs <= 0) return '0s';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Format the reset time (when they can speak again).
 */
export function formatResetIn(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m >= 60) return 'in about an hour';
  if (m > 0)   return `in ${m}m ${s}s`;
  return `in ${s}s`;
}
