import type { BallState } from '../types';

export type BlobDirection =
  | 'puffy-clay'
  | 'line-mascot'
  | 'micro-critter'
  | 'postcard-scene'
  | 'squiggle-doodle'
  | 'star-face';

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
    id: 'line-mascot',
    title: 'Direction 2: Sprout Kewpie Mascot',
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
    title: 'Direction 3: Quirky Micro-Critters',
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
  {
    id: 'postcard-scene',
    title: 'Direction 4: Animated Scene Postcards',
    subtitle: 'Framed Mini Landscapes with a Living Sun',
    inspiration: 'synced/agent-personality (fbedf22b & 41506930)',
    description:
      'Flat vintage travel-postcard tiles: bold-outlined rounded frames holding tiny desert, farm, mountain, island, volcano, and hills scenes where the sun is the agent face, clouds drift, water shimmers, and birds fly by.',
    highlights: [
      '6 seeded scene postcards (Desert, Farm, Mountains, Island, Volcano, Rolling Hills)',
      'The sun doubles as the agent face with full state expressions',
      'Drifting clouds, shimmering water dashes & flying birds',
      'Error summons a rain storm over the whole scene',
    ],
  },
  {
    id: 'squiggle-doodle',
    title: 'Direction 5: Scribble Squiggle',
    subtitle: 'One Continuous Looping Line with Nested Eyes',
    inspiration: 'synced/agent-personality (d7cb9e8b)',
    description:
      'A single confident marker stroke looping into cursive teardrop squiggles, with dot eyes nested inside the loop openings and a dark navy smile — pure minimal scribble energy.',
    highlights: [
      'Seeded cursive loop counts (2, 3, or 4 loops) with wavy exit tails',
      'Dot eyes tucked inside the loop openings like the reference scribble',
      'Marker-weight round strokes in cobalt, coral, forest & more inks',
      'Active state scans eyes left-right; error shakes the whole scribble',
    ],
  },
  {
    id: 'star-face',
    title: 'Direction 6: Kawaii Star Faces',
    subtitle: 'Flat Yellow Stars with Simple Marker Faces',
    inspiration: 'synced/agent-personality (7ec270c43)',
    description:
      'Flat rounded-tip yellow stars wearing tiny black marker faces — dot eyes, round glasses, sleepy arcs, smirks and blushes — twinkling gently and spinning when excited.',
    highlights: [
      '6 seeded face styles (Smile, Glasses, Sleepy, Smirk, Grumpy, Blush)',
      'Rounded-tip star silhouettes in warm seeded yellows',
      'Gentle idle twinkle & excited active spin-wobble',
      'Alert brows with popping exclamation; dizzy X eyes on error',
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
