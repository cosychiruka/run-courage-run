import { useCallback, useEffect, useState } from 'react';
import {
  fetchRobinhoodTokenSnapshot,
  getCachedTokenSnapshot,
  getWorldEligibleTokens,
  subscribeTokenSnapshot,
} from '../services/tokenService';

export function useTrendingTokens(active = true) {
  const [snapshot, setSnapshot] = useState(getCachedTokenSnapshot);
  const refresh = useCallback((options) => fetchRobinhoodTokenSnapshot(options), []);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;

    const unsubscribe = subscribeTokenSnapshot((next) => {
      if (!cancelled) setSnapshot(next);
    });

    const refresh = async () => {
      const next = await fetchRobinhoodTokenSnapshot();
      if (!cancelled) setSnapshot(next);
    };

    refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [active]);

  return {
    snapshot,
    tokens: getWorldEligibleTokens(snapshot),
    metadata: snapshot.metadata,
    refresh,
  };
}
