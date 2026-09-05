import { describe, expect, test } from 'bun:test';
import { blobColor } from './src/blob/color';
import { contrastRatio, GLYPH_COLORS, glyphPaletteFor, instanceMarkerPaletteFor } from './src/blob/contrast';
import { deriveCritter } from './src/blob/CritterBlob';
import { allocateProjectColors, hashString, mulberry32, resolveAvatarIdentity } from './src/blob/seed';
import { GROK_COLORS } from './src/blob/grok';
import { THEMES } from './src/themes';
import type { Project, Session } from './src/types';

describe('theme accessibility', () => {
  test('offers only the neutral color options', () => {
    expect(THEMES.map((theme) => theme.name)).toEqual(['Stone', 'Clay', 'Graphite']);
  });

  test('keeps normal and muted text at WCAG AA contrast on every surface', () => {
    for (const theme of THEMES) {
      const { bg, panel, elev, text, dim } = theme.palette;
      for (const surface of [bg, panel, elev]) {
        expect(contrastRatio(text, surface), `${theme.id} text on ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(dim, surface), `${theme.id} muted text on ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.palette.warning, surface), `${theme.id} warning on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('keeps highlighted and user bubble text at WCAG AA contrast', () => {
    for (const theme of THEMES) {
      expect(
        contrastRatio(theme.palette.highlightText, theme.palette.highlight),
        `${theme.id} highlight text`
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(theme.palette.userBubbleText, theme.palette.userBubble),
        `${theme.id} user bubble text`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('blob colours', () => {
  test('keeps avatar and instance marker colors distinguishable on every surface', () => {
    for (const theme of THEMES) {
      const surfaces = [theme.palette.panel, theme.palette.elev, theme.palette.bg];
      for (const color of [...glyphPaletteFor(surfaces), ...instanceMarkerPaletteFor(surfaces)]) {
        for (const surface of surfaces) {
          expect(contrastRatio(color, surface)).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  test('allocates every project color before cycling and preserves existing assignments', () => {
    const keys = Array.from({ length: 65 }, (_, index) => `project:local::${String(index).padStart(2, '0')}`);
    const assignments = allocateProjectColors(keys, { [keys[10]]: 42 });
    expect(new Set(keys.slice(0, 64).map((key) => assignments[key])).size).toBe(64);
    expect(assignments[keys[10]]).toBe(42);
    expect(Object.values(assignments).every((index) => index >= 0 && index < 64)).toBe(true);
  });

  test('preserves legacy colors when no grouped identity is supplied', () => {
    for (const seed of ['alpha', 'beta', 'gamma']) {
      const grokRng = mulberry32(hashString(`grok:${seed}`));
      expect(blobColor('grok', seed)).toBe(
        GROK_COLORS[Math.floor(grokRng() * GROK_COLORS.length)].fill
      );
      const glyphRng = mulberry32(hashString(`glyph:${seed}`));
      glyphRng();
      expect(blobColor('glyph', seed)).toBe(`var(--glyph-${Math.floor(glyphRng() * GLYPH_COLORS.length)})`);
    }
  });

  test('groups project colors while keeping ordinary session shapes distinct', () => {
    const projects: Project[] = [{ id: 'ember', name: 'Ember', path: '/workspace/ember' }];
    const first: Session = { id: 'one', instanceId: 'local', directory: '/workspace/ember' };
    const second: Session = { id: 'two', instanceId: 'local', directory: '/workspace/ember/src' };
    const firstIdentity = resolveAvatarIdentity(first, projects, {}, {});
    const secondIdentity = resolveAvatarIdentity(second, projects, {}, {});

    expect(firstIdentity.colorSeed).toBe(secondIdentity.colorSeed);
    expect(firstIdentity.shapeSeed).not.toBe(secondIdentity.shapeSeed);
    expect(blobColor('glyph', firstIdentity)).toBe(blobColor('glyph', secondIdentity));
    expect(blobColor('grok', firstIdentity)).toBe(blobColor('grok', secondIdentity));
    expect(blobColor('grok', firstIdentity)).toBe(blobColor('glyph', firstIdentity));
    expect(blobColor('grok', firstIdentity)).toMatch(/^var\(--glyph-(?:[0-9]|[1-5][0-9]|6[0-3])\)$/);
  });

  test('uses scheduled tasks for shape and sessions for motion', () => {
    const first: Session = { id: 'run-one', instanceId: 'local', directory: '/workspace/ember' };
    const second: Session = { id: 'run-two', instanceId: 'local', directory: '/workspace/ember' };
    const taskKey = 'task:local::ember::daily-review';
    const bindings = {
      'local::run-one': taskKey,
      'local::run-two': taskKey,
    };
    const firstIdentity = resolveAvatarIdentity(first, [], bindings, {});
    const secondIdentity = resolveAvatarIdentity(second, [], bindings, {});

    expect(firstIdentity.shapeSeed).toBe(secondIdentity.shapeSeed);
    expect(firstIdentity.motionSeed).not.toBe(secondIdentity.motionSeed);
  });

  test('applies project, task, then session overrides per trait', () => {
    const session: Session = { id: 'run', instanceId: 'local', directory: '/workspace/ember' };
    const projects: Project[] = [{ id: 'ember', name: 'Ember', path: '/workspace/ember' }];
    const taskKey = 'task:local::ember::daily-review';
    const identity = resolveAvatarIdentity(
      session,
      projects,
      { 'local::run': taskKey },
      {
        'project:local::ember': { colorIndex: 1, shapeName: 'tree' },
        [taskKey]: { colorIndex: 2 },
        'session:local::run': { shapeName: 'cloud' },
      }
    );

    expect(identity.colorIndex).toBe(2);
    expect(identity.shapeName).toBe('cloud');
  });

  test('keeps the lightweight critter colour selector in sync with the renderer', () => {
    for (const seed of ['alpha', 'beta', 'gamma', 'delta', 'epsilon']) {
      expect(blobColor('critter', seed)).toBe(`var(--critter-${deriveCritter(seed).colorIndex})`);
    }
  });
});
