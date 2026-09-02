export type ThemePalette = {
  bg: string;
  panel: string;
  elev: string;
  text: string;
  dim: string;
  border: string;
  accent: string;
  accentText: string;
  danger: string;
};

export type Theme = {
  id: string;
  name: string;
  dark: boolean;
  palette: ThemePalette;
};

export const DEFAULT_THEME_ID = 'ember';

export const THEMES: Theme[] = [
  {
    id: 'ember',
    name: 'Ember',
    dark: true,
    palette: {
      bg: '#16130f',
      panel: '#1e1a15',
      elev: '#262019',
      text: '#f6efe6',
      dim: '#a89884',
      border: '#332c23',
      accent: '#ff7a1a',
      accentText: '#16130f',
      danger: '#ff5c5c',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    dark: true,
    palette: {
      bg: '#0d1117',
      panel: '#131a24',
      elev: '#1b2432',
      text: '#e6edf3',
      dim: '#8b98a9',
      border: '#243040',
      accent: '#4cc2ff',
      accentText: '#06121c',
      danger: '#ff6b6b',
    },
  },
  {
    id: 'matcha',
    name: 'Matcha',
    dark: true,
    palette: {
      bg: '#141a14',
      panel: '#1b231b',
      elev: '#232d23',
      text: '#eef5ea',
      dim: '#a3b39d',
      border: '#2b382b',
      accent: '#7fd14b',
      accentText: '#101a0c',
      danger: '#e8604c',
    },
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    dark: true,
    palette: {
      bg: '#1a1220',
      panel: '#231830',
      elev: '#2c1f3b',
      text: '#fdeaf6',
      dim: '#bb9db3',
      border: '#3a2a4a',
      accent: '#ff7ac8',
      accentText: '#1a1020',
      danger: '#ff5f7e',
    },
  },
  {
    id: 'terminal',
    name: 'Terminal',
    dark: true,
    palette: {
      bg: '#080b08',
      panel: '#0e130e',
      elev: '#141b14',
      text: '#c8ffc8',
      dim: '#5f8f5f',
      border: '#1e2a1e',
      accent: '#39ff6a',
      accentText: '#04140a',
      danger: '#ff4d4d',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    dark: false,
    palette: {
      bg: '#f4f6f9',
      panel: '#e9edf3',
      elev: '#ffffff',
      text: '#16202c',
      dim: '#5b6b7d',
      border: '#d3dae3',
      accent: '#3b7ddd',
      accentText: '#ffffff',
      danger: '#d64545',
    },
  },
];

export const themeById = (id: string): Theme =>
  THEMES.find((theme) => theme.id === id) ?? THEMES[0];

const toCssVars = (palette: ThemePalette): Record<string, string> => ({
  '--background': palette.bg,
  '--foreground': palette.text,
  '--card': palette.panel,
  '--card-foreground': palette.text,
  '--popover': palette.panel,
  '--popover-foreground': palette.text,
  '--primary': palette.accent,
  '--primary-foreground': palette.accentText,
  '--secondary': palette.elev,
  '--secondary-foreground': palette.text,
  '--muted': palette.elev,
  '--muted-foreground': palette.dim,
  '--accent': palette.elev,
  '--accent-foreground': palette.text,
  '--destructive': palette.danger,
  '--border': palette.border,
  '--input': palette.border,
  '--ring': palette.accent,
  '--sidebar': palette.panel,
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
