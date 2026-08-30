export const hashString = (value: string): number => {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const promptSeedString = (text: string): string => {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10)
    .join(' ');
  return words || 'ember';
};

export type Traits = {
  styleIndex: number;
  colorIndex: number;
  shapeIndex: number;
  eyeIndex: number;
};

export const deriveTraits = (seed: string): Traits => {
  const rng = mulberry32(hashString(seed));
  return {
    styleIndex: Math.floor(rng() * 3),
    colorIndex: Math.floor(rng() * 12),
    shapeIndex: Math.floor(rng() * 6),
    eyeIndex: Math.floor(rng() * 3),
  };
};
