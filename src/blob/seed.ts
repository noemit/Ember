import { sessionKey } from '../types';
import { AVATAR_COLOR_COUNT } from './contrast';
import type { AvatarIdentity, AvatarOverride, Project, Session } from '../types';

export const hashString = (value: string): number => {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Traits = {
  styleIndex: number;
  colorIndex: number;
  shapeIndex: number;
  eyeIndex: number;
};

export const deriveTraits = (seed: string): Traits => {
  const rng = mulberry32(hashString(seed));
  return {
    styleIndex: Math.floor(rng() * 3),
    colorIndex: Math.floor(rng() * 12),
    shapeIndex: Math.floor(rng() * 6),
    eyeIndex: Math.floor(rng() * 3),
  };
};

export const normalizeDirectory = (value: string): string => value.replace(/[\\/]+$/, '');

export const projectForSession = (session: Session, projects: Project[]): Project | null => {
  const directory = session.directory ? normalizeDirectory(session.directory) : '';
  let best: Project | null = null;
  let bestLength = -1;
  projects.forEach((project) => {
    if (!project.path) return;
    const base = normalizeDirectory(project.path);
    if (
      (directory === base || directory.startsWith(`${base}/`) || directory.startsWith(`${base}\\`)) &&
      base.length > bestLength
    ) {
      best = project;
      bestLength = base.length;
    }
  });
  return best;
};

export const sessionAvatarKey = (session: Session): string => `session:${sessionKey(session)}`;
export const projectIdentityKey = (instanceId: string, projectId: string): string =>
  `project:${instanceId}::${projectId}`;

export const allocateProjectColors = (
  projectKeys: string[],
  current: Record<string, number>
): Record<string, number> => {
  const assignments = { ...current };
  const counts = Array.from({ length: AVATAR_COLOR_COUNT }, () => 0);
  Object.values(assignments).forEach((index) => {
    if (Number.isInteger(index) && index >= 0 && index < AVATAR_COLOR_COUNT) counts[index] += 1;
  });
  [...new Set(projectKeys)].sort().forEach((key) => {
    if (Number.isInteger(assignments[key])) return;
    const minimum = Math.min(...counts);
    const index = counts.findIndex((count) => count === minimum);
    assignments[key] = index;
    counts[index] += 1;
  });
  return assignments;
};

export const projectAvatarKey = (session: Session, project: Project | null): string | undefined => {
  if (project) return projectIdentityKey(session.instanceId, project.id);
  return session.directory
    ? `directory:${session.instanceId}::${normalizeDirectory(session.directory)}`
    : undefined;
};

export const resolveAvatarIdentity = (
  session: Session,
  projects: Project[],
  scheduledBindings: Record<string, string>,
  overrides: Record<string, AvatarOverride>,
  projectColors: Record<string, number> = {}
): AvatarIdentity => {
  const key = sessionKey(session);
  const projectKey = projectAvatarKey(session, projectForSession(session, projects));
  const taskKey = scheduledBindings[key];
  const override = {
    ...(projectKey ? overrides[projectKey] : undefined),
    ...(taskKey ? overrides[taskKey] : undefined),
    ...overrides[sessionAvatarKey(session)],
  };
  return {
    sessionKey: key,
    projectKey,
    taskKey,
    colorSeed: projectKey ?? key,
    shapeSeed: taskKey ?? key,
    motionSeed: key,
    colorIndex:
      override.colorIndex ??
      (projectKey ? projectColors[projectKey] ?? hashString(`avatar-color:${projectKey}`) % AVATAR_COLOR_COUNT : undefined),
    shapeName: override.shapeName,
  };
};

export const seedIdentity = (seed: string): AvatarIdentity => ({
  sessionKey: seed,
  colorSeed: seed,
  shapeSeed: seed,
  motionSeed: seed,
});
