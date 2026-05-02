import { useState, useEffect, useRef, useCallback } from 'react';
import { getBackendUrl } from '../services/newsService';

/**
 * useWorldEvents — polls /api/world/event using recursive setTimeout so the
 * next poll NEVER fires while the previous one is still in-flight.
 *
 * @param {string}  world      — 'disco' | 'evening' | 'sunrise' | 'noon'
 * @param {object}  state      — world state to send (elapsed, ghost_count, etc.)
 * @param {boolean} active     — whether the world is currently visible
 * @param {number}  intervalMs — minimum gap between polls (default 45s)
 *
 * @returns {{ event, clearEvent, presenceCount }}
 */
export function useWorldEvents({
  world,
  state = {},
  active = false,
  intervalMs = 45_000,
} = {}) {
  const [event, setEvent]             = useState(null);
  const [presenceCount, setPresenceCount] = useState(0);

  const timerRef    = useRef(null);
  const inflightRef = useRef(false);  // guard: no concurrent requests
  const startedAt   = useRef(Date.now());
  const activeRef   = useRef(active); // stable ref avoids stale closure in loop

  // Keep activeRef in sync
  useEffect(() => { activeRef.current = active; }, [active]);

  const fetchEvent = useCallback(async () => {
    if (inflightRef.current) return; // already in flight — skip
    inflightRef.current = true;
    const base    = getBackendUrl();
    const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
    try {
      const res = await fetch(`${base}/api/world/event`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ world, state: { elapsed, ...state } }),
        signal:  AbortSignal.timeout(22_000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.action && data.action !== 'idle') {
          setEvent(data);
          // Auto-clear banner after 12s (narrations can be long)
          setTimeout(() => setEvent(null), 12000);
        }
      }
    } catch {
      /* backend down or timeout — silent fail */
    } finally {
      inflightRef.current = false;
    }
  }, [world, state]);

  const fetchPresence = useCallback(async () => {
    const base = getBackendUrl();
    try {
      const res = await fetch(`${base}/api/world/presence?world=${world}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const data = await res.json();
        setPresenceCount(Array.isArray(data) ? data.length : 0);
      }
    } catch { /* silent */ }
  }, [world]);

  useEffect(() => {
    if (!active) {
      clearTimeout(timerRef.current);
      return;
    }

    startedAt.current = Date.now();

    // Recursive poll: schedule → fetch → wait for response → reschedule
    const schedulePoll = (delayMs) => {
      timerRef.current = setTimeout(async () => {
        if (!activeRef.current) return; // world closed while we were waiting
        await Promise.all([fetchEvent(), fetchPresence()]);
        if (activeRef.current) schedulePoll(intervalMs); // only reschedule if still active
      }, delayMs);
    };

    // First event after 3s warm-up (get narration quickly), then every intervalMs
    schedulePoll(3000);

    return () => clearTimeout(timerRef.current);
  }, [active, world, fetchEvent, fetchPresence, intervalMs]);

  const clearEvent = useCallback(() => setEvent(null), []);

  return { event, clearEvent, presenceCount };
}


/**
 * registerPresence — one-shot call to register/refresh a selfie session.
 * Call this on selfie activate and every 2 minutes to keep it alive.
 */
export async function registerPresence({ world, uid, name, emoji }) {
  const base = getBackendUrl();
  try {
    await fetch(`${base}/api/world/presence`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ world, uid, name, emoji }),
      signal:  AbortSignal.timeout(5_000),
    });
  } catch { /* silent */ }
}
