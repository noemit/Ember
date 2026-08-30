// Shape paths and geometry generators for all 5 blob directions

// Direction 1: Habit Iconic Shapes (Exact silhouettes from Habit Bot Creator reference)
export const HABIT_SHAPES = [
  {
    id: 'circle',
    name: 'Circle',
    // Generous round shape filling viewBox [6,6] to [94,94]
    path: 'M 50 6 A 44 44 0 1 0 50 94 A 44 44 0 1 0 50 6 Z',
    eyeOffsetY: 44,
    eyeSpacing: 14,
  },
  {
    id: 'teardrop',
    name: 'Teardrop',
    // Droplet with smooth pointed top and plump rounded bottom
    path: 'M 50 6 C 68 34, 94 62, 94 72 C 94 85, 74 94, 50 94 C 26 94, 6 85, 6 72 C 6 62, 32 34, 50 6 Z',
    eyeOffsetY: 58,
    eyeSpacing: 12,
  },
  {
    id: 'squircle',
    name: 'Squircle',
    // Soft rounded box with smooth corners
    path: 'M 28 6 L 72 6 C 86 6, 94 14, 94 28 L 94 72 C 94 86, 86 94, 72 94 L 28 94 C 14 94, 6 86, 6 72 L 6 28 C 6 14, 14 6, 28 6 Z',
    eyeOffsetY: 46,
    eyeSpacing: 14,
  },
  {
    id: 'triangle',
    name: 'Triangle',
    // Rounded equilateral triangle
    path: 'M 50 6 C 58 6, 90 74, 93 81 C 95 87, 89 94, 78 94 L 22 94 C 11 94, 5 87, 7 81 C 10 74, 42 6, 50 6 Z',
    eyeOffsetY: 58,
    eyeSpacing: 12,
  },
  {
    id: 'pill',
    name: 'Capsule Pill',
    // Wide horizontal capsule
    path: 'M 32 16 L 68 16 C 83 16, 94 27, 94 42 L 94 58 C 94 73, 83 84, 68 84 L 32 84 C 17 84, 6 73, 6 58 L 6 42 C 6 27, 17 16, 32 16 Z',
    eyeOffsetY: 48,
    eyeSpacing: 16,
  },
  {
    id: 'hexagon',
    name: 'Hexagon / Cube',
    // Soft chamfered hexagon
    path: 'M 50 6 L 86 24 C 92 27, 94 33, 94 40 L 94 60 C 94 67, 92 73, 86 76 L 50 94 C 46 96, 44 96, 40 94 L 14 76 C 8 73, 6 67, 6 60 L 6 40 C 6 33, 8 27, 14 24 L 50 6 Z',
    eyeOffsetY: 46,
    eyeSpacing: 13,
  },
  {
    id: 'cloud',
    name: 'Scalloped Cloud',
    // 6-lobe puffy cloud
    path: 'M 35 12 C 45 10, 55 10, 65 12 C 78 12, 90 24, 92 37 C 94 49, 90 62, 85 71 C 80 80, 69 88, 58 90 C 42 92, 30 92, 18 84 C 8 76, 6 62, 8 50 C 6 36, 18 16, 35 12 Z',
    eyeOffsetY: 46,
    eyeSpacing: 14,
  },
  {
    id: 'egg',
    name: 'Egg',
    // Organic tall pebble
    path: 'M 50 6 C 75 6, 92 30, 92 56 C 92 78, 74 94, 50 94 C 26 94, 8 78, 8 56 C 8 30, 25 6, 50 6 Z',
    eyeOffsetY: 46,
    eyeSpacing: 13,
  },
];

// Direction 2: Puffy Clay Shapes (Soft 3D cloud & 'm' creature from references)
export const PUFFY_CLAY_SHAPES = [
  {
    id: 'puffy-cloud',
    name: 'Puffy Cloud',
    // Fluffy 5-lobe cloud from 05dcb78b151b13d955554fa4fc249a7b.jpg
    path: 'M 32 18 C 42 8, 58 8, 68 18 C 80 18, 92 30, 92 44 C 94 60, 84 76, 72 84 C 58 94, 42 94, 28 84 C 16 76, 6 60, 8 44 C 8 30, 20 18, 32 18 Z',
    eyeY: 42,
    eyeSpacing: 16,
    eyeRadius: 13.5,
  },
  {
    id: 'm-creature',
    name: 'Triple-Lobe M-Blob',
    // 3-lobed 'm' creature from df596cf72bc8e3af16a522ae928ab6ea.gif
    path: 'M 18 36 C 18 16, 38 12, 50 24 C 62 12, 82 16, 82 36 L 82 72 C 82 82, 72 90, 62 82 C 54 74, 54 74, 50 74 C 46 74, 46 74, 38 82 C 28 90, 18 82, 18 72 Z',
    eyeY: 34,
    eyeSpacing: 18,
    eyeRadius: 15,
  },
  {
    id: 'chubby-marshmallow',
    name: 'Chubby Marshmallow',
    path: 'M 24 12 C 40 8, 60 8, 76 12 C 90 16, 94 30, 94 50 C 94 70, 90 84, 76 88 C 60 92, 40 92, 24 88 C 10 84, 6 70, 6 50 C 6 30, 10 16, 24 12 Z',
    eyeY: 44,
    eyeSpacing: 15,
    eyeRadius: 13,
  },
  {
    id: 'jelly-dome',
    name: 'Jelly Dome',
    path: 'M 50 10 C 76 10, 94 34, 94 62 C 94 82, 80 92, 50 92 C 20 92, 6 82, 6 62 C 6 34, 24 10, 50 10 Z',
    eyeY: 46,
    eyeSpacing: 15,
    eyeRadius: 14,
  },
  {
    id: 'chubby-drop',
    name: 'Chubby Droplet',
    path: 'M 50 8 C 66 32, 92 56, 92 70 C 92 84, 74 94, 50 94 C 26 94, 8 84, 8 70 C 8 56, 34 32, 50 8 Z',
    eyeY: 54,
    eyeSpacing: 14,
    eyeRadius: 13,
  },
];

// Direction 3: Luminous Orb Shapes
export const LUMINOUS_SHAPES = [
  {
    id: 'sphere',
    name: 'Luminous Sphere',
    path: 'M 50 8 A 42 42 0 1 0 50 92 A 42 42 0 1 0 50 8 Z',
    eyeY: 46,
    eyeSpacing: 14,
  },
  {
    id: 'glowing-capsule',
    name: 'Glowing Capsule',
    path: 'M 32 14 L 68 14 C 84 14, 94 26, 94 44 L 94 56 C 94 74, 84 86, 68 86 L 32 86 C 16 86, 6 74, 6 56 L 6 44 C 6 26, 16 14, 32 14 Z',
    eyeY: 48,
    eyeSpacing: 15,
  },
  {
    id: 'radiant-droplet',
    name: 'Radiant Droplet',
    path: 'M 50 8 C 70 34, 92 60, 92 72 C 92 85, 74 94, 50 94 C 26 94, 8 85, 8 72 C 8 60, 30 34, 50 8 Z',
    eyeY: 54,
    eyeSpacing: 13,
  },
  {
    id: 'prism-squircle',
    name: 'Prism Squircle',
    path: 'M 26 8 L 74 8 C 88 8, 94 16, 94 30 L 94 70 C 94 84, 88 92, 74 92 L 26 92 C 12 92, 6 84, 6 70 L 6 30 C 6 16, 12 8, 26 8 Z',
    eyeY: 46,
    eyeSpacing: 14,
  },
];

// Direction 4: Playful Doodle Shapes (Bouncy tilted shapes with dynamic hand-drawn smiles)
export const DOODLE_SHAPES = [
  {
    id: 'bouncy-ball',
    name: 'Bouncy Sphere',
    path: 'M 50 8 A 42 42 0 1 0 50 92 A 42 42 0 1 0 50 8 Z',
    defaultAngle: -15,
  },
  {
    id: 'ribbon-loop',
    name: 'Folded Ribbon M',
    // Folded ribbon character inspired by d7cb9e8b695942118f7cbfa39435827e.jpg
    path: 'M 20 40 C 20 18, 42 14, 50 28 C 58 14, 80 18, 80 40 C 80 68, 68 86, 50 86 C 32 86, 20 68, 20 40 Z',
    defaultAngle: 12,
  },
  {
    id: 'wobble-jelly',
    name: 'Wobbly Pebble',
    path: 'M 35 10 C 65 6, 94 20, 92 50 C 90 80, 68 94, 38 90 C 14 86, 6 62, 10 38 C 14 18, 22 12, 35 10 Z',
    defaultAngle: -22,
  },
  {
    id: 'tilted-squircle',
    name: 'Tilted Squiggle',
    path: 'M 30 10 L 70 10 C 86 10, 92 20, 92 34 L 92 66 C 92 80, 86 90, 70 90 L 30 90 C 14 90, 8 80, 8 66 L 8 34 C 8 20, 14 10, 30 10 Z',
    defaultAngle: 25,
  },
];

// Direction 5: Pastel Companion Shapes (Soft clouds with orbiting pals)
export const PASTEL_SHAPES = [
  {
    id: 'pastel-cloud',
    name: 'Pastel Cloud',
    path: 'M 35 16 C 45 10, 58 10, 68 16 C 80 16, 90 28, 90 42 C 92 56, 82 72, 70 80 C 58 88, 42 88, 30 80 C 18 72, 8 56, 10 42 C 10 28, 20 16, 35 16 Z',
    faceY: 52,
  },
  {
    id: 'pastel-squircle',
    name: 'Pastel Squircle',
    path: 'M 28 14 L 72 14 C 86 14, 92 22, 92 36 L 92 68 C 92 82, 86 90, 72 90 L 28 90 C 14 90, 8 82, 8 68 L 8 36 C 8 22, 14 14, 28 14 Z',
    faceY: 48,
  },
  {
    id: 'pastel-drop',
    name: 'Pastel Droplet',
    path: 'M 50 12 C 68 36, 90 60, 90 72 C 90 84, 72 92, 50 92 C 28 92, 10 84, 10 72 C 10 60, 32 36, 50 12 Z',
    faceY: 58,
  },
];
