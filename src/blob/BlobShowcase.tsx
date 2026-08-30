import * as React from 'react';
import GemBlob from './GemBlob';
import { BLOB_DIRECTIONS, type BlobDirection } from './types';
import { PUFFY_CLAY_SHAPES } from './shapes';
import { useActiveBlobDirection } from './directionState';
import type { BallState } from '../types';

type Props = {
  onClose: () => void;
};

const SAMPLE_AGENTS = [
  'Habit QA',
  'Habit distribution',
  'Youtube Manager',
  'Habit.am manager',
  'QA Engineer',
  'Habit Instagram',
  'Search Console',
  'Design Critic',
  'Prompt Tuner',
  'Build Runner',
  'Code Refactor',
  'Data Pipeline',
  'Release Manager',
  'Security Audit',
  'Documentation Bot',
  'Metrics Analyst',
];

const MATRIX_AGENTS = [
  { name: 'Habit QA', seed: 'Habit QA testing agent' },
  { name: 'Habit distribution', seed: 'Habit distribution search console' },
  { name: 'Youtube Manager', seed: 'Youtube Manager studio stats' },
  { name: 'Habit.am manager', seed: 'Habit.am manager habit distribution' },
  { name: 'QA Engineer', seed: 'QA Engineer list verifier' },
  { name: 'Habit Instagram', seed: 'Habit Instagram media crawler' },
];

const STATES: { id: BallState; label: string; desc: string }[] = [
  { id: 'idle', label: 'Idle', desc: 'Natural gentle glance around & occasional eyelid blink' },
  { id: 'active', label: 'Active', desc: 'Rapid procedural eye scanning (inspecting code) & focused smile' },
  { id: 'needs-input', label: 'Needs Input', desc: 'Alert wide eyes with raised brows & animated yelling mouth' },
  { id: 'error', label: 'Error', desc: 'Worried X eyes & shivering sad mouth' },
];

export default function BlobShowcase({ onClose }: Props) {
  const [activeGlobalDirection, setGlobalDirection] = useActiveBlobDirection();
  const [currentTab, setCurrentTab] = React.useState<BlobDirection | 'matrix'>(activeGlobalDirection);
  const [sandboxSeed, setSandboxSeed] = React.useState('Habit QA');
  const [sandboxState, setSandboxState] = React.useState<BallState>('idle');
  const [matrixState, setMatrixState] = React.useState<BallState>('idle');
  const [customMatrixSeed, setCustomMatrixSeed] = React.useState('');
  const [themeMode, setThemeMode] = React.useState<'dark' | 'light'>('dark');

  const currentDirectionMeta = BLOB_DIRECTIONS.find((d) => d.id === currentTab);

  return (
    <div className="showcase-overlay" onClick={onClose}>
      <div className="showcase-container" data-theme={themeMode} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="showcase-header">
          <div className="showcase-header-top">
            <div className="showcase-title-group">
              <h2>
                Agent Personality Showcase <span className="showcase-badge">{BLOB_DIRECTIONS.length} Directions</span>
              </h2>
              <p className="showcase-subtitle">
                Explore the {BLOB_DIRECTIONS.length} agent personality directions across seeded colors, states, and animations
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Light / Dark Mode Toggle Button */}
              <button
                className="control-btn"
                style={{
                  background: themeMode === 'light' ? '#ffffff' : 'var(--bg-elev)',
                  borderColor: 'var(--accent)',
                  fontWeight: 600,
                }}
                onClick={() => setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'))}
              >
                {themeMode === 'dark' ? '☀️ Light Background' : '🌙 Dark Background'}
              </button>

              <button className="icon-button" onClick={onClose}>
                ✕ Close
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="showcase-nav-tabs">
            {BLOB_DIRECTIONS.map((dir) => (
              <button
                key={dir.id}
                className="showcase-tab"
                data-active={currentTab === dir.id}
                onClick={() => setCurrentTab(dir.id)}
              >
                {dir.title}
                {activeGlobalDirection === dir.id ? ' ★ (Active)' : ''}
              </button>
            ))}
            <button
              className="showcase-tab"
              data-active={currentTab === 'matrix'}
              onClick={() => setCurrentTab('matrix')}
            >
              ⊞ All {BLOB_DIRECTIONS.length} Side-by-Side Matrix
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="showcase-body">
          {currentTab === 'matrix' ? (
            /* Matrix Comparison View (All 3 Side-by-Side) */
            <div className="matrix-container">
              <div className="direction-meta-card">
                <div className="direction-meta-top">
                  <span className="direction-meta-title">Side-by-Side Comparison Matrix (All 3 Directions)</span>
                  <span className="direction-inspiration-tag">Compare in {themeMode === 'dark' ? 'Dark' : 'Light'} Mode</span>
                </div>
                <p className="direction-desc">
                  Review the exact same agent seeds and states rendered simultaneously across all {BLOB_DIRECTIONS.length} design directions to test silhouette contrast, eye readability, and animation personality.
                </p>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                  <div className="control-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <span className="control-label">State:</span>
                    <div className="control-buttons-row">
                      {STATES.map((st) => (
                        <button
                          key={st.id}
                          className="control-btn"
                          data-selected={matrixState === st.id}
                          onClick={() => setMatrixState(st.id)}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 200 }}>
                    <input
                      type="text"
                      className="custom-seed-input"
                      placeholder={`Type any agent name to test across all ${BLOB_DIRECTIONS.length}...`}
                      value={customMatrixSeed}
                      onChange={(e) => setCustomMatrixSeed(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Custom Seed Row */}
              {customMatrixSeed.trim() && (
                <div className="matrix-row">
                  <span className="matrix-row-title">Custom: "{customMatrixSeed}"</span>
                  <div className="matrix-columns" style={{ gridTemplateColumns: `repeat(${BLOB_DIRECTIONS.length}, 1fr)` }}>
                    {BLOB_DIRECTIONS.map((dir) => (
                      <div
                        key={dir.id}
                        className="matrix-card"
                        onClick={() => {
                          setGlobalDirection(dir.id);
                          setCurrentTab(dir.id);
                        }}
                      >
                        <GemBlob
                          seed={customMatrixSeed}
                          direction={dir.id}
                          size={64}
                          state={matrixState}
                          interactive={true}
                        />
                        <span className="matrix-card-name">{dir.title.split(':')[1]?.replace('(Saved)', '').trim()}</span>
                        <span className="matrix-card-style">{dir.subtitle}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Standard Agents Matrix Rows */}
              {MATRIX_AGENTS.map((item) => (
                <div className="matrix-row" key={item.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="matrix-row-title">{item.name}</span>
                    <span className="instance-meta" style={{ fontSize: 10 }}>seed: {item.seed}</span>
                  </div>
                  <div className="matrix-columns" style={{ gridTemplateColumns: `repeat(${BLOB_DIRECTIONS.length}, 1fr)` }}>
                    {BLOB_DIRECTIONS.map((dir) => (
                      <div
                        key={dir.id}
                        className="matrix-card"
                        onClick={() => {
                          setGlobalDirection(dir.id);
                          setCurrentTab(dir.id);
                        }}
                        title={`Click to set ${dir.title} as active`}
                      >
                        <GemBlob
                          seed={item.seed}
                          direction={dir.id}
                          size={64}
                          state={matrixState}
                          interactive={true}
                        />
                        <span className="matrix-card-name">{dir.title.split(':')[1]?.replace('(Saved)', '').trim()}</span>
                        <span className="matrix-card-style">
                          {activeGlobalDirection === dir.id ? '★ Active Style' : 'Click to preview'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : currentDirectionMeta ? (
            /* Single Direction Deep Dive */
            <>
              {/* Meta Card */}
              <div className="direction-meta-card">
                <div className="direction-meta-top">
                  <div>
                    <span className="direction-meta-title">{currentDirectionMeta.title}</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 13, marginLeft: 8 }}>
                      — {currentDirectionMeta.subtitle}
                    </span>
                  </div>
                  <span className="direction-inspiration-tag">{currentDirectionMeta.inspiration}</span>
                </div>
                <p className="direction-desc">{currentDirectionMeta.description}</p>
                <div className="direction-highlights">
                  {currentDirectionMeta.highlights.map((h, i) => (
                    <span key={i} className="direction-highlight-pill">
                      ✓ {h}
                    </span>
                  ))}
                </div>
              </div>

              {/* Interactive Hero Sandbox (120px) */}
              <div className="sandbox-section">
                <div className="sandbox-hero" style={{ minHeight: 180 }}>
                  <GemBlob
                    seed={sandboxSeed}
                    direction={currentDirectionMeta.id}
                    size={120}
                    state={sandboxState}
                    interactive={true}
                  />
                  <div className="sandbox-hint">Move cursor to test gaze tracking (no container bouncing)</div>
                  <span className="showcase-cell-name" style={{ fontSize: 14 }}>{sandboxSeed}</span>
                  <span className="instance-meta" style={{ fontSize: 11 }}>State: <strong>{sandboxState}</strong></span>
                </div>

                <div className="sandbox-controls">
                  <div className="control-group">
                    <span className="control-label">Agent Name / Seed</span>
                    <input
                      type="text"
                      className="custom-seed-input"
                      value={sandboxSeed}
                      onChange={(e) => setSandboxSeed(e.target.value)}
                      placeholder="Type agent name or seed..."
                    />
                  </div>

                  <div className="control-group">
                    <span className="control-label">Test Agent State Expression</span>
                    <div className="control-buttons-row">
                      {STATES.map((st) => (
                        <button
                          key={st.id}
                          className="control-btn"
                          data-selected={sandboxState === st.id}
                          onClick={() => setSandboxState(st.id)}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      className="primary-button"
                      style={{ width: 'auto', padding: '6px 14px', fontSize: 12 }}
                      onClick={() => setGlobalDirection(currentDirectionMeta.id)}
                    >
                      {activeGlobalDirection === currentDirectionMeta.id
                        ? '✓ Currently Active in UI'
                        : `Set as Active UI Style (${currentDirectionMeta.title.split(':')[1]?.trim()})`}
                    </button>
                    <button
                      className="icon-button"
                      onClick={() =>
                        setSandboxSeed(SAMPLE_AGENTS[Math.floor(Math.random() * SAMPLE_AGENTS.length)])
                      }
                    >
                      Randomize Agent
                    </button>
                  </div>
                </div>
              </div>

              {/* State Behaviors Showcase */}
              <div className="agent-grid-section">
                <div className="section-heading">
                  <span>State Animation Behaviors (In {themeMode} mode)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  {STATES.map((st) => (
                    <div
                      key={st.id}
                      className="showcase-cell"
                      style={{
                        padding: 16,
                        border: sandboxState === st.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSandboxState(st.id)}
                    >
                      <GemBlob
                        seed={sandboxSeed}
                        direction={currentDirectionMeta.id}
                        size={96}
                        state={st.id}
                        interactive={true}
                      />
                      <span className="showcase-cell-name" style={{ fontSize: 13, marginTop: 4 }}>
                        {st.label}
                      </span>
                      <span className="instance-meta" style={{ textAlign: 'center', fontSize: 11 }}>
                        {st.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shape Library (if Puffy Clay is selected, show curated 8 shapes) */}
              {currentDirectionMeta.id === 'puffy-clay' && (
                <div className="agent-grid-section">
                  <div className="section-heading">
                    <span>Curated 8-Shape Keeper Library (64px)</span>
                  </div>
                  <div className="showcase-grid">
                    {PUFFY_CLAY_SHAPES.map((shape, idx) => (
                      <div
                        key={shape.id}
                        className="showcase-cell"
                        onClick={() => setSandboxSeed(`shape-seed-${idx}-${shape.name}`)}
                        style={{ cursor: 'pointer' }}
                        title="Click to load into sandbox"
                      >
                        <GemBlob
                          seed={`shape-seed-${idx}-${shape.name}`}
                          direction="puffy-clay"
                          shapeIndex={idx}
                          size={64}
                          state={sandboxState}
                          interactive={true}
                        />
                        <span className="showcase-cell-name">#{idx + 1}: {shape.name}</span>
                        <span className="instance-meta" style={{ fontSize: 9.5 }}>{shape.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* UI Sizing Breakdown */}
              <div className="size-strip-section">
                <span className="control-label">UI Sizing Scale</span>
                <div className="size-strip">
                  {[
                    { size: 24, label: '24px (Chat Avatar)' },
                    { size: 44, label: '44px (Sidebar Rail)' },
                    { size: 64, label: '64px (Card View)' },
                    { size: 96, label: '96px (Showcase Large)' },
                  ].map((s) => (
                    <div key={s.size} className="size-item">
                      <GemBlob
                        seed={sandboxSeed}
                        direction={currentDirectionMeta.id}
                        size={s.size}
                        state={sandboxState}
                        interactive={true}
                      />
                      <span className="size-tag">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Generated Agent Roster Grid */}
              <div className="agent-grid-section">
                <div className="section-heading">
                  <span>Realistic Agent Roster in {currentDirectionMeta.title.split(':')[1]?.trim()}</span>
                  <button
                    className="icon-button"
                    style={{ fontSize: 11 }}
                    onClick={() => setSandboxSeed(SAMPLE_AGENTS[Math.floor(Math.random() * SAMPLE_AGENTS.length)])}
                  >
                    Shuffle Sample
                  </button>
                </div>

                <div className="showcase-grid">
                  {SAMPLE_AGENTS.map((agentName) => (
                    <div
                      key={agentName}
                      className="showcase-cell"
                      onClick={() => setSandboxSeed(agentName)}
                      style={{ cursor: 'pointer' }}
                      title="Click to load into sandbox"
                    >
                      <GemBlob
                        seed={agentName}
                        direction={currentDirectionMeta.id}
                        size={64}
                        state="idle"
                        interactive={true}
                      />
                      <span className="showcase-cell-name">{agentName}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="showcase-footer">
          <div className="showcase-active-indicator">
            Active UI Style: <strong>{BLOB_DIRECTIONS.find((d) => d.id === activeGlobalDirection)?.title}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="icon-button" onClick={() => setCurrentTab('matrix')}>
              Matrix View (All {BLOB_DIRECTIONS.length})
            </button>
            <button className="primary-button" style={{ width: 'auto' }} onClick={onClose}>
              Done Reviewing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
