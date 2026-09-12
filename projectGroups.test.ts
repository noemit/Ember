import { describe, expect, test } from 'bun:test';
import { blobStripLayout, buildRailEntries } from './src/lib/projectGroups';
import type { Project, Session } from './src/types';

const session = (overrides: Partial<Session> & Pick<Session, 'id'>): Session => ({
  instanceId: 'local',
  ...overrides,
});

const projects: Record<string, Project[]> = {
  local: [
    { id: 'p1', name: 'Habit', path: '/work/habit' },
    { id: 'p2', name: 'Ember', path: '/work/ember' },
  ],
  remote: [{ id: 'p3', name: 'Studio', path: '/srv/studio' }],
};

describe('buildRailEntries', () => {
  test('groups configured-project sessions and leaves the rest standalone', () => {
    const entries = buildRailEntries(
      [
        session({ id: 'a', directory: '/work/habit', updated: 100 }),
        session({ id: 'b', directory: '/work/habit/src', updated: 300 }),
        session({ id: 'c', directory: '/tmp/scratch', updated: 200 }),
      ],
      projects
    );

    const habit = entries.find((entry) => entry.kind === 'project' && entry.project.id === 'p1');
    expect(habit?.kind).toBe('project');
    if (habit?.kind !== 'project') throw new Error('expected habit project');
    expect(habit.sessions.map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(habit.updated).toBe(300);

    // The configured project with no sessions (Ember) is absent.
    expect(entries.map((entry) => entry.id)).toEqual(['project:local::p1', 'local::c']);
  });

  test('puts a fork in the source project (same directory)', () => {
    const entries = buildRailEntries(
      [
        session({ id: 'source', directory: '/work/habit', updated: 100 }),
        session({ id: 'fork', directory: '/work/habit', updated: 400, parentId: undefined }),
      ],
      projects
    );
    const habit = entries.find((entry) => entry.kind === 'project' && entry.project.id === 'p1');
    if (habit?.kind !== 'project') throw new Error('expected habit project');
    expect(habit.sessions.map((entry) => entry.id)).toEqual(['fork', 'source']);
  });

  test('interleaves project cards and standalone rows by recency', () => {
    const entries = buildRailEntries(
      [
        session({ id: 'standalone', directory: '/tmp/x', updated: 500 }),
        session({ id: 'habit', directory: '/work/habit', updated: 300 }),
        session({ id: 'ember', directory: '/work/ember', updated: 400 }),
      ],
      projects
    );
    expect(entries.map((entry) => entry.id)).toEqual([
      'local::standalone',
      'project:local::p2',
      'project:local::p1',
    ]);
  });

  test('omits configured projects that own no sessions', () => {
    expect(buildRailEntries([], projects)).toEqual([]);
    expect(
      buildRailEntries([], { local: [{ id: 'nopath', name: 'No path' }, { id: 'empty', name: 'Empty', path: '/work/empty' }] })
    ).toEqual([]);
  });
});

describe('blobStripLayout', () => {
  test('renders small counts at full size', () => {
    expect(blobStripLayout(0, 280)).toEqual({ size: 30, visible: 0, overflow: 0 });
    expect(blobStripLayout(3, 280)).toEqual({ size: 30, visible: 3, overflow: 0 });
    expect(blobStripLayout(4, 280)).toEqual({ size: 30, visible: 4, overflow: 0 });
  });

  test('shrinks as the count grows', () => {
    expect(blobStripLayout(5, 280).size).toBe(28);
    expect(blobStripLayout(10, 280).size).toBe(18);
    expect(blobStripLayout(40, 280).size).toBe(18);
  });

  test('falls back to a +N chip when the minimum size no longer fits', () => {
    const layout = blobStripLayout(20, 280);
    expect(layout.size).toBe(18);
    expect(layout.overflow).toBe(9);
    expect(layout.visible).toBe(11);
  });

  test('reduces the visible count in a narrow strip', () => {
    expect(blobStripLayout(6, 100)).toEqual({ size: 26, visible: 2, overflow: 4 });
  });
});
