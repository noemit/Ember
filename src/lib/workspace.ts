import type { SessionRef } from '../types';

/** Soft cap on side-by-side columns; extras collapse into the numbered tab strip. */
export const MIN_COLUMN_WIDTH = 420;

/** Hard cap on how many sessions can be open at once. */
export const MAX_OPEN_SESSIONS = 8;

/** Split an `"instance::session"` workspace key back into its parts; null when malformed. */
export const parseSessionKey = (key: string | null | undefined): SessionRef | null => {
  if (!key) return null;
  const separator = key.indexOf('::');
  if (separator <= 0 || separator >= key.length - 2) return null;
  const instanceId = key.slice(0, separator);
  const sessionId = key.slice(separator + 2);
  if (!instanceId || !sessionId) return null;
  return { instanceId, sessionId };
};

/** Inverse of `parseSessionKey`, kept here so the format is defined in one place. */
export const formatSessionKey = (ref: SessionRef): string => `${ref.instanceId}::${ref.sessionId}`;

/**
 * The open sessions that fit as columns at a given width: open, not manually minimized, in
 * open order, capped by `floor(width / minWidth)` but never below one. Extra open sessions
 * stay open as numbered tabs.
 */
export const visibleColumns = (
  open: readonly string[],
  minimized: ReadonlySet<string>,
  width: number,
  minWidth = MIN_COLUMN_WIDTH
): string[] => {
  const candidates = open.filter((key) => !minimized.has(key));
  if (candidates.length === 0) return [];
  if (!Number.isFinite(width) || width <= 0 || minWidth <= 0) return candidates;
  const capacity = Math.max(1, Math.floor(width / minWidth));
  return candidates.slice(0, Math.min(capacity, candidates.length));
};

export type Workspace = {
  open: string[];
  active: string | null;
  minimized: string[];
};

/**
 * Validate a workspace key. Returns `false` to drop it, `true` to keep it, and `undefined` when
 * the answer isn't known yet (the instance's session list hasn't loaded), which also keeps it.
 */
export type WorkspaceKeyCheck = (ref: SessionRef) => boolean | undefined;

/**
 * Drop stale/duplicate open and minimized keys and re-point `active` at the first open,
 * non-minimized session when the active one is gone. A `null` active is preserved so a
 * new-agent draft can occupy the workspace without a session being selected.
 */
export const pruneWorkspace = (
  workspace: Workspace,
  check: WorkspaceKeyCheck,
  maxOpen = MAX_OPEN_SESSIONS
): Workspace => {
  const keep = (key: string): boolean => {
    const ref = parseSessionKey(key);
    if (!ref) return false;
    return check(ref) !== false;
  };

  const open = workspace.open.filter(keep).slice(0, maxOpen);
  const minimized = [...new Set(workspace.minimized.filter(keep))];
  const minimizedSet = new Set(minimized);

  let active = workspace.active;
  if (active !== null && (!keep(active) || !open.includes(active) || minimizedSet.has(active))) {
    active = open.find((key) => !minimizedSet.has(key)) ?? null;
  }

  return { open, active, minimized };
};

/** Structural equality for workspace snapshots, so state setters can bail when nothing changed. */
export const sameWorkspace = (a: Workspace, b: Workspace): boolean =>
  a.active === b.active &&
  a.open.length === b.open.length &&
  a.open.every((key, index) => key === b.open[index]) &&
  a.minimized.length === b.minimized.length &&
  a.minimized.every((key, index) => key === b.minimized[index]);
