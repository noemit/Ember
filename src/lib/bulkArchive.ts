import { sessionKey } from '../types';
import type { BallMood, Session } from '../types';

/**
 * Moods where the agent is working or blocked on the user. Bulk archive must never touch these,
 * so a running turn isn't interrupted and a pending question/approval isn't thrown away.
 */
export const isSessionBusy = (mood: BallMood): boolean =>
  mood === 'busy' || mood === 'thinking' || mood === 'input' || mood === 'question';

/** Age buckets offered by the card's "older than…" menu. */
export const ARCHIVE_AGE_OPTIONS: Array<{ label: string; hours: number }> = [
  { label: '1 day', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '1 week', hours: 24 * 7 },
  { label: '2 weeks', hours: 24 * 14 },
  { label: '1 month', hours: 24 * 30 },
];

/**
 * The sessions a bulk archive would hit: everything that isn't busy/blocked, optionally narrowed
 * to those whose last activity is older than `olderThanHours`.
 */
export const bulkArchiveTargets = (
  sessions: Session[],
  moods: Record<string, BallMood>,
  options: { olderThanHours?: number; now: number }
): Session[] => {
  const cutoff =
    options.olderThanHours === undefined ? null : options.now - options.olderThanHours * 3_600_000;
  return sessions.filter((session) => {
    if (isSessionBusy(moods[sessionKey(session)] ?? 'idle')) return false;
    if (cutoff !== null && (session.updated ?? 0) >= cutoff) return false;
    return true;
  });
};

/**
 * Scheduled-task runs that are safe to auto-archive: bound to a task, past the age limit, not
 * open in the workspace, and not working or waiting on the user. Bindings accumulate as each
 * run becomes the task's `lastSessionId`, so this covers every run Ember has observed — and an
 * archived run still shows in the scheduled view through that same binding.
 */
export const staleScheduledRuns = (
  sessions: Session[],
  bindings: Record<string, string>,
  moods: Record<string, BallMood>,
  openKeys: ReadonlySet<string>,
  now: number,
  olderThanHours = 24
): Session[] => {
  const cutoff = now - olderThanHours * 3_600_000;
  return sessions.filter((session) => {
    const key = sessionKey(session);
    if (!bindings[key] || session.archived || openKeys.has(key)) return false;
    if ((session.updated ?? 0) >= cutoff) return false;
    return !isSessionBusy(moods[key] ?? 'idle');
  });
};
