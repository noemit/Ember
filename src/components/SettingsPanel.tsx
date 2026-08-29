import * as React from 'react';
import { THEMES } from '../themes';
import type { Instance } from '../types';

type Props = {
  instance: Instance | null;
  themeId: string;
  onPick: (themeId: string) => void;
  onClose: () => void;
};

export default function SettingsPanel({ instance, themeId, onPick, onClose }: Props) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <h2>Settings</h2>
        <div className="sheet-sub">
          {instance ? `Theme for ${instance.label}` : 'Theme for this window'}
        </div>

        <div className="theme-grid">
          {THEMES.map((theme) => (
            <button
              className="theme-card"
              key={theme.id}
              data-selected={theme.id === themeId}
              onClick={() => onPick(theme.id)}
            >
              <span>{theme.name}</span>
              <span className="theme-swatches">
                <span className="theme-swatch" style={{ background: theme.vars['--bg'] }} />
                <span className="theme-swatch" style={{ background: theme.vars['--accent'] }} />
                <span className="theme-swatch" style={{ background: theme.vars['--ball'] }} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
