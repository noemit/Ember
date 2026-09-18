export const shortcutLabel = (key: string): string => {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return key.replace(/Mod\+/g, mac ? '⌘' : 'Ctrl+').replace(/Alt\+/g, mac ? '⌥' : 'Alt+');
};
