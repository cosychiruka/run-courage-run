import { useState, useEffect, useRef, useCallback } from 'react';
import { getBackendUrl } from '../services/newsService';

/**
 * useWorldEvents — polls /api/world/event every `intervalMs` and
 * returns the latest LLM-decided event for the current world.
 *
 * Also handles presence heartbeats when a selfie session is active.
 *
 * @param {string}  world      — 'disco' | 'evening' | 'sunrise' | 'noon'
 * @param {object}  state      — world state to send (elapsed, ghost_count, etc.)
 * @param {boolean} active     — whether the world is currently visible
 * @param {number}  intervalMs — poll interval (default 45s)
 *
 * @returns {{ event, clearEvent, presenceCount }}
 */
export function useWorldEvents({
  world,
  state = {},
  active = false,
  intervalMs = 45_000,
} = {}) {
  const [event, setEvent] = useState(null);
  const [presenceCount, setPresenceCount] = useState(0);
  const timerRef  = useRef(null);
  const startedAt = useRef(Date.now());

  const fetchEvent = useCallback(async () => {
    const base = getBackendUrl();
    const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
    try {
      const res = await fetch(`${base}/api/world/event`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ world, state: { elapsed, ...state } }),
        signal:  AbortSignal.timeout(22_000),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.action && data.action !== 'idle') {
        setEvent(data);
        // Auto-clear banner after 8s
        setTimeout(() => setEvent(null), 8_000);
      }
    } catch {
      /* backend down or timeout — silent fail */
    }
  }, [world, state]);

  const fetchPresence = useCallback(async () => {
    const base = getBackendUrl();
    try {
      const res = await fetch(`${base}/api/world/presence?world=${world}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return;
      const data = await res.json();
      setPresenceCount(Array.isArray(data) ? data.length : 0);
    } catch { /* silent */ }
  }, [world]);

  useEffect(() => {
    if (!active) {
      clearInterval(timerRef.current);
      return;
    }

    startedAt.current = Date.now();

    // First event after 15s (world warm-up), then every intervalMs
    const firstTimer = setTimeout(() => {
      fetchEvent();
      fetchPresence();
      timerRef.current = setInterval(() => {
        fetchEvent();
        fetchPresence();
      }, intervalMs);
    }, 15_000);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(timerRef.current);
    };
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
