import type { BallState } from '../types';

export type PuffyShape = {
  id: string;
  name: string;
  category: 'Clouds & Organic' | 'Creatures & Characters' | 'Geometric & Puffs' | 'Playful & Novelty';
  path: string;
  eyeY: number;
  eyeSpacing: number;
  eyeRadius: number;
  mouthY?: number;
  description: string;
};

export type BlobProps = {
  seed: string;
  size?: number;
  state?: BallState;
  interactive?: boolean;
  shapeIndex?: number;
  colorIndex?: number;
  className?: string;
  style?: React.CSSProperties;
};
