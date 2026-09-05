/**
 * Palettes are neutral first: surfaces, text and borders are grays/beiges, and the one
 * bright colour (`highlight`) is reserved for indicators — activity dots, focus rings,
 * selection ticks and the wordmark. User bubbles use a softer neighbour of the highlight
 * so chat remains calm while the accent stays available for interaction states.
 */
import { glyphPaletteFor, instanceMarkerPaletteFor } from './blob/contrast';
import { critterPaletteFor } from './blob/critter';

export type ThemePalette = {
  bg: string;
  panel: string;
  elev: string;
  text: string;
  dim: string;
  border: string;
  highlight: string;
  highlightText: string;
  warning: string;
  userBubble: string;
  userBubbleText: string;
  danger: string;
};

export type ThemeGroup = 'neutral';

export type Theme = {
  id: string;
  name: string;
  group: ThemeGroup;
  dark: boolean;
  palette: ThemePalette;
};

export const DEFAULT_THEME_ID = 'stone';

export const THEME_GROUPS: Array<{ id: ThemeGroup; name: string }> = [
  { id: 'neutral', name: 'Colors' },
];

export const THEMES: Theme[] = [
  {
    id: 'stone',
    name: 'Stone',
    group: 'neutral',
    dark: false,
    palette: {
      bg: '#e2e2df',
      panel: '#d9d9d5',
      elev: '#d0d0cb',
      text: '#232322',
      dim: '#50504d',
      border: '#c4c4be',
      highlight: '#2f6fdc',
      highlightText: '#ffffff',
      warning: '#713700',
      userBubble: '#c1cee0',
      userBubbleText: '#232322',
      danger: '#b83a3a',
    },
  },
  {
    id: 'clay',
    name: 'Clay',
    group: 'neutral',
    dark: true,
    palette: {
      bg: '#37322d',
      panel: '#3f3933',
      elev: '#4a433c',
      text: '#f1ebe2',
      dim: '#c2b7a7',
      border: '#534b42',
      highlight: '#f0a35e',
      highlightText: '#2a241d',
      warning: '#f0b36b',
      userBubble: '#604d3d',
      userBubbleText: '#f1ebe2',
      danger: '#f07a6a',
    },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    group: 'neutral',
    dark: true,
    palette: {
      bg: '#101214',
      panel: '#16191d',
      elev: '#1f2329',
      text: '#e6e9ed',
      dim: '#8d96a1',
      border: '#262c34',
      highlight: '#4cc2ff',
      highlightText: '#06121c',
      warning: '#f0b36b',
      userBubble: '#30434f',
      userBubbleText: '#e6e9ed',
      danger: '#ff6b6b',
    },
  },
];

export const themeById = (id: string): Theme =>
  THEMES.find((theme) => theme.id === id) ?? THEMES.find((theme) => theme.id === DEFAULT_THEME_ID) ?? THEMES[0];

const toCssVars = (palette: ThemePalette): Record<string, string> => ({
  // Glyph blobs sit on the rail (panel), selected rows (elev) and the chat header (bg).
  ...Object.fromEntries(
    glyphPaletteFor([palette.panel, palette.elev, palette.bg]).map((color, index) => [`--glyph-${index}`, color])
  ),
  ...Object.fromEntries(
    instanceMarkerPaletteFor([palette.panel, palette.elev, palette.bg]).map((color, index) => [`--instance-marker-${index}`, color])
  ),
  ...Object.fromEntries(
    critterPaletteFor([palette.panel, palette.elev, palette.bg]).flatMap(({ fill, accent, ink }, index) => [
      [`--critter-${index}`, fill],
      [`--critter-${index}-accent`, accent],
      [`--critter-${index}-ink`, ink],
    ])
  ),
  '--background': palette.bg,
  '--foreground': palette.text,
  '--card': palette.panel,
  '--card-foreground': palette.text,
  '--popover': palette.panel,
  '--popover-foreground': palette.text,
  // Neutral: buttons read as ink on paper rather than a splash of colour.
  '--primary': palette.text,
  '--primary-foreground': palette.bg,
  '--user-bubble': palette.userBubble,
  '--user-bubble-foreground': palette.userBubbleText,
  '--warning': palette.warning,
  '--secondary': palette.elev,
  '--secondary-foreground': palette.text,
  '--muted': palette.elev,
  '--muted-foreground': palette.dim,
  '--accent': palette.elev,
  '--accent-foreground': palette.text,
  '--destructive': palette.danger,
  '--border': palette.border,
  '--input': palette.border,
  '--ring': palette.highlight,
  '--sidebar': palette.panel,
  '--highlight': palette.highlight,
  '--highlight-foreground': palette.highlightText,
});

export const applyTheme = (id: string): void => {
  const theme = themeById(id);
  const root = document.documentElement;
  Object.entries(toCssVars(theme.palette)).forEach(([key, value]) =>
    root.style.setProperty(key, value)
  );
  root.classList.toggle('dark', theme.dark);
  root.style.colorScheme = theme.dark ? 'dark' : 'light';
};
