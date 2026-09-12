import { useEffect, useState } from 'react';
import {
  fetchRobinhoodTokenSnapshot,
  getCachedTokenSnapshot,
  getWorldEligibleTokens,
} from '../services/tokenService';

export function useTrendingTokens(active = true) {
  const [snapshot, setSnapshot] = useState(getCachedTokenSnapshot);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;

    const refresh = async () => {
      const next = await fetchRobinhoodTokenSnapshot();
      if (!cancelled) setSnapshot(next);
    };

    refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [active]);

  return {
    snapshot,
    tokens: getWorldEligibleTokens(snapshot),
    metadata: snapshot.metadata,
  };
}

