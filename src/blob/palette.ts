export type ColorEntry = {
  name: string;
  base: string;
  light: string;
  dark: string;
  edge: string;
  secondary?: string;
  accent?: string;
  glow?: string;
};

// 3D Puffy Clay Palette: Stretched, ultra-soft subtle dual-tone gradients
export const PUFFY_CLAY_PALETTE: ColorEntry[] = [
  {
    name: 'Sky to Cotton Pink',
    base: '#70b9ff',
    light: '#bce1ff',
    secondary: '#e5c9f8',
    dark: '#ff9ec6',
    edge: '#3888d9',
    accent: '#ff4d88',
    glow: '#ff69b4',
  },
  {
    name: 'Mint to Soft Apricot',
    base: '#52deb2',
    light: '#aefae2',
    secondary: '#cdf5d6',
    dark: '#ffcaa4',
    edge: '#1eab80',
    accent: '#ff8c42',
    glow: '#48d8a8',
  },
  {
    name: 'Lavender to Creamy Peach',
    base: '#a484ff',
    light: '#d8c8ff',
    secondary: '#f0d2f8',
    dark: '#ffbf9e',
    edge: '#754fd9',
    accent: '#ff5c8a',
    glow: '#c084fc',
  },
  {
    name: 'Coral to Sweet Rose',
    base: '#ff6b7e',
    light: '#ffb3bf',
    secondary: '#ffccd4',
    dark: '#ff8fb1',
    edge: '#d93248',
    accent: '#e6005c',
    glow: '#ff4081',
  },
  {
    name: 'Soft Butter to Lilac Mist',
    base: '#ffd45e',
    light: '#ffefa8',
    secondary: '#f6e2f4',
    dark: '#d1aeff',
    edge: '#d49b13',
    accent: '#9d4edd',
    glow: '#ffb703',
  },
  {
    name: 'Ice Aqua to Electric Sky',
    base: '#38d2f0',
    light: '#a6f2ff',
    secondary: '#c2e3ff',
    dark: '#85a4ff',
    edge: '#0ea5c6',
    accent: '#3b82f6',
    glow: '#00f0ff',
  },
  {
    name: 'Seafoam to Mint Breeze',
    base: '#34d399',
    light: '#a7f3d0',
    secondary: '#c8f7e2',
    dark: '#6ee7b7',
    edge: '#059669',
    accent: '#0f766e',
    glow: '#10b981',
  },
  {
    name: 'Tangerine to Bubblegum',
    base: '#ff8e52',
    light: '#ffc8a8',
    secondary: '#ffd0df',
    dark: '#ff7fa8',
    edge: '#d95d18',
    accent: '#d90429',
    glow: '#ff5400',
  },
  {
    name: 'Royal Violet to Cyan Glow',
    base: '#6d61ff',
    light: '#b6afff',
    secondary: '#afe5ff',
    dark: '#48d8ff',
    edge: '#4334d9',
    accent: '#00b4d8',
    glow: '#7c4dff',
  },
  {
    name: 'Pearl White to Rosy Glaze',
    base: '#e8edf8',
    light: '#ffffff',
    secondary: '#ffe6f0',
    dark: '#ffc4de',
    edge: '#b0c0d8',
    accent: '#ff4081',
    glow: '#ff80bf',
  },
];

// Direction 1: Habit Pill Palette
export const HABIT_PALETTE: ColorEntry[] = [
  { name: 'pink', base: '#ff2a7a', light: '#ff66a3', dark: '#cc1054', edge: '#990038' },
  { name: 'red', base: '#ff3b30', light: '#ff7066', dark: '#c72118', edge: '#8e120b' },
  { name: 'purple', base: '#7c4dff', light: '#a682ff', dark: '#5625d9', edge: '#370fb3' },
  { name: 'blue', base: '#007aff', light: '#54a6ff', dark: '#0055b3', edge: '#003a80' },
  { name: 'cyan', base: '#00c7be', light: '#5ce1db', dark: '#00968f', edge: '#006963' },
  { name: 'orange', base: '#ff9500', light: '#ffb954', dark: '#cc7200', edge: '#995200' },
  { name: 'green', base: '#34c759', light: '#73db8d', dark: '#229941', edge: '#156b2c' },
  { name: 'marigold', base: '#ffcc00', light: '#ffe066', dark: '#cca300', edge: '#997a00' },
  { name: 'brown', base: '#8d6e63', light: '#bcaaa4', dark: '#5d4037', edge: '#3e2723' },
  { name: 'slate', base: '#78909c', light: '#b0bec5', dark: '#455a64', edge: '#263238' },
  { name: 'magenta', base: '#e91e63', light: '#f48fb1', dark: '#ad1457', edge: '#880e4f' },
  { name: 'indigo', base: '#3f51b5', light: '#7986cb', dark: '#283593', edge: '#1a237e' },
];

// Direction 3: Luminous Glow Palette
export const LUMINOUS_PALETTE: ColorEntry[] = [
  { name: 'electric-violet', base: '#6366f1', light: '#a5b4fc', dark: '#1e1b4b', edge: '#4338ca', secondary: '#818cf8', accent: '#38bdf8' },
  { name: 'cyan-beacon', base: '#06b6d4', light: '#67e8f9', dark: '#083344', edge: '#0891b2', secondary: '#22d3ee', accent: '#3b82f6' },
  { name: 'neon-magenta', base: '#ec4899', light: '#f472b6', dark: '#500724', edge: '#be185d', secondary: '#f43f5e', accent: '#a855f7' },
  { name: 'emerald-pulse', base: '#10b981', light: '#34d399', dark: '#022c22', edge: '#059669', secondary: '#6ee7b7', accent: '#2dd4bf' },
  { name: 'solar-amber', base: '#f59e0b', light: '#fbbf24', dark: '#451a03', edge: '#d97706', secondary: '#fcd34d', accent: '#ef4444' },
  { name: 'deep-sapphire', base: '#2563eb', light: '#60a5fa', dark: '#0f172a', edge: '#1d4ed8', secondary: '#38bdf8', accent: '#818cf8' },
  { name: 'plasma-purple', base: '#8b5cf6', light: '#c4b5fd', dark: '#2e1065', edge: '#6d28d9', secondary: '#d946ef', accent: '#f43f5e' },
  { name: 'aurora-teal', base: '#14b8a6', light: '#5eead4', dark: '#042f2e', edge: '#0f766e', secondary: '#2dd4bf', accent: '#6366f1' },
];

// Direction 4: Playful Doodle Palette
export const DOODLE_PALETTE: ColorEntry[] = [
  { name: 'forest-emerald', base: '#00965e', light: '#22c55e', dark: '#00633e', edge: '#004229' },
  { name: 'candy-pink', base: '#ff75a0', light: '#ffa3be', dark: '#d94672', edge: '#a81c46' },
  { name: 'vibrant-orange', base: '#ff4d00', light: '#ff7b3d', dark: '#cc3700', edge: '#8c2600' },
  { name: 'cobalt-blue', base: '#0062ff', light: '#4d91ff', dark: '#0044b3', edge: '#002b73' },
  { name: 'sunny-marigold', base: '#ffb700', light: '#ffce4d', dark: '#cc8f00', edge: '#8c6200' },
  { name: 'electric-purple', base: '#7000ff', light: '#9d4dff', dark: '#4d00b3', edge: '#320073' },
  { name: 'minty-fresh', base: '#00cba0', light: '#4df5cd', dark: '#009675', edge: '#00614c' },
  { name: 'coral-fire', base: '#ff334b', light: '#ff7384', dark: '#c7162b', edge: '#8a0a19' },
];

// Direction 5: Pastel Companion Palette
export const PASTEL_PALETTE: ColorEntry[] = [
  { name: 'cloud-sky', base: '#5ba4fc', light: '#99cbff', dark: '#3b82d9', edge: '#235fad', secondary: '#f783ac', accent: '#ff4081' },
  { name: 'dreamy-lavender', base: '#9c84f7', light: '#c5b6fa', dark: '#7357d6', edge: '#4c33ad', secondary: '#ffd166', accent: '#f39c12' },
  { name: 'sweet-mint', base: '#4ecdc4', light: '#8ee4de', dark: '#2ba89f', edge: '#1b736d', secondary: '#ff6b6b', accent: '#ee5253' },
  { name: 'peachy-blush', base: '#ff8a7a', light: '#ffb7ad', dark: '#d95a48', edge: '#a83323', secondary: '#54a0ff', accent: '#2e86de' },
  { name: 'butter-cream', base: '#f9ca24', light: '#f6e58d', dark: '#d4a20a', edge: '#9e7704', secondary: '#e056fd', accent: '#be2edd' },
  { name: 'rose-petal', base: '#f779a1', light: '#fab0c8', dark: '#c94d74', edge: '#962b4e', secondary: '#48dbfb', accent: '#0abde3' },
  { name: 'soft-violet', base: '#786fa6', light: '#a29bfe', dark: '#574b90', edge: '#3b306b', secondary: '#f8a5c2', accent: '#ea8685' },
  { name: 'apple-green', base: '#6ab04c', light: '#badc58', dark: '#488530', edge: '#2b591b', secondary: '#ffbe76', accent: '#f0932b' },
];

export const GEM_COLORS = PUFFY_CLAY_PALETTE;
