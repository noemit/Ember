import { describe, expect, test } from 'bun:test';
import { newSessionDirectoryPrefill, newSessionModelPrefill } from './src/lib/newSessionDefaults';
import type { Session } from './src/types';

const session = (partial: Partial<Session>): Session => ({ id: 'x', instanceId: 'local', ...partial });

describe('new agent folder prefill', () => {
  const sessions = [
    session({ id: 'old', directory: '/work/old', updated: 100 }),
    session({ id: 'new', directory: '/work/new', updated: 200 }),
    session({ id: 'nodir', updated: 300 }),
  ];
  const projects = [
    { id: 'a', name: 'a', path: '/proj/a', lastOpenedAt: 50 },
    { id: 'b', name: 'b', path: '/proj/b', lastOpenedAt: 90 },
    { id: 'c', name: 'c' },
  ];

  test('saved default folder wins', () => {
    expect(newSessionDirectoryPrefill(sessions, projects, { directory: '/saved' })).toBe('/saved');
  });

  test('most recently updated session directory beats projects', () => {
    expect(newSessionDirectoryPrefill(sessions, projects, {})).toBe('/work/new');
  });

  test('falls back to the last-opened project, then nothing', () => {
    expect(newSessionDirectoryPrefill([], projects, {})).toBe('/proj/b');
    expect(newSessionDirectoryPrefill([], [{ id: 'c', name: 'c' }], {})).toBeNull();
  });
});

describe('new agent model prefill', () => {
  test('last used model and its variant come first', () => {
    const sessions = [
      session({ id: 'a', updated: 1, model: { providerID: 'p', modelID: 'old' } }),
      session({ id: 'b', updated: 2, model: { providerID: 'p', modelID: 'new', variant: 'high' } }),
      session({ id: 'c', updated: 3 }),
    ];
    expect(newSessionModelPrefill(sessions, { model: { providerID: 'p', modelID: 'setting' } })).toEqual({
      key: 'p/new',
      variant: 'high',
    });
  });

  test('per-instance setting when no session has a model; server default otherwise', () => {
    expect(newSessionModelPrefill([], { model: { providerID: 'p', modelID: 'setting' }, variant: 'low' })).toEqual({
      key: 'p/setting',
      variant: 'low',
    });
    expect(newSessionModelPrefill([session({ id: 'a' })], {})).toBeNull();
  });
});
