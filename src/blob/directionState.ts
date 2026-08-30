import * as React from 'react';
import type { BlobDirection } from './types';

const STORAGE_KEY = 'ember:blob-direction';
const EVENT_NAME = 'ember:blob-direction-changed';
export const DEFAULT_DIRECTION: BlobDirection = 'puffy-clay';

export function getActiveBlobDirection(): BlobDirection {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (
      saved === 'puffy-clay' ||
      saved === 'star-candy' ||
      saved === 'faceted-gem' ||
      saved === 'retro-block' ||
      saved === 'line-mascot' ||
      saved === 'micro-critter'
    ) {
      return saved;
    }
  } catch {
    // fallback if localStorage not accessible
  }
  return DEFAULT_DIRECTION;
}

export function setActiveBlobDirection(direction: BlobDirection): void {
  try {
    localStorage.setItem(STORAGE_KEY, direction);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: direction }));
}

export function useActiveBlobDirection(): [BlobDirection, (dir: BlobDirection) => void] {
  const [direction, setDirection] = React.useState<BlobDirection>(getActiveBlobDirection);

  React.useEffect(() => {
    const handleUpdate = (event: Event) => {
      const custom = event as CustomEvent<BlobDirection>;
      if (custom.detail) {
        setDirection(custom.detail);
      } else {
        setDirection(getActiveBlobDirection());
      }
    };
    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const changeDirection = React.useCallback((next: BlobDirection) => {
    setActiveBlobDirection(next);
    setDirection(next);
  }, []);

  return [direction, changeDirection];
}
