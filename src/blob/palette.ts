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

export const GEM_COLORS = PUFFY_CLAY_PALETTE;
