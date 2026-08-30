import * as React from 'react';
import { THEMES } from '../themes';
import type { Instance } from '../types';
import { BLOB_DIRECTIONS } from '../blob/types';
import { useActiveBlobDirection } from '../blob/directionState';
import GemBlob from '../blob/GemBlob';

type Props = {
  instance: Instance | null;
  themeId: string;
  onPick: (themeId: string) => void;
  onClose: () => void;
};

export default function SettingsPanel({ instance, themeId, onPick, onClose }: Props) {
  const [blobDirection, setBlobDirection] = useActiveBlobDirection();

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" style={{ width: '480px' }} onClick={(event) => event.stopPropagation()}>
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

        <h2 style={{ marginTop: '20px' }}>Agent Blob Style</h2>
        <div className="sheet-sub">Choose an active personality direction for your agent avatars</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {BLOB_DIRECTIONS.map((dir) => (
            <button
              key={dir.id}
              className="theme-card"
              data-selected={dir.id === blobDirection}
              onClick={() => setBlobDirection(dir.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GemBlob seed="demo" direction={dir.id} size={32} interactive={false} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 600, fontSize: '12.5px' }}>{dir.title}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{dir.subtitle}</span>
                </div>
              </div>
              {dir.id === blobDirection ? (
                <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '11px' }}>Active</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
