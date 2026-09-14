import { describe, expect, test } from 'bun:test';
import {
  ARCHIVE_AGE_OPTIONS,
  bulkArchiveTargets,
  isSessionBusy,
} from './src/lib/bulkArchive';
import type { BallMood, Session } from './src/types';

const session = (id: string, updated: number): Session => ({ id, instanceId: 'local', updated });

const moods = (entries: Record<string, BallMood>): Record<string, BallMood> =>
  Object.fromEntries(Object.entries(entries).map(([id, mood]) => [`local::${id}`, mood]));

describe('bulk archive targets', () => {
  const now = 1_000_000_000_000;
  const list = [
    session('busy', now - 1000),
    session('idle', now - 1000),
    session('unread', now - 1000),
    session('failed', now - 1000),
    session('asked', now - 1000),
    session('approval', now - 1000),
    session('thinking', now - 1000),
  ];
  const moodMap = moods({
    busy: 'busy',
    idle: 'idle',
    unread: 'unread',
    failed: 'error',
    asked: 'question',
    approval: 'input',
    thinking: 'thinking',
  });

  test('never targets a busy, thinking, or waiting session', () => {
    const targets = bulkArchiveTargets(list, moodMap, { now });
    expect(targets.map((s) => s.id).sort()).toEqual(['failed', 'idle', 'unread']);
  });

  test('older-than narrows by last activity and still skips busy sessions', () => {
    const aged = [
      session('old-idle', now - 2 * 86_400_000),
      session('fresh-idle', now - 60_000),
      session('old-busy', now - 2 * 86_400_000),
    ];
    const targets = bulkArchiveTargets(aged, moods({ 'old-idle': 'idle', 'fresh-idle': 'idle', 'old-busy': 'busy' }), {
      olderThanHours: 24,
      now,
    });
    expect(targets.map((s) => s.id)).toEqual(['old-idle']);
  });

  test('exposes ordered age buckets and identifies busy moods', () => {
    expect(ARCHIVE_AGE_OPTIONS.map((option) => option.label)).toEqual([
      '1 day',
      '3 days',
      '1 week',
      '2 weeks',
      '1 month',
    ]);
    expect(isSessionBusy('busy')).toBe(true);
    expect(isSessionBusy('input')).toBe(true);
    expect(isSessionBusy('idle')).toBe(false);
    expect(isSessionBusy('error')).toBe(false);
    expect(isSessionBusy('unread')).toBe(false);
  });
});
