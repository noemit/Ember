import { describe, expect, test } from 'bun:test';
import {
  formatSessionKey,
  MAX_OPEN_SESSIONS,
  parseSessionKey,
  pruneWorkspace,
  visibleColumns,
} from './src/lib/workspace';

describe('workspace session keys', () => {
  test('round-trips instance and session ids', () => {
    const ref = { instanceId: 'local', sessionId: 'ses_123' };
    expect(parseSessionKey(formatSessionKey(ref))).toEqual(ref);
    expect(formatSessionKey(ref)).toBe('local::ses_123');
    // A session id containing the separator still parses (first separator wins).
    expect(parseSessionKey('local::ses::weird')).toEqual({ instanceId: 'local', sessionId: 'ses::weird' });
  });

  test('rejects malformed keys', () => {
    expect(parseSessionKey(null)).toBeNull();
    expect(parseSessionKey('')).toBeNull();
    expect(parseSessionKey('noseparator')).toBeNull();
    expect(parseSessionKey('::session')).toBeNull();
    expect(parseSessionKey('instance::')).toBeNull();
  });
});

describe('visible columns', () => {
  const open = ['a', 'b', 'c', 'd'];

  test('caps by width but always shows at least one', () => {
    expect(visibleColumns(open, new Set(), 1000, 420)).toEqual(['a', 'b']);
    expect(visibleColumns(open, new Set(), 420, 420)).toEqual(['a']);
    expect(visibleColumns(open, new Set(), 100, 420)).toEqual(['a']);
    expect(visibleColumns(open, new Set(), 0, 420)).toEqual(open);
  });

  test('skips minimized sessions and keeps open order', () => {
    expect(visibleColumns(open, new Set(['a', 'c']), 1000, 420)).toEqual(['b', 'd']);
    expect(visibleColumns(open, new Set(open), 1000, 420)).toEqual([]);
  });
});

describe('workspace pruning', () => {
  test('drops keys whose session is archived, missing, or unparseable', () => {
    const sessions: Record<string, string[]> = { local: ['a', 'b'], remote: ['x'] };
    const check = (ref: { instanceId: string; sessionId: string }) =>
      sessions[ref.instanceId]?.includes(ref.sessionId) ?? undefined;

    expect(
      pruneWorkspace(
        {
          open: ['local::a', 'local::gone', 'broken', 'remote::x', 'remote::y'],
          active: 'local::a',
          minimized: ['local::gone', 'remote::y'],
        },
        check
      )
    ).toEqual({
      open: ['local::a', 'remote::x'],
      active: 'local::a',
      minimized: [],
    });
  });

  test('keeps unknown instances and sessions while lists load, and a null draft active', () => {
    const check = () => undefined;
    expect(
      pruneWorkspace(
        { open: ['local::a'], active: null, minimized: ['local::a'] },
        check
      )
    ).toEqual({ open: ['local::a'], active: null, minimized: ['local::a'] });
  });

  test('re-points active at the first open non-minimized session when it is gone', () => {
    const check = (ref: { instanceId: string; sessionId: string }) => ref.sessionId !== 'old';
    expect(
      pruneWorkspace(
        { open: ['local::old', 'local::b', 'local::c'], active: 'local::old', minimized: ['local::b'] },
        check
      )
    ).toEqual({ open: ['local::b', 'local::c'], active: 'local::c', minimized: ['local::b'] });
  });

  test('caps the open list', () => {
    const open = Array.from({ length: MAX_OPEN_SESSIONS + 3 }, (_, index) => `local::s${index}`);
    const pruned = pruneWorkspace({ open, active: open[0], minimized: [] }, () => true);
    expect(pruned.open).toHaveLength(MAX_OPEN_SESSIONS);
    expect(pruned.open[0]).toBe('local::s0');
    expect(pruned.open.at(-1)).toBe(`local::s${MAX_OPEN_SESSIONS - 1}`);
  });
});
