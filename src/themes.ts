export type Theme = {
  id: string;
  name: string;
  vars: Record<string, string>;
};

export const DEFAULT_THEME_ID = 'ember';

export const THEMES: Theme[] = [
  {
    id: 'ember',
    name: 'Ember',
    vars: {
      '--bg': '#16130f',
      '--bg-panel': '#1e1a15',
      '--bg-elev': '#262019',
      '--text': '#f6efe6',
      '--text-dim': '#a89884',
      '--border': '#332c23',
      '--accent': '#ff7a1a',
      '--accent-text': '#16130f',
      '--danger': '#ff5c5c',
      '--ball': '#ff7a1a',
      '--ball-eyeball': '#fff7ec',
      '--ball-pupil': '#16130f',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    vars: {
      '--bg': '#0d1117',
      '--bg-panel': '#131a24',
      '--bg-elev': '#1b2432',
      '--text': '#e6edf3',
      '--text-dim': '#8b98a9',
      '--border': '#243040',
      '--accent': '#4cc2ff',
      '--accent-text': '#06121c',
      '--danger': '#ff6b6b',
      '--ball': '#4cc2ff',
      '--ball-eyeball': '#eaf6ff',
      '--ball-pupil': '#06121c',
    },
  },
  {
    id: 'matcha',
    name: 'Matcha',
    vars: {
      '--bg': '#141a14',
      '--bg-panel': '#1b231b',
      '--bg-elev': '#232d23',
      '--text': '#eef5ea',
      '--text-dim': '#a3b39d',
      '--border': '#2b382b',
      '--accent': '#7fd14b',
      '--accent-text': '#101a0c',
      '--danger': '#e8604c',
      '--ball': '#7fd14b',
      '--ball-eyeball': '#f2fbee',
      '--ball-pupil': '#101a0c',
    },
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    vars: {
      '--bg': '#1a1220',
      '--bg-panel': '#231830',
      '--bg-elev': '#2c1f3b',
      '--text': '#fdeaf6',
      '--text-dim': '#bb9db3',
      '--border': '#3a2a4a',
      '--accent': '#ff7ac8',
      '--accent-text': '#1a1020',
      '--danger': '#ff5f7e',
      '--ball': '#ff7ac8',
      '--ball-eyeball': '#fff0fa',
      '--ball-pupil': '#1a1020',
    },
  },
  {
    id: 'terminal',
    name: 'Terminal',
    vars: {
      '--bg': '#080b08',
      '--bg-panel': '#0e130e',
      '--bg-elev': '#141b14',
      '--text': '#c8ffc8',
      '--text-dim': '#5f8f5f',
      '--border': '#1e2a1e',
      '--accent': '#39ff6a',
      '--accent-text': '#04140a',
      '--danger': '#ff4d4d',
      '--ball': '#39ff6a',
      '--ball-eyeball': '#e8ffe8',
      '--ball-pupil': '#04140a',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    vars: {
      '--bg': '#f4f6f9',
      '--bg-panel': '#e9edf3',
      '--bg-elev': '#ffffff',
      '--text': '#16202c',
      '--text-dim': '#5b6b7d',
      '--border': '#d3dae3',
      '--accent': '#3b7ddd',
      '--accent-text': '#ffffff',
      '--danger': '#d64545',
      '--ball': '#3b7ddd',
      '--ball-eyeball': '#ffffff',
      '--ball-pupil': '#16202c',
    },
  },
];

export const themeById = (id: string): Theme =>
  THEMES.find((theme) => theme.id === id) ?? THEMES[0];

export const applyTheme = (id: string): void => {
  const theme = themeById(id);
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, value]) => root.style.setProperty(key, value));
};
