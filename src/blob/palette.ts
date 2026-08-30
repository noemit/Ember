export type GemColor = {
  name: string;
  base: string;
  light: string;
  dark: string;
  edge: string;
};

export const GEM_COLORS: GemColor[] = [
  { name: 'ruby', base: '#e0115f', light: '#ff7fb3', dark: '#8c0a3c', edge: '#5e0728' },
  { name: 'emerald', base: '#2ecc71', light: '#86ffb8', dark: '#178a47', edge: '#0d5f30' },
  { name: 'sapphire', base: '#2d6cdf', light: '#86b0ff', dark: '#1a4aa0', edge: '#10306b' },
  { name: 'amethyst', base: '#9b59ff', light: '#caa6ff', dark: '#6a32c0', edge: '#481f86' },
  { name: 'topaz', base: '#ffcf33', light: '#ffe98a', dark: '#d9a400', edge: '#9c7600' },
  { name: 'rose', base: '#ff7eb3', light: '#ffc4dc', dark: '#e04e8e', edge: '#a6326a' },
  { name: 'aquamarine', base: '#25e0d8', light: '#90f6f0', dark: '#12a59e', edge: '#0a6f6a' },
  { name: 'onyx', base: '#3a3f47', light: '#6b7280', dark: '#1c1f24', edge: '#0e1013' },
  { name: 'amber', base: '#ff9f1c', light: '#ffce85', dark: '#d97a00', edge: '#9c5600' },
  { name: 'peridot', base: '#aef359', light: '#d8ff9c', dark: '#7cbf2a', edge: '#56881a' },
  { name: 'opal', base: '#eef0ff', light: '#ffffff', dark: '#c7c9e0', edge: '#9a9dbf' },
  { name: 'garnet', base: '#9b1b30', light: '#d65b6f', dark: '#6b0f20', edge: '#450a14' },
];
