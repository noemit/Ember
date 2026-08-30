import * as React from 'react';
import { THEMES } from '../themes';
import type { Instance } from '../types';
import GemBlob from '../blob/GemBlob';

type Props = {
  instance: Instance | null;
  themeId: string;
  onPick: (themeId: string) => void;
  onClose: () => void;
};

export default function SettingsPanel({ instance, themeId, onPick, onClose }: Props) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" style={{ width: '460px' }} onClick={(event) => event.stopPropagation()}>
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

        <h2 style={{ marginTop: '20px' }}>Agent Avatar Style</h2>
        <div className="sheet-sub">3D Puffy Clay Mascot with procedural animations & gaze tracking</div>

        <div
          className="theme-card"
          data-selected="true"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <GemBlob seed="ember settings mascot" size={44} state="idle" interactive={true} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>3D Puffy Clay</span>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                18 organic shapes, stretched dual-tone gradients & procedural animation
              </span>
            </div>
          </div>
          <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '11.5px' }}>Active</span>
        </div>
      </div>
    </div>
  );
}
