import { useEffect } from 'react';

export function useDisposableThreeResource(resource) {
  useEffect(() => () => {
    resource?.dispose?.();
  }, [resource]);
}

export function useDisposableThreeResources(resources) {
  useEffect(() => () => {
    [...new Set(Object.values(resources || {}))].forEach((resource) => resource?.dispose?.());
  }, [resources]);
}
