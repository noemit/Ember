import type { BallState } from '../types';

export type BlobDirection =
  | 'puffy-clay'
  | 'star-candy'
  | 'faceted-gem'
  | 'retro-block'
  | 'line-mascot'
  | 'micro-critter';

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
    id: 'puffy-clay',
    title: 'Direction 1: 3D Puffy Clay (Saved)',
    subtitle: 'Curated 8-Shape Suite & De-synchronized Breathing',
    inspiration: 'synced/agent-personality (05dcb78b & df596cf7)',
    description:
      'Our saved 3D puffy clay mascot suite with 8 curated shapes, stretched dual-tone gradients, de-synchronized natural breathing rates, fixed yelling needs-input mouth, and pure dark glossy cartoon eyes.',
    highlights: [
      '8 curated keeper shapes (Marshmallow, Slime, Pebble, M-Blob, Ghost, Bean, Onigiri, Egg)',
      'Independent per-blob breathing rates & phase offsets',
      'Procedural random active action loop (hops, backflips, code scanning, shimmies)',
      'Pure glossy dark pupils on white spherical eyeballs',
    ],
  },
  {
    id: 'star-candy',
    title: 'Direction 2: Gummy Konpeitō / Star Candy',
    subtitle: 'Crystalline Sugar Star & Internal Glitter Bloom',
    inspiration: 'synced/agent-personality (72a77f99 gif & 7ec270c4)',
    description:
      'Glistening multi-pointed konpeitō sugar star candies with internal starlight sparkle dust, translucent jelly depth, refractive sugar facet rims, and cute animated emotional faces.',
    highlights: [
      'Tactile sugar star geometry with 8-9 rounded crystallized nodules',
      'Internal glowing starlight dust & sparkling glitter particles',
      'Gummy refraction shine with rich jewel-candy colors',
      '15 expressive emotional faces (star eyes, glasses, winks, cheeky smiles)',
    ],
  },
  {
    id: 'faceted-gem',
    title: 'Direction 3: Faceted Cyber Gem',
    subtitle: 'Sharp Multi-Plane Facets & Pixel-Glitch Accents',
    inspiration: 'synced/agent-personality (e26eb778 & 64508875)',
    description:
      'Sharp, crisp, multi-plane faceted gemstones (emerald cut, brilliant diamond, marquise, octagon, prism triangle) featuring sharp light refractions and cyber pixel-art expressive eye visors.',
    highlights: [
      'Sharp geometric facet planes with dynamic specular sheen arcs',
      'Cyber pixel-art expressive eyes (sunglasses, pixel hearts, pixel glints, XX)',
      'Rich saturated gemstone brilliance (emerald, sapphire, amethyst, ruby, topaz)',
      'Rotating crystalline reflections on hover & active states',
    ],
  },
  {
    id: 'retro-block',
    title: 'Direction 4: Retro Blockheads',
    subtitle: 'Warm Color Squares & Expressive Graphic Faces',
    inspiration: 'synced/agent-personality (f9cbec03)',
    description:
      'Warm, charming, retro-pop color blocks (soft squares, vertical cuboids, split dual-blocks) with large expressive round cartoon eyes, ink smiles, and clean tactile graphic presence.',
    highlights: [
      'Modern retro-pop blocky silhouettes (square, cuboid, rounded brick)',
      'Big expressive round cartoon eyes with offset pupil tracking',
      'Warm saturated risograph-inspired palette (sun yellow, cobalt, poppy, bubblegum)',
      'Charming clean graphic personality with maximum list readability',
    ],
  },
  {
    id: 'line-mascot',
    title: 'Direction 5: Sprout Kewpie Mascot',
    subtitle: 'Vintage Line Art & Iconic Sprout Cheeks',
    inspiration: 'synced/agent-personality (77e9cab4 & 7e824755)',
    description:
      'Vintage-modern illustrated character mascot with an iconic onion-head hair sprout, bold blue/white vector contour strokes, expressive eyelash arcs, and cute diagonal blush ticks.',
    highlights: [
      'Iconic onion sprout head, droplet, and soft teardrop mascots',
      'Bold vintage vector contour lines with warm cream/color body fills',
      'Expressive anime/kewpie eye anatomy with top eyelash ticks & blush strokes',
      'Charming nostalgic character warmth with modern crispness',
    ],
  },
  {
    id: 'micro-critter',
    title: 'Direction 6: Quirky Micro-Critters',
    subtitle: 'Playful Line Doodles with Animated Little Legs',
    inspiration: 'synced/agent-personality (131eeba4 & 99124d0d)',
    description:
      'Endearing quirky line-doodle creatures (snail-swirls, bean bugs, mushroom caps, tea ghosts) equipped with tiny animated walking stick legs and whimsical physics.',
    highlights: [
      'Distinctive whimsical line-doodle silhouettes with organic squiggles',
      'Cute little animated walking stick legs/feet that tiptoe & dance',
      'Quirky accessories (tiny laptop, snail shell, antenna nubs, sleeping cap)',
      'Delightful handmade indie personality with unique charm',
    ],
  },
];

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
  direction?: BlobDirection;
  interactive?: boolean;
  shapeIndex?: number;
  colorIndex?: number;
  className?: string;
  style?: React.CSSProperties;
};
