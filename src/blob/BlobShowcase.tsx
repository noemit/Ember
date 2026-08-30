import * as React from 'react';
import GemBlob from './GemBlob';
import { BLOB_DIRECTIONS, type BlobDirection } from './types';
import { PUFFY_CLAY_SHAPES } from './shapes';
import { PUFFY_CLAY_PALETTE } from './palette';
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
  { id: 'idle', label: 'Idle (Breathing)', desc: 'Subtle organic breathing & floating bob movement' },
  { id: 'active', label: 'Active (Bouncy)', desc: 'Joyful bouncy spring squash & stretch' },
  { id: 'needs-input', label: 'Needs Input (Yelling & Glowing)', desc: 'Radiant glowing beacon aura + yelling chattering mouth + alert badge' },
  { id: 'error', label: 'Error (Hilarious Dizzy)', desc: 'Hilarious spinning X eyes + wobbly shivering body' },
];

export default function BlobShowcase({ onClose }: Props) {
  const [activeGlobalDirection, setGlobalDirection] = useActiveBlobDirection();
  const [currentTab, setCurrentTab] = React.useState<BlobDirection | 'matrix'>(activeGlobalDirection);
  const [sandboxSeed, setSandboxSeed] = React.useState('Habit QA');
  const [sandboxState, setSandboxState] = React.useState<BallState>('idle');
  const [matrixState, setMatrixState] = React.useState<BallState>('idle');
  const [customMatrixSeed, setCustomMatrixSeed] = React.useState('');

  const currentDirectionMeta = BLOB_DIRECTIONS.find((d) => d.id === currentTab);

  return (
    <div className="showcase-overlay" onClick={onClose}>
      <div className="showcase-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="showcase-header">
          <div className="showcase-header-top">
            <div className="showcase-title-group">
              <h2>
                Agent Personality Showcase <span className="showcase-badge">3D Puffy Clay Suite</span>
              </h2>
              <p className="showcase-subtitle">
                Tactile 3D volumetric puffy creatures with stretched subtle gradients, animated states, and interactive gaze
              </p>
            </div>
            <button className="icon-button" onClick={onClose}>
              ✕ Close
            </button>
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
              ⊞ All 5 Side-by-Side Matrix
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="showcase-body">
          {currentTab === 'puffy-clay' ? (
            /* Dedicated 3D Puffy Clay Variants Suite */
            <>
              {/* Meta Card */}
              <div className="direction-meta-card">
                <div className="direction-meta-top">
                  <div>
                    <span className="direction-meta-title">3D Puffy Clay — Personality & Variant Suite</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 13, marginLeft: 8 }}>
                      (Selected Direction)
                    </span>
                  </div>
                  <span className="direction-inspiration-tag">synced/agent-personality</span>
                </div>
                <p className="direction-desc">
                  Featuring stretched subtle dual-tone gradients, gentle idle breathing movement, a hilarious yelling/glowing beacon for needs-input, 8 organic body shapes, 10 stretched colorways, and large 3D glossy cartoon eyes with interactive gaze tracking.
                </p>
                <div className="direction-highlights">
                  <span className="direction-highlight-pill">✓ Idle Organic Breathing Movement</span>
                  <span className="direction-highlight-pill">✓ Needs-Input: Glowing Aura Beacon + Chattering Mouth + Alert Badge</span>
                  <span className="direction-highlight-pill">✓ Active: Joyful Bouncy Spring Squash/Stretch</span>
                  <span className="direction-highlight-pill">✓ Error: Hilarious Spinning X Eyes</span>
                  <span className="direction-highlight-pill">✓ Stretched Subtle Dual-Tone Gradients</span>
                  <span className="direction-highlight-pill">✓ Prioritizes 64px & 96px UI Presence</span>
                </div>
              </div>

              {/* Interactive Hero Sandbox */}
              <div className="sandbox-section">
                <div className="sandbox-hero">
                  <GemBlob
                    seed={sandboxSeed}
                    direction="puffy-clay"
                    size={120}
                    state={sandboxState}
                    interactive={true}
                  />
                  <div className="sandbox-hint">Move cursor to test eye gaze tracking</div>
                  <span className="showcase-cell-name" style={{ fontSize: 14 }}>{sandboxSeed}</span>
                  <span className="instance-meta" style={{ fontSize: 11 }}>State: {sandboxState}</span>
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
                    <span className="control-label">Test Agent State Animations</span>
                    <div className="control-buttons-row">
                      {STATES.map((st) => (
                        <button
                          key={st.id}
                          className="control-btn"
                          data-selected={sandboxState === st.id}
                          onClick={() => setSandboxState(st.id)}
                        >
                          {st.label.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      className="primary-button"
                      style={{ width: 'auto', padding: '6px 14px', fontSize: 12 }}
                      onClick={() => setGlobalDirection('puffy-clay')}
                    >
                      {activeGlobalDirection === 'puffy-clay'
                        ? '✓ Currently Active in UI'
                        : 'Set 3D Puffy Clay as Active UI Style'}
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

              {/* State Behaviors Showcase (96px High-Res) */}
              <div className="agent-grid-section">
                <div className="section-heading">
                  <span>State Animation Behaviors (96px High-Res)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  {STATES.map((st) => (
                    <div
                      key={st.id}
                      className="showcase-cell"
                      style={{
                        padding: 16,
                        border: sandboxState === st.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSandboxState(st.id)}
                    >
                      <GemBlob
                        seed={sandboxSeed}
                        direction="puffy-clay"
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

              {/* 8 Body Shape Silhouettes (64px) */}
              <div className="agent-grid-section">
                <div className="section-heading">
                  <span>8 Body Shape Silhouettes (64px)</span>
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
                        size={64}
                        state={sandboxState}
                        interactive={true}
                      />
                      <span className="showcase-cell-name">{shape.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 10 Stretched Subtle Colorways (64px) */}
              <div className="agent-grid-section">
                <div className="section-heading">
                  <span>10 Stretched Subtle Dual-Tone Colorways (64px)</span>
                </div>
                <div className="showcase-grid">
                  {PUFFY_CLAY_PALETTE.map((pal, idx) => (
                    <div
                      key={pal.name}
                      className="showcase-cell"
                      onClick={() => setSandboxSeed(`color-seed-${idx}-${pal.name}`)}
                      style={{ cursor: 'pointer' }}
                      title="Click to load into sandbox"
                    >
                      <GemBlob
                        seed={`color-seed-${idx}-${pal.name}`}
                        direction="puffy-clay"
                        size={64}
                        state={sandboxState}
                        interactive={true}
                      />
                      <span className="showcase-cell-name">{pal.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* UI Sizing Breakdown */}
              <div className="size-strip-section">
                <span className="control-label">UI Sizing Scale (24px, 44px, 64px, 96px, 128px)</span>
                <div className="size-strip">
                  {[
                    { size: 24, label: '24px (Chat Avatar / Tool Calls)' },
                    { size: 44, label: '44px (Sidebar Session List)' },
                    { size: 64, label: '64px (Card / Panel View)' },
                    { size: 96, label: '96px (Showcase High-Res)' },
                    { size: 128, label: '128px (Hero Avatar)' },
                  ].map((s) => (
                    <div key={s.size} className="size-item">
                      <GemBlob
                        seed={sandboxSeed}
                        direction="puffy-clay"
                        size={s.size}
                        state={sandboxState}
                        interactive={true}
                      />
                      <span className="size-tag">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Generated Agent Samples (64px) */}
              <div className="agent-grid-section">
                <div className="section-heading">
                  <span>Live Agent Roster in 3D Puffy Clay (64px)</span>
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
                        direction="puffy-clay"
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
          ) : currentTab === 'matrix' ? (
            /* Matrix Comparison View */
            <div className="matrix-container">
              <div className="direction-meta-card">
                <div className="direction-meta-top">
                  <span className="direction-meta-title">Side-by-Side Comparison Matrix</span>
                  <span className="direction-inspiration-tag">Compare All 5 Directions</span>
                </div>
                <p className="direction-desc">
                  Review the exact same agent seeds and states rendered simultaneously across all 5 design directions.
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
                          {st.label.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 200 }}>
                    <input
                      type="text"
                      className="custom-seed-input"
                      placeholder="Type any agent name to test across all 5..."
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
                  <div className="matrix-columns">
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
                        <span className="matrix-card-name">{dir.title.split(':')[1]}</span>
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
                  <div className="matrix-columns">
                    {BLOB_DIRECTIONS.map((dir) => (
                      <div
                        key={dir.id}
                        className="matrix-card"
                        onClick={() => {
                          setGlobalDirection(dir.id);
                          setCurrentTab(dir.id);
                        }}
                        title={`Click to switch app to ${dir.title}`}
                      >
                        <GemBlob
                          seed={item.seed}
                          direction={dir.id}
                          size={64}
                          state={matrixState}
                          interactive={true}
                        />
                        <span className="matrix-card-name">{dir.title.split(':')[1]}</span>
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
            /* Other Direction Preview */
            <>
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
              </div>

              <div className="sandbox-section">
                <div className="sandbox-hero">
                  <GemBlob
                    seed={sandboxSeed}
                    direction={currentDirectionMeta.id}
                    size={110}
                    state={sandboxState}
                    interactive={true}
                  />
                  <span className="showcase-cell-name">{sandboxSeed}</span>
                </div>

                <div className="sandbox-controls">
                  <div className="control-group">
                    <span className="control-label">Agent Name / Seed</span>
                    <input
                      type="text"
                      className="custom-seed-input"
                      value={sandboxSeed}
                      onChange={(e) => setSandboxSeed(e.target.value)}
                    />
                  </div>

                  <div className="control-group">
                    <span className="control-label">Test Agent State</span>
                    <div className="control-buttons-row">
                      {STATES.map((st) => (
                        <button
                          key={st.id}
                          className="control-btn"
                          data-selected={sandboxState === st.id}
                          onClick={() => setSandboxState(st.id)}
                        >
                          {st.label.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    className="primary-button"
                    style={{ width: 'auto', padding: '6px 14px', fontSize: 12, marginTop: 4 }}
                    onClick={() => setGlobalDirection(currentDirectionMeta.id)}
                  >
                    Set as Active UI Style
                  </button>
                </div>
              </div>

              <div className="agent-grid-section">
                <div className="section-heading">
                  <span>Samples (64px)</span>
                </div>
                <div className="showcase-grid">
                  {SAMPLE_AGENTS.map((agentName) => (
                    <div
                      key={agentName}
                      className="showcase-cell"
                      onClick={() => setSandboxSeed(agentName)}
                      style={{ cursor: 'pointer' }}
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
            <button className="icon-button" onClick={() => setCurrentTab('puffy-clay')}>
              3D Puffy Suite
            </button>
            <button className="icon-button" onClick={() => setCurrentTab('matrix')}>
              Matrix View
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
