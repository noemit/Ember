import * as React from 'react';
import GemBlob from './GemBlob';
import { PUFFY_CLAY_SHAPES } from './shapes';
import { PUFFY_CLAY_PALETTE } from './palette';
import type { BallState } from '../types';
import type { PuffyShape } from './types';

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

const STATES: { id: BallState; label: string; desc: string }[] = [
  { id: 'idle', label: 'Idle', desc: 'Organic breathing & floating bob movement' },
  { id: 'active', label: 'Active', desc: 'Busy procedural loop: hopping, scanning code, 360° backflips, shimmies & curious lean' },
  { id: 'needs-input', label: 'Needs Input', desc: 'Glowing beacon aura + animated talking mouth + alert badge' },
  { id: 'error', label: 'Error', desc: 'Hilarious spinning X eyes + shivering body' },
];

const CATEGORIES = ['All', 'Clouds & Organic', 'Creatures & Characters', 'Geometric & Puffs', 'Playful & Novelty'] as const;

export default function BlobShowcase({ onClose }: Props) {
  const [selectedShapeIndex, setSelectedShapeIndex] = React.useState<number>(0);
  const [selectedColorIndex, setSelectedColorIndex] = React.useState<number>(0);
  const [sandboxState, setSandboxState] = React.useState<BallState>('idle');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('All');
  const [cardSize, setCardSize] = React.useState<96 | 64>(96);
  const [activeTab, setActiveTab] = React.useState<'shapes' | 'states' | 'roster'>('shapes');

  const selectedShape: PuffyShape = PUFFY_CLAY_SHAPES[selectedShapeIndex] ?? PUFFY_CLAY_SHAPES[0];
  const selectedColor = PUFFY_CLAY_PALETTE[selectedColorIndex] ?? PUFFY_CLAY_PALETTE[0];

  const filteredShapes = React.useMemo(() => {
    if (categoryFilter === 'All') return PUFFY_CLAY_SHAPES.map((shape, index) => ({ shape, index }));
    return PUFFY_CLAY_SHAPES.map((shape, index) => ({ shape, index })).filter(
      (item) => item.shape.category === categoryFilter
    );
  }, [categoryFilter]);

  return (
    <div className="showcase-overlay" onClick={onClose}>
      <div className="showcase-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="showcase-header">
          <div className="showcase-header-top">
            <div className="showcase-title-group">
              <h2>
                3D Puffy Clay <span className="showcase-badge">Curated 8-Shape Suite</span>
              </h2>
              <p className="showcase-subtitle">
                Curated shapes with stretched subtle gradients, stable session seeds, and procedural active loops
              </p>
            </div>
            <button className="icon-button" onClick={onClose}>
              ✕ Close
            </button>
          </div>

          {/* Navigation & Category Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div className="showcase-nav-tabs">
              <button
                className="showcase-tab"
                data-active={activeTab === 'shapes'}
                onClick={() => setActiveTab('shapes')}
              >
                ★ 8 Selected Shapes ({PUFFY_CLAY_SHAPES.length})
              </button>
              <button
                className="showcase-tab"
                data-active={activeTab === 'states'}
                onClick={() => setActiveTab('states')}
              >
                ⚡ State Animations & Active Loop
              </button>
              <button
                className="showcase-tab"
                data-active={activeTab === 'roster'}
                onClick={() => setActiveTab('roster')}
              >
                👥 Live Agent Roster ({SAMPLE_AGENTS.length})
              </button>
            </div>

            {activeTab === 'shapes' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="control-label" style={{ fontSize: 10 }}>Card Size:</span>
                <button
                  className="control-btn"
                  data-selected={cardSize === 96}
                  onClick={() => setCardSize(96)}
                >
                  96px (Large)
                </button>
                <button
                  className="control-btn"
                  data-selected={cardSize === 64}
                  onClick={() => setCardSize(64)}
                >
                  64px (Compact)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="showcase-body">
          {/* Interactive Inspector Sandbox (Always accessible at top) */}
          <div className="sandbox-section">
            <div className="sandbox-hero">
              <GemBlob
                seed={`preview-${selectedShape.id}-${selectedColor.name}`}
                shapeIndex={selectedShapeIndex}
                colorIndex={selectedColorIndex}
                size={120}
                state={sandboxState}
                interactive={true}
              />
              <div className="sandbox-hint">Move cursor to test gaze tracking</div>
              <span className="showcase-cell-name" style={{ fontSize: 14 }}>
                #{selectedShapeIndex + 1}: {selectedShape.name}
              </span>
              <span className="instance-meta" style={{ fontSize: 11 }}>
                {selectedShape.category} • State: <strong>{sandboxState}</strong>
              </span>
            </div>

            <div className="sandbox-controls">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    {selectedShape.name}
                  </span>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
                    {selectedShape.description}
                  </p>
                </div>
                <span className="direction-inspiration-tag">{selectedShape.id}</span>
              </div>

              {/* State Toggles */}
              <div className="control-group">
                <span className="control-label">Test State Animation</span>
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

              {/* Colorway Switcher */}
              <div className="control-group">
                <span className="control-label">
                  Stretched Dual-Tone Palette: <strong>{selectedColor.name}</strong>
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PUFFY_CLAY_PALETTE.map((pal, idx) => (
                    <button
                      key={pal.name}
                      onClick={() => setSelectedColorIndex(idx)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: selectedColorIndex === idx ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: `linear-gradient(135deg, ${pal.light}, ${pal.base} 40%, ${pal.secondary ?? pal.dark} 70%, ${pal.dark})`,
                        cursor: 'pointer',
                        padding: 0,
                        transform: selectedColorIndex === idx ? 'scale(1.15)' : 'scale(1)',
                        transition: 'transform 0.1s ease',
                      }}
                      title={pal.name}
                    />
                  ))}
                </div>
              </div>

              {/* Sizing Scale Strip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 2 }}>
                <span className="control-label" style={{ fontSize: 10 }}>Scale:</span>
                {[
                  { size: 24, label: '24px (chat)' },
                  { size: 44, label: '44px (rail)' },
                  { size: 64, label: '64px' },
                  { size: 96, label: '96px' },
                ].map((s) => (
                  <div key={s.size} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <GemBlob
                      seed={`scale-${s.size}-${selectedShape.id}`}
                      shapeIndex={selectedShapeIndex}
                      colorIndex={selectedColorIndex}
                      size={s.size}
                      state={sandboxState}
                      interactive={false}
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TAB 1: 18 Shape Catalog */}
          {activeTab === 'shapes' && (
            <div className="agent-grid-section">
              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="control-label">Category:</span>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    className="control-btn"
                    data-selected={categoryFilter === cat}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Shapes Grid */}
              <div
                className="showcase-grid"
                style={{
                  gridTemplateColumns:
                    cardSize === 96
                      ? 'repeat(auto-fill, minmax(180px, 1fr))'
                      : 'repeat(auto-fill, minmax(130px, 1fr))',
                }}
              >
                {filteredShapes.map(({ shape, index }) => {
                  const isSelected = selectedShapeIndex === index;

                  return (
                    <div
                      key={shape.id}
                      className="showcase-cell"
                      onClick={() => setSelectedShapeIndex(index)}
                      style={{
                        padding: cardSize === 96 ? '18px 12px 14px' : '12px 8px 10px',
                        border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: isSelected ? 'var(--bg)' : 'var(--bg-elev)',
                        cursor: 'pointer',
                        transform: isSelected ? 'scale(1.02)' : 'none',
                      }}
                      title={`Click to inspect #${index + 1}: ${shape.name}`}
                    >
                      <span
                        style={{
                          alignSelf: 'flex-start',
                          fontSize: 10,
                          fontWeight: 700,
                          color: isSelected ? 'var(--accent)' : 'var(--text-dim)',
                        }}
                      >
                        #{index + 1}
                      </span>

                      <GemBlob
                        seed={`shape-catalog-${shape.id}`}
                        shapeIndex={index}
                        colorIndex={selectedColorIndex}
                        size={cardSize}
                        state={sandboxState}
                        interactive={true}
                      />

                      <span
                        className="showcase-cell-name"
                        style={{
                          fontSize: cardSize === 96 ? 13 : 11.5,
                          fontWeight: 700,
                          color: isSelected ? 'var(--accent)' : 'var(--text)',
                        }}
                      >
                        {shape.name}
                      </span>

                      <span
                        className="instance-meta"
                        style={{
                          fontSize: 10,
                          textAlign: 'center',
                          lineHeight: 1.3,
                          maxHeight: cardSize === 96 ? 32 : 16,
                          overflow: 'hidden',
                        }}
                      >
                        {shape.description}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: State Animations & Procedural Active Loop */}
          {activeTab === 'states' && (
            <div className="agent-grid-section">
              <div className="section-heading">
                <span>State Behaviors & Procedural Active Loop (96px High-Res)</span>
              </div>
              <p className="direction-desc" style={{ margin: 0 }}>
                Click any state below to inspect its behavior. Notice how the Active state procedurally shifts through random actions (hopping, scanning code, 360° backflips, shimmies, and curious lean) so it never looks like a canned loop.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
                {STATES.map((st) => (
                  <div
                    key={st.id}
                    className="showcase-cell"
                    style={{
                      padding: 18,
                      border: sandboxState === st.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSandboxState(st.id)}
                  >
                    <GemBlob
                      seed={`state-demo-${st.id}-${selectedShape.id}`}
                      shapeIndex={selectedShapeIndex}
                      colorIndex={selectedColorIndex}
                      size={96}
                      state={st.id}
                      interactive={true}
                    />
                    <span className="showcase-cell-name" style={{ fontSize: 14, marginTop: 6 }}>
                      {st.label}
                    </span>
                    <span className="instance-meta" style={{ textAlign: 'center', fontSize: 11, lineHeight: 1.4 }}>
                      {st.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Live Agent Roster Preview */}
          {activeTab === 'roster' && (
            <div className="agent-grid-section">
              <div className="section-heading">
                <span>Realistic Session Roster with 18-Shape Diversity (64px)</span>
                <button
                  className="icon-button"
                  style={{ fontSize: 11 }}
                  onClick={() => setSelectedColorIndex((c) => (c + 1) % PUFFY_CLAY_PALETTE.length)}
                >
                  Cycle Palette ({selectedColor.name})
                </button>
              </div>
              <p className="direction-desc" style={{ margin: 0 }}>
                Every agent seed automatically hashes to a unique body shape, stretched colorway, and eye style.
              </p>

              <div className="showcase-grid">
                {SAMPLE_AGENTS.map((agentName, idx) => (
                  <div
                    key={agentName}
                    className="showcase-cell"
                    onClick={() => setSelectedShapeIndex(idx % PUFFY_CLAY_SHAPES.length)}
                    style={{ cursor: 'pointer', padding: '14px 10px 12px' }}
                    title="Click to inspect this shape"
                  >
                    <GemBlob
                      seed={agentName}
                      size={64}
                      state={sandboxState}
                      interactive={true}
                    />
                    <span className="showcase-cell-name">{agentName}</span>
                    <span className="instance-meta" style={{ fontSize: 9.5 }}>
                      {PUFFY_CLAY_SHAPES[idx % PUFFY_CLAY_SHAPES.length].name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="showcase-footer">
          <div className="showcase-active-indicator">
            Selected Shape: <strong>#{selectedShapeIndex + 1} {selectedShape.name}</strong> ({selectedShape.category})
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="icon-button"
              onClick={() => setSelectedShapeIndex(Math.floor(Math.random() * PUFFY_CLAY_SHAPES.length))}
            >
              🎲 Random Shape
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
