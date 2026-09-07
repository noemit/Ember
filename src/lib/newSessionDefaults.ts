import { modelRefKey } from '../types';
import type { InstanceDefaults, Project, Session } from '../types';

const byRecency = <T extends { updated?: number }>(a: T, b: T) => (b.updated ?? 0) - (a.updated ?? 0);

/**
 * Where a new agent should start on an instance: the saved default folder, then the directory
 * of the most recently updated session (real recent work), then the project opened most
 * recently in OpenChamber.
 */
export const newSessionDirectoryPrefill = (
  sessions: Session[],
  projects: Project[],
  defaults: InstanceDefaults
): string | null => {
  if (defaults.directory) return defaults.directory;
  const recentSession = [...sessions].filter((session) => session.directory).sort(byRecency)[0]?.directory;
  if (recentSession) return recentSession;
  const recentProject = projects
    .filter((project) => project.path && project.lastOpenedAt)
    .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))[0]?.path;
  return recentProject ?? null;
};

export type ModelPrefill = { key: string; variant: string };

/**
 * Model for a new agent: whatever the instance's most recent session used (with its reasoning
 * variant), then the per-instance default setting. `null` means the server default.
 */
export const newSessionModelPrefill = (sessions: Session[], defaults: InstanceDefaults): ModelPrefill | null => {
  const recent = [...sessions].filter((session) => session.model).sort(byRecency)[0]?.model;
  if (recent) return { key: modelRefKey(recent), variant: recent.variant ?? '' };
  if (defaults.model) {
    return { key: modelRefKey(defaults.model), variant: defaults.variant ?? defaults.model.variant ?? '' };
  }
  return null;
};
