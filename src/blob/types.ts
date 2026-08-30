import type { BallState } from '../types';

export type BlobDirection =
  | 'habit-pill'
  | 'puffy-clay'
  | 'luminous-orb'
  | 'playful-doodle'
  | 'pastel-companion';

export type DirectionMeta = {
  id: BlobDirection;
  title: string;
  subtitle: string;
  inspiration: string;
  description: string;
  highlights: string[];
};

export const BLOB_DIRECTIONS: DirectionMeta[] = [
  {
    id: 'habit-pill',
    title: 'Direction 1: Habit Pill-Eyes',
    subtitle: 'Iconic Silhouettes & Tilted Pill Eyes',
    inspiration: 'synced/agent-personality (Habit bot creator & sidebar)',
    description:
      'Bold, modern, high-contrast geometric characters (circle, teardrop, squircle, triangle, pill, hexagon, cloud, egg) featuring the signature tilted capsule pill eyes. Highly legible and crisp at any UI scale.',
    highlights: [
      '8 distinct geometric shape silhouettes',
      'Signature thick tilted black pill eyes with interactive gaze',
      'Vibrant modern solid-plus-depth color palette',
      'Maximum legibility and punch in compact list views',
    ],
  },
  {
    id: 'puffy-clay',
    title: 'Direction 2: 3D Puffy Clay',
    subtitle: 'Volumetric Soft Shading & Glossy Cartoon Eyes',
    inspiration: 'synced/agent-personality (3D cloud creature & purple m gif)',
    description:
      'Soft, puffy marshmallow and multi-lobed cloud creatures with rich dual-tone gradients, ambient depth shadow, and oversized glossy 3D cartoon eyes with parallax pupil tracking and rosy cheeks.',
    highlights: [
      'Tactile 3D soft clay / cloud / m-blob geometry',
      'Rich dual-tone sunset/sky gradients with ambient lighting',
      'Large glossy 3D spherical eyes with dual sparkle reflections',
      'Expressive parallax pupil tracking with mouse reach',
    ],
  },
  {
    id: 'luminous-orb',
    title: 'Direction 3: Luminous Orb',
    subtitle: 'Glassmorphic Glow & Radiant Capsule Eyes',
    inspiration: 'synced/agent-personality (Glowing blue-purple sphere)',
    description:
      'Futuristic, glowing glassmorphic orbs with deep radiant gradients, internal light bloom, top glass specular sheen, and luminous white capsule eyes that float inside the sphere.',
    highlights: [
      'Deep ethereal cyber gradients (indigo -> royal blue -> cyan core)',
      'Radiant diffused ambient bottom glow & glass sheen arc',
      'Glowing pure white vertical capsule eyes with soft bloom',
      'Pulsing luminescence in active / thinking states',
    ],
  },
  {
    id: 'playful-doodle',
    title: 'Direction 4: Playful Doodle',
    subtitle: 'Tilted Bouncy Angles & Hand-Drawn Smiles',
    inspiration: 'synced/agent-personality (3x3 bouncy smileys & looped ribbon)',
    description:
      'Energetic, cheerful characters tilted at dynamic jaunty angles (-25° to +35°) with expressive hand-drawn ink smiles, wink eyes, and playful bouncy physics.',
    highlights: [
      'Dynamic tilted orientations for lively organic personality',
      'Hand-drawn bold ink facial expressions (smiles, smirks, winks)',
      'Retro-pop vibrant color palette (emerald, candy pink, marigold, cobalt)',
      'Joyful squash/bounce animations on interaction',
    ],
  },
  {
    id: 'pastel-companion',
    title: 'Direction 5: Pastel Companion',
    subtitle: 'Soft Cloud Puff & Orbiting Tiny Minions',
    inspiration: 'synced/agent-personality (Cloud character with floating pal)',
    description:
      'Ultra-cute minimalist pastel clouds and squircles accompanied by a mini satellite companion pal and floating sparkle particles that orbit gently around the agent.',
    highlights: [
      'Dreamy soft pastel multi-tone colors (sky, lavender, peach, mint)',
      'Ultra-sweet minimalist face with sweet blush dots',
      'Orbiting mini companion friend with its own tiny facial expression',
      'Floating micro-sparkle particles for an enchanting companion vibe',
    ],
  },
];

export type BlobProps = {
  seed: string;
  size?: number;
  state?: BallState;
  direction?: BlobDirection;
  interactive?: boolean;
  className?: string;
  style?: React.CSSProperties;
};
